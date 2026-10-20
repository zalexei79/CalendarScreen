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
node --test tests/receipt-formats.test.mjs tests/receipt-model.test.mjs tests/receipt-history.test.mjs tests/receipt-ocr-math.test.mjs tests/receipt-photo.test.mjs
node tests/receipt-ui-check.mjs
npm run build
node tests/receipt-app-ui-check.mjs
node tests/receipt-history-app-ui-check.mjs
```

Optional real-image inputs: `DAYRIS_RECEIPT_SAMPLE`, `DAYRIS_RECEIPT_CROP`,
`DAYRIS_CALCULATOR_SAMPLE`, `DAYRIS_CONSTRUCTION_SAMPLE`. Persistence is mocked
in browser tests; the tests do not add expenses to a real account.
