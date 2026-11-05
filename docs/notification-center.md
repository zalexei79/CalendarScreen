# DAYRIS notification center

The bell beside PRO opens an account-owned inbox with all/unread filters, paginated history, automatic read on opening, mark-all-read and per-notification deletion. The inbox contains messages and gifts from DAYRIS, PRO grants, paid subscription activations/extensions, and verification changes. Private friend messages stay in Friends.

Migration `202611050003_notification_center.sql` exposes a union over the existing creator messages and PRO notification records plus a private account-event table. Reading uses the original source read/seen fields, so existing message and PRO flows remain synchronized. A campaign gift and its linked PRO grant appear once. Deleting a notification acknowledges its source and saves an owner-scoped hidden marker; it does not delete a message, gift or entitlement. Draft campaigns and future grants are excluded.

Verification changes are recorded by a database trigger. Current verified profiles are included at migration time. The latest current grant gets one persistent in-app congratulations card; revoked or superseded grants do not display congratulations. Closing the card marks it presented while keeping the notification unread; thanking DAYRIS marks it read. Onboarding and existing modal dialogs defer the card. Older notifications are always accessible through the bell.

Existing PRO celebrations, creator message deep links, and Web Push delivery are preserved. General creator messages no longer open automatically over the calendar; the bell shows them. Verification uses the in-app channel introduced here; no new operating-system push worker is deployed.

RPCs bind the acting owner and deny direct table/view access. Read/delete actions apply only to that owner's visible entries. Source records, billing state and permissions remain authoritative. The frontend resets on account changes and ignores stale responses.

Deploy the scoped database migration before the frontend. Checks: `node --test tests/notification-center-db.test.mjs`, `node tests/notification-center-ui-check.mjs`, and `npm run build`. Browser fixtures use synthetic accounts and no production credentials.
