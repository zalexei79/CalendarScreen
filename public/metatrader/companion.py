"""DAYRIS Windows companion. Reads MT5 history; never sends trading commands."""
import json
import queue
import threading
import time
import os
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ctypes
import MetaTrader5 as mt5

PORT = 17865
ORIGINS = {'https://ai-trade-journal-ejm8.onrender.com', 'http://localhost:5173', 'http://127.0.0.1:5173'}
permissions = {}
requests = queue.Queue()
terminal_lock = threading.Lock()

def clean(value):
    return str(value).replace(';', '_').replace('\r', ' ').replace('\n', ' ')

def export_history(account, deals, positions):
    opened = {p.identifier for p in positions}
    groups = defaultdict(list)
    for deal in deals:
        if deal.position_id:
            groups[deal.position_id].append(deal)
    lines = ['platform;server;account;ticket;date;time;symbol;direction;profit;swap;commission;currency']
    mode = {0: 'Demo', 1: 'Contest', 2: 'Live'}[account.trade_mode]
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    lines.append(';'.join(map(clean, ['ACCOUNT', 'MT5', account.server, account.login, account.company, mode, account.balance, account.currency, stamp])))
    for identifier, group in groups.items():
        trading = sorted((d for d in group if d.type in (0, 1)), key=lambda d: (d.time_msc, d.ticket))
        if identifier in opened or not trading or trading[0].entry != 0:
            continue
        if abs(sum(d.volume * (1 if d.type == 0 else -1) for d in trading)) > 1e-7:
            continue
        closed = datetime.fromtimestamp(trading[-1].time, timezone.utc)
        lines.append(';'.join(map(clean, ['MT5', account.server, account.login, identifier,
            closed.strftime('%Y-%m-%d'), closed.strftime('%H:%M:%S'), trading[0].symbol,
            'buy' if trading[0].type == 0 else 'sell', sum(d.profit for d in group),
            sum(d.swap for d in group), sum(d.commission + d.fee for d in group), account.currency])))
    lines.append('END')
    return '\n'.join(lines)

def snapshot(expected=None):
    with terminal_lock:
        initialized = mt5.initialize(timeout=15000)
        if not initialized:
            paths = set()
            for base in (os.environ.get('ProgramFiles'), os.environ.get('ProgramFiles(x86)')):
                if base:
                    paths.update(Path(base).glob('*/terminal64.exe'))
            if len(paths) == 1:
                initialized = mt5.initialize(str(next(iter(paths))), timeout=15000)
        if not initialized:
            raise ValueError('Откройте MT5 и войдите в свой торговый счёт, затем повторите подключение.')
        try:
            info, terminal = mt5.account_info(), mt5.terminal_info()
            if not info or not terminal or not terminal.connected:
                raise ValueError('MT5 не подключён к брокеру. Проверьте соединение в терминале.')
            identity = f'{info.server}:{info.login}'
            if expected and identity != expected:
                raise ValueError('В MT5 сменился счёт. Отключите помощник в DAYRIS и подключите новый счёт.')
            deals = mt5.history_deals_get(datetime(1970, 1, 1, tzinfo=timezone.utc), datetime.now(timezone.utc))
            positions = mt5.positions_get()
            if deals is None or positions is None:
                raise ValueError('Не удалось прочитать историю MT5. Повторите синхронизацию.')
            if len(deals) > 100000:
                raise ValueError('История слишком большая для одного импорта.')
            return identity, export_history(info, deals, positions)
        finally:
            mt5.shutdown()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Account history and pairing tokens are never logged.

    def allowed(self):
        return self.headers.get('Origin') in ORIGINS and self.headers.get('Host') == f'127.0.0.1:{PORT}'

    def reply(self, status, value):
        payload = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        if self.allowed():
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        if not self.allowed():
            return self.reply(403, {})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def do_POST(self):
        if not self.allowed():
            return self.reply(403, {'error': 'Origin denied'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1024:
                return self.reply(400, {'error': 'Invalid request'})
            body = json.loads(self.rfile.read(length))
            token = self.headers.get('Authorization', '').removeprefix('Bearer ')
            if len(token) != 64 or any(c not in '0123456789abcdef' for c in token):
                return self.reply(401, {'error': 'Подключите MT5 заново.'})
            origin = self.headers['Origin']
            if self.path == '/connect':
                event, result = threading.Event(), []
                requests.put((event, result, origin))
                if not event.wait(90) or not result or not result[0]:
                    return self.reply(403, {'error': 'Подключение отменено в помощнике DAYRIS.'})
                identity, csv = snapshot()
                permissions[token] = (origin, identity, time.monotonic())
            elif self.path in ('/sync', '/disconnect'):
                permission = permissions.get(token)
                if not permission or permission[0] != origin or time.monotonic() - permission[2] > 86400:
                    return self.reply(401, {'error': 'Подключите MT5 заново.'})
                if self.path == '/disconnect':
                    permissions.pop(token, None)
                    return self.reply(200, {'ok': True})
                identity, csv = snapshot(permission[1])
            else:
                return self.reply(404, {})
            self.reply(200, {'csv': csv, 'timeZone': 'UTC'})
        except (ValueError, KeyError, TypeError) as error:
            self.reply(400, {'error': str(error)})
        except Exception:
            self.reply(500, {'error': 'Не удалось прочитать MT5. Перезапустите помощник.'})

def main():
    if '--self-test' in sys.argv:
        print('DAYRIS companion runtime OK; MetaTrader5 module:', mt5.__version__)
        return
    ctypes.windll.kernel32.SetConsoleTitleW('DAYRIS · MT5')
    print('DAYRIS MT5 companion is running. Free, read-only.\nOpen DAYRIS calendar and click Connect MT5.\nKeep this window and MT5 open. Close this window to stop.\n')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    except OSError:
        ctypes.windll.user32.MessageBoxW(None, 'Помощник уже запущен. Откройте календарь и подключите MT5.', 'DAYRIS', 0x40)
        return
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        while True:
            event, result, origin = requests.get()
            answer = ctypes.windll.user32.MessageBoxW(None,
                'Разрешить DAYRIS прочитать историю текущего счёта MT5?\n\n' + origin + '\n\nТорговые команды и пароли не передаются.',
                'Подключить DAYRIS?', 0x4 | 0x20 | 0x10000 | 0x100)
            result.append(answer == 6)
            event.set()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
