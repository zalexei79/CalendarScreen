STEP 11 HOTFIX — BUILD FIX

Причина:
в новом верхнем блоке выбора валюты в DAYRIS PRO History закрывающий </div>
оказался не на своём месте, из-за чего Vite останавливался на строке около 3613.

Исправлено:
- структура traderMode && (...) восстановлена;
- верхний выбор валюты остаётся внутри DAYRIS PRO History header;
- CalendarScreen.jsx проверен JSX/TypeScript parser: 0 syntax errors;
- Header.jsx также проверен: 0 syntax errors.

Замени:
D:\ai-trade-journal\CalendarScreen.jsx

Header.jsx менять не обязательно — он приложен как копия текущего Step 11.

Потом:
cd D:\ai-trade-journal
npm.cmd run build
