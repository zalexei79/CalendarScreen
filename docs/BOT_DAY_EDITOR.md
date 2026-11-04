# Editing the public bot calendar

Sign in to DAYRIS with an authorized Google administrator account, open `/bot`,
then choose **Редактировать дни** and a date. Edit entry names, times, directions,
results, comments and the public day text. **Сохранить для всех** publishes the
snapshot immediately. Deleting every entry publishes an empty day. **Вернуть
исходный день** removes the snapshot after confirmation.

Only admins with the existing `editUsers` capability can read the editor or save.
Every server call checks the verified session and current admin permissions.
Anonymous users have no write access or direct table access. The public response
includes only the explicitly published day text and entries, never personal trades.

Migration `202611040001_bot_day_editor.sql` adds isolated day snapshots and an
effective performance projection. Broker imports keep their raw records and cannot
overwrite editorial snapshots. Month totals, history, stage results and analytics
all read the same projection. Public disclosure identifies manually edited days.
Concurrent saves use revisions; conflicts require reloading, not silent overwrite.
Saving and restoring record before/after data in `site_admin_audit`.

This editor changes the public calendar's presentation and reported results;
it does not place, change or delete broker orders.
