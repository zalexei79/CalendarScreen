"""DAYRIS Windows companion. Reads MT5 history; never sends trading commands."""
import json
import queue
import threading
import time
import os
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ctypes
import subprocess
import webbrowser
import tkinter as tk
from tkinter import messagebox
import MetaTrader5 as mt5

PORT = 17865
ORIGINS = {'https://ai-trade-journal-ejm8.onrender.com', 'http://localhost:5173', 'http://127.0.0.1:5173'}
permissions = {}
requests = queue.Queue()
terminal_lock = threading.Lock()
updates = queue.Queue()

def installed_terminals():
    paths = set()
    for base in (os.environ.get('ProgramFiles'), os.environ.get('ProgramFiles(x86)')):
        if base:
            paths.update(Path(base).glob('*/terminal64.exe'))
    return sorted(paths)

def terminal_running():
    result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq terminal64.exe', '/FO', 'CSV', '/NH'],
                            capture_output=True, timeout=5, creationflags=subprocess.CREATE_NO_WINDOW)
    return b'terminal64.exe' in result.stdout.lower()

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
        if not terminal_running():
            raise ValueError('MT5 не открыт. Запустите терминал и войдите в свой счёт, затем повторите подключение.')
        paths = installed_terminals()
        initialized = mt5.initialize(str(paths[0]), timeout=15000) if len(paths) == 1 else mt5.initialize(timeout=15000)
        if not initialized:
            mt5.shutdown()
            raise ValueError('MT5 запущен, но не отвечает помощнику. Проверьте окно терминала и повторите подключение.')
        try:
            info, terminal = mt5.account_info(), mt5.terminal_info()
            if not info or not terminal or not terminal.connected:
                raise ValueError('MT5 не подключён к брокеру. Проверьте соединение в терминале.')
            identity = f'{info.server}:{info.login}'
            if expected and identity != expected:
                raise ValueError('В MT5 сменился счёт. Отключите помощник в DAYRIS и подключите новый счёт.')
            # MT5 deal timestamps use broker wall time. A UTC 'now' cutoff can
            # omit today's closing deals on servers ahead of UTC. Include a
            # margin covering server offsets; MT5 only returns existing deals.
            history_end = datetime.now(timezone.utc) + timedelta(days=2)
            deals = mt5.history_deals_get(datetime(1970, 1, 1, tzinfo=timezone.utc), history_end)
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
                    event.set()
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
            self.reply(200, {'csv': csv, 'timeZone': 'broker'})
            updates.put('История передана календарю. Результат сохранения смотрите в DAYRIS.\nДля обновления нажмите «Синхронизировать» в календаре или оставьте автосинхронизацию включённой.')
        except (ValueError, KeyError, TypeError) as error:
            updates.put(str(error))
            self.reply(400, {'error': str(error)})
        except Exception:
            self.reply(500, {'error': 'Не удалось прочитать MT5. Перезапустите помощник.'})

def main():
    if '--self-test' in sys.argv:
        print('DAYRIS companion runtime OK; MetaTrader5 module:', mt5.__version__)
        return
    root = tk.Tk()
    root.withdraw()
    app = CompanionWindow(root)
    if '--ui-self-test' in sys.argv:
        root.update_idletasks()
        assert app.connect_button.winfo_reqwidth() > 0
        assert root.title() == 'DAYRIS · Подключение MT5'
        for page in app.info_pages:
            app.show_info(page)
            root.update_idletasks()
            assert root.winfo_reqheight() <= root.winfo_height(), 'Instructions exceed the window height'
        root.destroy()
        return
    try:
        server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    except OSError:
        messagebox.showinfo('DAYRIS', 'Помощник уже запущен. Откройте его окно или календарь и подключите MT5.', parent=root)
        root.destroy()
        return
    threading.Thread(target=server.serve_forever, daemon=True).start()
    root.deiconify()
    app.poll()
    root.mainloop()
    server.shutdown()

