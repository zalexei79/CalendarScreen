# Вход в DAYRIS через Telegram

В интерфейсе добавлена кнопка «Войти через Telegram». Она использует Supabase
OAuth с идентификатором `custom:telegram`. Настройки ниже обязательны до выпуска:
без включённого провайдера настоящий вход работать не будет.

Настройка 5 октября 2026: для `@DAYRISAppBot` включён OIDC-провайдер
`custom:telegram` в Supabase. В BotFather добавлен Redirect URI
`https://mqdejoorgmhfgfzwpyog.supabase.co/auth/v1/callback`.
Переход из Supabase открывает форму авторизации Telegram; окончательная
проверка сессии требует подтверждения входа владельцем аккаунта.

## 1. Telegram

Открой мини-приложение [@BotFather](https://t.me/BotFather), выбери бота DAYRIS
(или создай нового), затем раздел **Login Widget**.
Если показан старый виджет, выбери **Switch to OpenID Connect Login**.

В **Allowed URLs** добавь callback URL, показанный в форме создания провайдера
Supabase. Копируй его целиком: для custom-провайдера путь может отличаться от
callback Google. Сохрани **Client ID** и **Client Secret** из этого раздела.
Это учётные данные OIDC; не подставляй вместо Client Secret обычный токен бота.

## 2. Supabase

В **Authentication → Sign In / Providers → New Provider**:

- Method: **Auto-discovery (OIDC)**.
- Identifier: `custom:telegram`.
- Name: `Telegram`.
- Client ID / Client Secret: значения из BotFather.
- Issuer: `https://oauth.telegram.org`.
- Scopes: `openid`, `profile` (не добавляй `email`).
- **Email optional** (`email_optional`): включить. Telegram не передаёт email.
- PKCE: оставить включённым.
- Включить провайдера после создания.

В **Authentication → URL Configuration → Redirect URLs** разреши точный origin
DAYRIS, куда приложение возвращается после входа, и origin локального сервера
для разработки. Для production используй HTTPS.

Client Secret хранится только в Supabase. Он не нужен в `.env.local`, React или
переменных `VITE_*`. Проверку подписи Telegram и создание сессии выполняет Supabase.

## 3. Проверка

1. Открой **Настройки → Аккаунт** без активной сессии.
2. Нажми «Войти через Telegram» и подтверди вход в Telegram.
3. Проверь возвращение в DAYRIS, отображение имени, сохранение новой записи
   и сохранение сессии после перезагрузки.
4. Выйди, войди снова через Telegram и проверь ту же запись.
5. Отмени вход в Telegram: приложение должно оставаться гостевым.
6. Проверь, что вход через Google продолжает работать.

Telegram без email создаёт отдельный аккаунт: записи и PRO аккаунта Google
автоматически не переносятся. Привязка Telegram к существующему аккаунту —
отдельный сценарий, который эта кнопка не выполняет.

Источники:
- [Telegram Login / OIDC](https://core.telegram.org/bots/telegram-login)
- [Supabase Custom OAuth/OIDC Providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
