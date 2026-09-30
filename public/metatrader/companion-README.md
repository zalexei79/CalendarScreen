# Free DAYRIS MT5 companion

Windows x64, installed MetaTrader 5, Chrome or Edge. No paid provider, API subscription, Python installation for users, broker password, expert advisor or folder picker.

1. Download and run DAYRIS-MT5.exe from DAYRIS. A branded desktop window opens, without a console. Keep it open or minimized.
2. Open MT5 on the desired account.
3. Open DAYRIS on the same computer and click Connect MT5. Allow the browser's local network permission and approve the companion's dialog. Closed positions are imported automatically.
4. Use Synchronize or enable the 30-second auto-sync. Keep MT5, the companion and DAYRIS open. Existing DAYRIS cloud sync carries saved trades to the same user's phone.

The connection is scoped to the current browser session and terminal account. Switching the DAYRIS user revokes access. Switching the MT5 account requires reconnecting. Credentials are never stored. The loopback service binds only 127.0.0.1:17865, accepts specific DAYRIS origins and requires a random session token plus native consent. No trading API methods are called.

Trade timestamps preserve the broker clock shown in MT5 history. The terminal snapshot timestamp uses UTC. Only fully closed positions are imported, including all their commissions, fees and swap. Position markers match the earlier DAYRIS exporter so repeated imports are skipped. Ordinary broker reports are not supported by the optional legacy CSV path.

The executable is unsigned; Windows may display a publisher warning. No certificate purchase or paid service is required.

The companion has buttons to open DAYRIS and MT5. Approval appears inside its window. Sync requires an already running terminal and never silently starts MT5; a failed IPC connection is reported and cleaned up. Restarting a running terminal is a separate user action.

Build on Windows with Python 3.12 x64: create `.mt5-build` venv, install `companion-requirements.txt`, then run `scripts/build-mt5-companion.ps1`. Source is `companion.py`. Test: `.mt5-build/Scripts/python.exe tests/mt5-companion.py`.
