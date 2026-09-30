import importlib.util
import unittest
import threading
import http.client
from unittest.mock import patch
from types import SimpleNamespace as NS
from pathlib import Path

spec = importlib.util.spec_from_file_location('companion', Path(__file__).parents[1] / 'public/metatrader/companion.py')
companion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(companion)

def deal(ticket, kind, volume, entry, **fields):
    return NS(ticket=ticket, position_id=12, type=kind, volume=volume, entry=entry,
              time=1720000000 + ticket, time_msc=1720000000000 + ticket * 1000,
              symbol='EURUSD', profit=fields.get('profit', 0), swap=fields.get('swap', 0),
              commission=fields.get('commission', -1), fee=fields.get('fee', 0))

class Tests(unittest.TestCase):
    account = NS(trade_mode=0, server='Broker-Demo', login=42, company='Broker', balance=1000, currency='USD')

    def test_closed_fees_and_partials(self):
        deals = [deal(1, 0, 1, 0), deal(2, 1, .4, 1, profit=10), deal(3, 1, .6, 1, profit=20, swap=-2, fee=-.5)]
        rows = companion.export_history(self.account, deals, []).splitlines()
        self.assertEqual(len(rows), 4)
        self.assertIn(';12;', rows[2])
        self.assertTrue(rows[2].endswith(';30;-2;-3.5;USD'))
        self.assertEqual(len(companion.export_history(self.account, deals[:2], []).splitlines()), 3)

    def test_open_and_missing_entry_excluded(self):
        deals = [deal(1, 0, 1, 0), deal(2, 1, 1, 1)]
        self.assertEqual(len(companion.export_history(self.account, deals, [NS(identifier=12)]).splitlines()), 3)
        deals[0].entry = 1
        self.assertEqual(len(companion.export_history(self.account, deals, []).splitlines()), 3)

    def test_empty_account(self):
        self.assertIn('ACCOUNT;MT5;Broker-Demo;42;Broker;Demo;1000;USD;', companion.export_history(self.account, [], []))

    def test_host_and_origin(self):
        handler = object.__new__(companion.Handler)
        handler.headers = {'Host': '127.0.0.1:17865', 'Origin': 'https://evil.test'}
        self.assertFalse(handler.allowed())
        handler.headers['Origin'] = 'https://ai-trade-journal-ejm8.onrender.com'
        self.assertTrue(handler.allowed())
        handler.headers['Host'] = 'evil.test:17865'
        self.assertFalse(handler.allowed())

    def test_http_requires_consent_token_and_origin(self):
        server = companion.ThreadingHTTPServer(('127.0.0.1', 0), companion.Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        def post(action, token='a' * 64, origin='https://ai-trade-journal-ejm8.onrender.com'):
            connection = http.client.HTTPConnection(*server.server_address)
            connection.request('POST', '/' + action, '{}', headers={
                'Host': '127.0.0.1:17865', 'Origin': origin, 'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'})
            response = connection.getresponse()
            status = response.status
            response.read(); connection.close()
            return status
        try:
            self.assertEqual(post('sync'), 401)
            self.assertEqual(post('connect', origin='https://evil.test'), 403)
            self.assertEqual(post('connect', token='short'), 401)
            def decline():
                event, result, _ = companion.requests.get(timeout=3)
                result.append(False); event.set()
            worker = threading.Thread(target=decline); worker.start()
            self.assertEqual(post('connect'), 403); worker.join()
            def approve():
                event, result, _ = companion.requests.get(timeout=3)
                result.append(True); event.set()
            worker = threading.Thread(target=approve); worker.start()
            with patch.object(companion, 'snapshot', return_value=('Broker:42', 'CSV')):
                self.assertEqual(post('connect'), 200); worker.join()
                self.assertEqual(post('sync'), 200)
                self.assertEqual(post('disconnect'), 200)
                self.assertEqual(post('sync'), 401)
        finally:
            server.shutdown(); server.server_close()

if __name__ == '__main__':
    unittest.main()
