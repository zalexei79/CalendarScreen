STEP 7 HOTFIX — "Мои приглашения"

Причина ошибки:
CalendarScreen.jsx уже ожидал recentInvites,
а useReferral.js в проекте остался от Step 6 и recentInvites не возвращал.

Из-за этого при открытии вкладки выполнялось recentInvites.length,
но recentInvites был undefined.

Замени ОБА файла:
1) D:\ai-trade-journal\CalendarScreen.jsx
2) D:\ai-trade-journal\src\features\referrals\useReferral.js

CalendarScreen дополнительно защищён:
recentInvites = []
так что подобный mismatch больше не уронит экран.

Потом:
npm.cmd run build

Ожидаемо:
✓ built in ...
