# Receipt formats and recognition boundaries

The feature uses local OCR followed by parsing and exact decimal checks. These
changes expand rules and regression examples; they do not train an AI model or
establish an accuracy percentage for unseen photos.

## Evidence used

Primary POS documentation separates goods, discounts, deposits, tips, payment
amounts and payment currencies. A receipt is not merely a list of positive numbers:

- [RetailForce transaction types](https://support.retailforce.cloud/hc/ro/articles/5381526859409-Cazuri-de-afaceri-BusinessTransactionTypes): discounts, bottle deposits, vouchers, tips and advances are distinct operations.
- [RetailForce cash receipt example](https://support.retailforce.cloud/hc/ro/articles/4404607645585-Implementarea-bonului-fiscal-plata-%C3%AEn-numerar): item values and payment values/currency are separate fields.
- [Microsoft fiscal subtotal adjustments](https://learn.microsoft.com/en-us/previous-versions/windows/embedded/ms842369(v=winembedded.1002)): discounts/surcharges can be amounts or percentages.
- [HMRC retail invoice layouts](https://www.gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec16043): tax-inclusive and tax-exclusive values can coexist with tax summaries. This is evidence for layout diversity, not a Moldova tax rule.
- [Ukrainian tax service receipt example](https://tax.gov.ua/data/files/268048.pdf): `СУМА`, taxes, rounding, `До сплати`, cash and change are distinct rows.
- [Tesseract image quality guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html): rescaling and segmentation affect OCR quality. Enlarging an image does not restore missing detail.

## Supported structure

- Whole accounting labels identify totals. A product such as “Total cereal”
  does not become a total. “Total incl VAT”, “ИТОГ”, Romanian accented labels,
  dotted leaders, wrapped currencies and wrapped integer amounts are accepted.
- A printed final total takes precedence over a remaining balance (often zero
  after payment). Different final totals remain ambiguous; the largest number is
  never chosen as a heuristic.
- Named priced rows require a receipt total. They cannot silently fall through
  to photo-amount mode and use the last product's price as the expense.
- Quantities multiply prices using integer/rational arithmetic with half-up
  rounding. Quantities support four decimal places, kg and litres. Operators
  include `x`, `х`, `×`, `*`, `@`; an unambiguous numeric continuation can wrap.
- Some legacy receipts put the equation and “Стоимость” on separate lines.
  That printed amount is attached to its equation, not made into another product.
- Zero-priced gifts are retained. Cash, card, change, bonuses and accounting
  summaries are excluded from goods. Bottle deposits with an explicit item amount
  remain visible goods/charges.
- Dense receipts without a reliable total get an additional single-block OCR
  pass. Conflicting existing totals are not resolved by selecting another pass.
  Numeric row rereading still uses actual image pixels and arithmetic agreement.
- Ukrainian `СУМА`, `РАЗОМ`, `ВСЬОГО`, `ДО СПЛАТИ` and Russian `СУММА`
  are total labels; `Сума податку`, `ПДВ`, cash and change are excluded.
- Known visual label confusions (`T0TAL`, `счма`, spaced letters) locate a candidate
  region but cannot themselves establish a total. The amount region is read in
  two segmentation modes; matching readings may replace OCR digits. Disagreement
  leaves the total blank for review. Arbitrary typo-distance guesses are avoided.
- Small images with tiny or undetected numeric glyphs can be enlarged up to 3x
  (within 1000x2400) for the recovery pass; sufficiently large print is retained.
  Recognition coordinates and numeric rereading use the same image. No enhanced
  image is stored or uploaded.
- Calculator extraction accepts isolated numbers/calculator content only. Receipt
  prose, weights and trading screens cannot select an unrelated prominent number.
  A decimal quantity such as `0.920` means 0.920 in a calculation, never 920.
- Recognized trading history gets a compact status and cannot be saved as an
  expense. Importing a trading result belongs to the separate trade workflow.
- If a recovered total accompanies unreconciled/unreliable product rows, review
  opens in total-only mode. The omitted draft rows remain available with Restore
  items; they are not deleted from any saved expense. Confirmation is still needed.
- Patterned backgrounds can trigger a bounded paper-region recovery pass. If the
  total label was lost, the footer's larger numeric rows are only location hints:
  the label must be read separately before reading a numeric region. Different
  numeric readings appear as unselected review choices; font size never authorizes
  choosing the largest amount. Choosing a candidate still requires normal metadata
  and photo confirmation before saving.
- Legacy `DD.MM.YY HH:mm` dates use `20YY`. Future/invalid dates require correction;
  the parser never rolls a future year back by a century. Distinct printed dates
  require selection. No currency printed means no automatic calendar-currency
  substitution for receipts; `LEI` alone remains ambiguous between MDL and RON.
- Recognized refund/prebill headings and clearly multiple fiscal receipts block
  expense creation, including total-only mode. The UI gives one short status and
  the action to choose another photo. A returns-policy sentence is not a refund.

## Deliberate review paths

Discounts, percentage coupons, added tax, service charges, tips and rounding are
not reverse-engineered into item prices. If gross item amounts differ from the
printed net total, detailed saving requires correction; a verified total-only
expense is available. A discount summary after a final total is informational and
is never subtracted a second time. Unlabelled reversed factors, incomplete
equations, price tables without operators and fuel prices beyond two decimals
require review rather than inventing quantities/prices.

Unsupported cases remain: unrestricted scripts/languages, VAT tables with arbitrary
column layouts, fully itemized net/gross adjustment accounting, per-item currencies,
exchange conversion, refunds as income, partially paid invoices, uncertain US vs
European numeric dates, and two unrelated receipts without recognizable headings.
Blur, folds, low resolution, perspective, rotated images and lost print can prevent
recognition. No claim of error-free total recognition is made.

## Regression material

`tests/fixtures/receipt-formats.mjs` contains 50 independent synthetic OCR-text
scenarios and a transcription of the user's construction receipt. The format test
also checks 90 label/number-format combinations and a 150-item receipt. These are
parser tests, not 141 photographed receipts or an OCR benchmark.

Real browser checks separately exercise local OCR on the original Moldova photo,
its crop, the calculator screenshot and the supplied construction photo. Photos
are private local test inputs and are not committed. The construction photo must
produce 16,628.00 rather than its last item amount 652.00, four items, and the
printed date 2007-03-14. Since it does not print a currency, choosing RUB is an
explicit user action.

```
node --test tests/receipt-formats.test.mjs tests/receipt-model.test.mjs tests/receipt-history.test.mjs tests/receipt-ocr-math.test.mjs tests/receipt-ocr-total.test.mjs tests/receipt-photo.test.mjs
node tests/receipt-ui-check.mjs
npm run build
node tests/receipt-app-ui-check.mjs
node tests/receipt-history-app-ui-check.mjs
```

Optional real-image inputs: `DAYRIS_RECEIPT_SAMPLE`, `DAYRIS_RECEIPT_CROP`,
`DAYRIS_CALCULATOR_SAMPLE`, `DAYRIS_CONSTRUCTION_SAMPLE`. Persistence is mocked
in browser tests; the tests do not add expenses to a real account.

`DAYRIS_UNUSUAL_SCREENSHOTS_DIR` additionally tests the three user-supplied
screenshots from 2026-10-20. The app-test extracts each embedded source image at
native size, excluding app chrome and its wrong displayed amount. The two small
receipt regions must produce 532.90 and 725.00; the trading region must be blocked
as an expense. This is a check of these visible crops, not of unavailable original
photos or all blurred receipts. More severely damaged print still requires review.

`DAYRIS_CURVED_SAMPLE` checks the supplied bent 695.50 receipt on a patterned table.
The current OCR modes disagree (635.50 vs 695.50); the correct amount must appear
as an explicit review choice and must not be preselected or automatically saved.
