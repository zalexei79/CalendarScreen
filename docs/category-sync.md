# Account category synchronization

`money_category_library` stores category names and deletion markers per account. Existing device lists are imported once without replacing cloud rows. Explicit edits use owner-checked RPCs. A deletion marker prevents an old device from re-importing a removed category.

The browser retains its category cache and a persistent edit queue. Realtime, focus, reconnect and a 15-second visible-page poll refresh other devices. Guest categories remain local. Favorites, recent ordering and icon preferences remain device preferences in this release.

Apply only `202611040003_money_category_sync.sql` before publishing the frontend. It creates the isolated table, read policy and two RPCs, and enables realtime for this table. Do not apply unrelated pending migrations.

Checks: `node tests/category-sync-model.test.mjs`, `node tests/category-account-sync-ui-check.mjs`. `tests/category-sync-db-check.sql` verifies RPC ordering, deletion safety and cross-account protection inside a rolled-back transaction, with two existing auth accounts and no persistent data changes.