class CompanionWindow:
    def __init__(self, root):
        self.root, self.pending = root, None
        bg, card, muted, amber = '#0c101a', '#171e2c', '#aab5c9', '#ffc238'
        root.title('DAYRIS · Подключение MT5')
        root.geometry('540x740')
        root.minsize(540, 740)
        root.resizable(False, True)
        root.configure(bg=bg)
        icon = Path(getattr(sys, '_MEIPASS', Path(__file__).parent)) / 'icon-48.png'
        if icon.exists():
            self.icon = tk.PhotoImage(file=str(icon)); root.iconphoto(True, self.icon)
        frame = tk.Frame(root, bg=bg, padx=28, pady=24); frame.pack(fill='both', expand=True)
        def label(text, size=11, color='white', parent=frame):
            item = tk.Label(parent, text=text, bg=parent['bg'], fg=color, font=('Segoe UI', size),
                            anchor='w', justify='left', wraplength=440 if parent == frame else 410)
            item.pack(fill='x', pady=(0, 12)); return item
        label('DAYRIS  /  MT5', 11, amber)
        label('Ваш терминал. Ваш календарь.', 19)
        label('Помощник готов к подключению', 12, '#62d5aa')
        panel = tk.Frame(frame, bg=card, padx=16, pady=14); panel.pack(fill='x', pady=(2, 16))
        self.status = label('Откройте MT5 с нужным счётом. Затем нажмите\n«Подключить MT5» в календаре DAYRIS.', 11, muted, panel)
        self.origin = label('', 9, muted, panel); self.origin.pack_forget()
        self.actions = tk.Frame(panel, bg=card)
        self.connect_button = tk.Button(self.actions, text='Разрешить подключение', command=lambda: self.answer(True),
                                       bg=amber, fg=bg, font=('Segoe UI', 10, 'bold'), relief='flat', padx=14, pady=9, cursor='hand2')
        self.connect_button.pack(side='left')
        tk.Button(self.actions, text='Отмена', command=lambda: self.answer(False), bg=card, fg=muted,
                  relief='flat', padx=16, pady=9, cursor='hand2').pack(side='left', padx=8)
        tk.Button(frame, text='Открыть календарь DAYRIS', command=lambda: webbrowser.open('https://ai-trade-journal-ejm8.onrender.com/'),
                  bg=amber, fg=bg, font=('Segoe UI', 11, 'bold'), relief='flat', pady=12, cursor='hand2').pack(fill='x', pady=(0, 10))
        tk.Button(frame, text='Открыть MetaTrader 5', command=self.open_terminal, bg=card, fg='white',
                  font=('Segoe UI', 11), relief='flat', pady=10, cursor='hand2').pack(fill='x')
        tabs = tk.Frame(frame, bg=bg); tabs.pack(fill='x', pady=(14, 10))
        instructions, privacy = tk.Frame(frame, bg=bg), tk.Frame(frame, bg=bg)
        def show_info(selected):
            instructions.pack_forget(); privacy.pack_forget(); selected.pack(fill='x')
        for title, page in [('Как синхронизировать', instructions), ('Какие данные читаем', privacy)]:
            tk.Button(tabs, text=title, command=lambda page=page: show_info(page), bg=card, fg='white',
                      font=('Segoe UI', 10), relief='flat', padx=12, pady=9, cursor='hand2').pack(side='left', padx=(0, 8))
        label('1. Откройте MT5 и войдите в нужный счёт.\n2. Откройте DAYRIS → Трейдер → MT5.\n3. Нажмите «Подключить MT5» и разрешите доступ здесь.\nПервое подключение сразу загрузит закрытые позиции.', 10, muted, instructions)
        label('В DAYRIS нажмите «Синхронизировать» или включите обновление каждые 30 секунд. MT5, это окно и календарь должны быть открыты на ПК. Помощник можно свернуть.\nПосле закрытия или перезагрузки ПК запустите помощник снова и подключите MT5 в DAYRIS. Скачать его повторно не нужно.', 10, muted, instructions)
        label('На телефоне доступна сохранённая история через тот же аккаунт DAYRIS. Подключение работает на ПК; статус на телефоне не отключает его.\nБез дополнительных платежей за подключение MT5.', 9, muted, instructions)
        label('Закрытые позиции: инструмент, направление, время, результат, комиссии и своп. Также номер счёта, брокер, сервер, Demo/Live, баланс и валюта. Открытые позиции проверяются, чтобы исключить незавершённые сделки.\nПароль брокера не запрашивается и не передаётся. Помощник не открывает и не закрывает сделки.', 10, muted, privacy)
        label('Помощник передаёт данные календарю только на вашем ПК. Сделки сохраняются в ваш аккаунт DAYRIS для доступа на телефоне.\n«Отключить» в DAYRIS прекращает доступ помощника. Сохранённая история остаётся.', 10, muted, privacy)
        show_info(instructions)
        self.info_pages = (instructions, privacy)
        self.show_info = show_info
        root.protocol('WM_DELETE_WINDOW', self.stop)

    def open_terminal(self):
        try:
            if terminal_running():
                self.status.configure(text='MT5 уже запущен. Найдите его окно на панели задач.\nЕсли окно зависло, закройте терминал обычным способом и откройте снова.')
                return
            paths = installed_terminals()
            if len(paths) != 1:
                self.status.configure(text='Откройте нужный MT5 через его ярлык на компьютере.'); return
            subprocess.Popen([str(paths[0])], cwd=str(paths[0].parent))
            self.status.configure(text='MT5 запускается. Войдите в свой счёт в терминале, затем подключите календарь.')
        except (OSError, subprocess.TimeoutExpired):
            self.status.configure(text='Не удалось открыть MT5. Попробуйте запустить его через обычный ярлык.')

    def answer(self, allowed):
        if not self.pending: return
        event, result, _ = self.pending
        result.append(allowed); event.set(); self.pending = None
        self.actions.pack_forget(); self.origin.pack_forget()
        self.show_info(self.info_pages[0])
        self.status.configure(text='Читаем историю MT5…' if allowed else 'Подключение отменено. Сделки не переданы.')

    def poll(self):
        while not updates.empty():
            self.status.configure(text=updates.get_nowait())
        if not self.pending:
            try:
                self.pending = requests.get_nowait()
                for page in self.info_pages: page.pack_forget()
                self.status.configure(text='Разрешить календарю прочитать историю и сведения о текущем счёте MT5? Пароль брокера не передаётся. Торговых команд нет.')
                self.origin.configure(text=self.pending[2]); self.origin.pack(fill='x')
                self.actions.pack(fill='x', pady=(4, 0))
                self.root.deiconify(); self.root.lift()
            except queue.Empty:
                pass
        elif self.pending[0].is_set():
            self.answer(False)
        self.root.after(200, self.poll)

    def stop(self):
        if self.pending: self.answer(False)
        self.root.destroy()

if __name__ == '__main__':
    try:
        main()
    except Exception:
        if '--diagnostic-file' in sys.argv:
            import traceback
            target = Path(sys.argv[sys.argv.index('--diagnostic-file') + 1])
            target.write_text(traceback.format_exc(), encoding='utf-8')
            raise SystemExit(1)
        raise
