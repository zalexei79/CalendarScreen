# Receipt capture, first release

See [receipt formats and recognition boundaries](receipt-formats.md) for the
expanded parser corpus, source research and deliberate manual-review cases.
The [public corpus experiment](receipt-corpus.md) documents the trained row-role
helper, exact source licenses, reproducible fixtures and separate photo results.

The finance calendar has a photo button beside the microphone. PRO members can
choose an image or take a new photo, review/edit recognized items and save one
expense. Item details are persisted in the calendar entry's comment, not as
additional expenses. The receipt photo and raw OCR text are not uploaded/stored.

The review starts with a prominent total and a compact purchase list. Known
product names have localized readable labels (with the original brand retained);
the original recognized name remains editable. Tap a row to edit its name,
quantity, unit and price. Recognized rows are visible by default, including
incomplete names/numbers. A compact "Save item list" switch starts on. Turning
it off saves only the grand total; turning it back on restores the current edits.
Item uncertainties and differences from the receipt total are informational and
do not block saving. Editing items never changes the receipt grand total.

Product types are separate from accounting categories. The shared catalog contains
101 stable types with Russian, Romanian, English and Chinese aliases/icons. Unknown
products retain their name and a generic icon; they never create calendar
categories. The searchable type picker can correct a match. Exact-name corrections
are stored for that account on the current device (maximum 1,000 aliases), with an
option to return to automatic detection. They do not sync between devices.

New comments have a readable receipt header and readable item labels, retaining
the original recognized names in brackets. There is no hidden JSON payload. Day
history and global history render receipt cards from these lines and also from
legacy receipt comments. Partial rows keep independent fields with missing-value
placeholders instead of asserting a false multiplication. Ordinary notes remain
text. Historic totals are never
recomputed from OCR rows. A mismatch is displayed without changing ledger values.
Canonical original-name fingerprints keep duplicate detection working across
old/new comment formats and display languages. General entry editing is preserved.

Tesseract.js runs locally. Build/dev preparation copies the pinned language
packages (English, Romanian, Russian, simplified Chinese) and engine from npm
dependencies into ignored `public/receipt-ocr/v1`. No OCR API key or third-party
CDN is required at runtime. Language packs load on demand. The first scan needs
an internet connection to load the assets and verify PRO through Supabase.

`get_my_pro_status` is checked before OCR and before saving. The account must
still match the current authenticated session. This gates the DAYRIS workflow;
the public browser OCR engine itself is not a private server service. Photos up
to 20 MB in JPEG/PNG/WebP/BMP are supported; HEIC needs conversion to JPEG.

The parser treats receipt totals separately from item sums, payment, change,
discounts and tax. Monetary arithmetic uses integer minor units. Ambiguous total,
currency or date stays unset. The save action confirms the visible draft; there
is no separate photo-confirmation checkbox. Only unresolved grand totals, missing
currency/date and excluded document types block a purchase expense. Item names,
quantities, prices and arithmetic may remain incomplete or contradictory. The
expense amount always comes from the independent grand total. Unreadable item
amounts display as an em dash in review/history, never as an invented zero.
See [Moldovan receipt follow-up](receipt-moldova.md).

Current currency options remain USD/EUR/MDL/RUB/CNY/UAH. RON is recognized as RON but
must not be silently converted to MDL. Date must be today or in the past. Repeated
identical date/amount/currency/details are blocked against current calendar data;
this is not an atomic cross-device deduplication guarantee. Saves use the normal
calendar cloud-sync queue. The success screen reports expenses on the receipt's
date in that currency, excluding income and trading-platform records.

The learned helper only nominates possible product rows when a visual price
column exists. It never authorizes a financial total or invents missing unit
prices by dividing a line total. Final-total labels outrank intermediate totals.
Conflicting, low-confidence or recovered-after-failure OCR totals remain review
choices, even when two numeric rereads agree. Country evidence can resolve a
numeric date; unresolved day/month order remains blank. Merchant extraction
excludes promotions, addresses, cashier identifiers and payment processors.

## Verification

```
node --test tests/receipt-model.test.mjs
node --test tests/receipt-history.test.mjs
node tests/receipt-ui-check.mjs
npm run build
node tests/receipt-app-ui-check.mjs
node tests/receipt-history-app-ui-check.mjs
git diff --check
```

Set `DAYRIS_PLAYWRIGHT_PACKAGE` to the package.json beside a Playwright
installation if it is not installed locally. Optional `DAYRIS_RECEIPT_SAMPLE`
points to the supplied Moldova photo; the production-browser test additionally
requires its recognized total to be 151.85. No private photo is checked in.

OCR is a draft, not a guarantee: perspective, blur, unusual layouts and scripts
can leave item/date fields incomplete. The first release does not store photo
attachments, split a receipt into multiple entries, perform currency conversion,
or claim universal receipt recognition.
