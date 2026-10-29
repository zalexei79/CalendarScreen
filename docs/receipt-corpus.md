# Public receipt corpus experiment — 29 October 2026

The calendar now includes a small trained **post-OCR row-role helper** and more
conservative merchant/date/total extraction. This trains document interpretation,
not Tesseract's image-recognition weights. Photo OCR remains the main limitation;
this experiment does not establish universal or error-free receipt recognition.

## Sources and actual scope

| Source | Used in this experiment | Role |
| --- | --- | --- |
| [CORD v2, NAVER CLOVA](https://github.com/clovaai/cord) | 1,000 original annotation records; 226 source images | Learn row roles and evaluate totals/items |
| [ExpressExpense SRD](https://expressexpense.com/blog/free-receipt-images-ocr-machine-learning-dataset/) | 200 downloaded photos; 40 run through OCR | Additional store/date/total layouts |
| [Auad et al., MaViLab-UFV](https://github.com/MaVILab-UFV/Filtering-Preparation-for-OCR_SIBGRAPI-2024) | 192 original manual transcripts; 40 manually curated field cases | Store/date calibration against actual text |

CORD is CC BY 4.0. ExpressExpense identifies SRD as MIT and requests attribution
to ExpressExpense.com. The MaViLab dataset is CC BY 4.0 in its
[DOI metadata](https://api.datacite.org/dois/10.5281/zenodo.13688441).
Exact revisions, hashes and credits are in
[`tests/fixtures/receipt-corpus/NOTICE.md`](../tests/fixtures/receipt-corpus/NOTICE.md)
and its adjacent manifest. No private user photographs were added to Git.

The original CORD partitions are 800/100/100. Duplicate annotation text crossed
partitions: 37 training documents and one validation duplicate were excluded,
leaving **763 training / 99 validation / 100 test** documents. Test records never
train the model. Parser rules were refined using evaluation failures, so the
reported parser test figures are regression results, not an untouched blind
estimate. CORD masks store identities and removes some metadata; merchant/date
results therefore use a separate explicitly marked calibration set.

CORD is predominantly Indonesian retail/restaurant material; SRD is restaurant
material from multiple countries. These are layout/robustness corpora, not a
representative Moldova/MDL benchmark. The local runtime has no Indonesian language
pack and the calendar does not enable IDR as a new account currency. This domain
gap is part of the photo results below, not evidence of accuracy on all supported
languages or Moldovan receipts.

## What was trained and changed

The deterministic softmax helper learns four row roles (item, total, adjustment,
payment) from **6,386 training rows**, using geometry and hashed character
features, with numeric values replaced. It has 148 features and a small weight
file. Seed 708 and 30 epochs reproduce the weights. Validation row accuracy is
**94.82%** (734 rows); test row accuracy is **94.06%** (791 rows).
These percentages describe row classification, never correctness of money read
from a photograph. The helper only nominates product rows with an aligned price
column. It cannot authorize an expense total.

The parser now prioritizes GRAND TOTAL/final totals over intermediate TOTAL,
recognizes additional observed labels, handles timestamp-prefixed totals and
grouped money, and rejects a count joined to a price (`4 156,090`). Taxes,
payment, change and summary service fees remain outside the purchase list.
A purchased repair service can still be a product. Missing unit prices are not
back-calculated from a printed line total. The list displays the printed amount
with a request to verify the price instead of a fabricated multiplication.

Merchant extraction excludes promotional headings, street/phone/cashier lines,
fiscal identifiers and payment processors. Date extraction supports textual
months and unambiguous US/European order; explicit country evidence can resolve
order, but ambiguous/conflicting dates remain blank. Five stable product types
(soup, salad, sushi, sandwich, dessert) extend the existing shared icons; the
catalog now has 98 types, separate from accounting categories.

The browser uses a distinct English-only numeric reread configuration alongside
the normal multilingual read, reusing one worker. Low-confidence, conflicting
and recovered-after-failure totals require explicit photo review even if both
reads agree. This deliberately sacrifices automatic coverage to avoid selecting
an unsupported amount. Review candidates themselves can still contain OCR errors.
Existing PRO gating and explicit user confirmation before saving remain intact.

## Results on already transcribed text

Baseline is the receipt sources from commit `34a2c55d`, copied before changes.
Exact totals compare integer minor units to original annotated totals. Missing
gold is excluded, not scored as a failure or zero. Correct review candidates are
reported separately from selected totals.

| Parsing annotated text | Baseline exact total | Current exact total | Current wrong selected | Correct review candidates |
| --- | --- | --- | --- | --- |
| CORD validation (97 labelled totals) | 73/97 | 84/97 | 0 | 3 |
| CORD test (95 labelled totals) | 64/95 | 77/95 | 0 | 3 |
| CORD training (742 labelled totals) | — | 603/742 | 1 | 19 |

Training results are not generalization evidence. The remaining training
disagreement and missing totals are retained in the reports, not silently fixed
to match labels. Exact name + printed-amount item matches increased from 13 to
114 on the 100 test documents and from 1 to 101 on validation. These are matched
counts, not product accuracy or recall: source and parser segmentation differ.

On the 40 manually curated transcript cases, exact stores increased **25/35 →
35/35**, dates **5/29 → 29/29**, and unambiguous totals **25/32 → 26/32**, with
no wrong selected total. This is calibration, not a blind benchmark. Five date
predictions without an unambiguous gold label are excluded from the date score.

## Actual photographs: unresolved limitations

**266 unique public photos** ran through local Tesseract: 226 CORD and 40 SRD.
There were **327 raw passes**, including PSM6 retries on blank/failed PSM3.
255 images produced some text. Nonblank text is not a correct receipt or total.
Eleven remained blank/failed. The frozen raw outputs include word boxes,
confidence, image hashes and timing; no source photos are in the runtime bundle.

| Image experiment | Exact total | Wrong selected total | Other outcome |
| --- | --- | --- | --- |
| Raw CORD test OCR + blank/failure retry (95 labelled totals) | 11/95 | 1 | 83 missing; 2 have a correct review choice |
| Raw CORD validation + retry (97 labelled totals) | 10/97 | 2 | 85 missing |
| Raw SRD OCR + retry, curated field sample (32 labelled totals) | 8/32 | 0 | 24 missing |
| Full browser crop/recovery/numeric pipeline, 20 CORD photos | 4/20 selected | 0 | 2 correct review choices; 14 missing/unhelpful |

Raw OCR rows omit the app's crop/numeric recovery and must not be presented as
full-app accuracy. Conversely, the small full-pipeline sample is diagnostic,
selected as every fifth official test image, not evidence about all 266 photos.
Its frozen outputs are replayed through the current parser in the offline test;
the original browser bundle hash is in the manifest. Small subsequent crop guards
are covered by unit tests, rather than falsely represented as a fresh full run.
The local desktop timings are not physical iPhone performance measurements.

The full sample exposes important failures: `63.000` can become `3.000`,
`54.000` can become `5.090`, and `197.450` can become `107`. Review choices can
be wrong too. The application must keep photo comparison/manual entry available.
Expanding labels alone cannot repair unreadable or misrecognized digits. The
current local engine does **not** satisfy a promise of perfect automatic photo
recognition; a stronger visual OCR engine would need its own measured evaluation
before replacing it. No cloud photo upload or paid service was introduced here.

Machine-readable measurements are in
[`receipt-corpus-results.json`](receipt-corpus-results.json). They deliberately
separate text parsing, raw OCR and full-pipeline replay, including failures.

## Reproduction

The checked-in compressed fixtures support offline training and field evaluation:

```powershell
node scripts/train-receipt-fields.mjs
node scripts/benchmark-receipt-corpus.mjs
node --test tests/receipt-corpus.test.mjs tests/receipt-fields.test.mjs
```

The benchmark writes untracked local reports under
`artifacts/receipt-corpus/reports`. For before/after comparison, place the receipt
directory from baseline commit `34a2c55d` in an isolated temporary checkout/copy,
then pass its `receiptPhoto.js` path with `--baseline <path>`; do not reset the
working tree. Photographs are not needed for offline replay.

Fresh image runs require separately downloaded licensed images, the existing
local language assets, and the configured Playwright runtime:

```powershell
node scripts/receipt-corpus-ocr.mjs --help
node scripts/receipt-corpus-full-pipeline.mjs --limit 20 --out artifacts/receipt-corpus/ocr/fresh-full-pipeline
```

Image acquisition is intentionally separate from app execution. The model and
parser run on-device; source corpora and benchmark reports are test/dev inputs.
Receipt photographs are still neither uploaded nor persisted as attachments.

## Release validation

146 focused receipt unit tests, the receipt component browser checks at
320/390/1280 in both themes, and the built-calendar browser flow passed.
The actual supplied 151.85 MDL photograph was tested at original size and in
synthetic distant-on-table/hand scenes; each exposed the correct total for
explicit selection. The calendar test covers saving one expense, duplicate
protection, PRO revocation and absence of external OCR requests. These tests do
not replace a physical iPhone/Safari run.

`npm run build` and `git diff --check` passed. Initial validation exposed an
already committed missing brace in `PremiumHistoryAnalytics.jsx` and an outdated
history browser check. Before delivery, the shared branch supplied fixes in
`7f40c97c` plus the records-first history in `8ef83fe3`; both were retained during
rebase. Receipt/history model checks (154 total) and built-calendar receipt save
and history browser checks passed on the combined tree.
