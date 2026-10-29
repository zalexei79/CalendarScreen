# Moldovan receipt follow-up — 29 October 2026

The receipt review now saves with one primary button. The redundant “Checked
against photo” checkbox and its state are removed. Recognition still never writes
automatically: saving checks the current account, PRO, required fields and item
arithmetic. Conflicting totals expose short numeric choices; missing date/currency
remain editable. Double-click/network failure/PRO-revocation checks are retained.

## Romanian product names

`romanianProductAliases.js` adds 645 distinct normalized type/alias pairs compared
with `70bc7eb5`. These are manually curated product hints, not new OCR vision
weights or a promise to translate every unknown string. The catalog grows from
98 to 101 stable presentation types: porridge, cottage cheese and mushrooms are
new. Accounting categories are unchanged. Original names and brands remain
available for editing and in the receipt history.

Examples: pâine/piine/pîine → bread; terci → porridge; brânză/brînză de vaci →
cottage cheese; cașcaval → cheese. Prefixes before `cu`/`with` take precedence over
ingredients, so strawberry yogurt stays yogurt, chicken pet food stays pet food,
and a pastry containing cheese stays pastry. Plain powdered milk is distinguished
from infant milk formula. The regression set covers 116 example names both with
and without diacritics plus unknown/ambiguous terms. “pini”, “peni”, “koși”, bare
“coș” and arbitrary fuzzy matches are deliberately not guessed as food.

Terminology and local spelling checks use the retailer's own product listings:

- [Linella dairy translations](https://www.linella.md/public/promotions_pdf/acd58e75184bf736e966e2180fa44501.pdf)
- [Linella grains and legumes](https://linella.md/bacanie/crupe-si-boboase/)
- [Linella fresh cheese](https://linella.md/ro/catalog/branza_proaspata?page=1)
- [Dismarket dairy](https://dismarket.md/ro/catalog/produse-lactate-si-oua/?page=1)
- Dictionary distinctions: [terci](https://dexonline.ro/definitie/terci), [caș](https://www.dex.ro/cas), [coș](https://dexonline.ro/definitie/co%C8%99).

The code is a curated vocabulary, not a copied retailer product database. A
dictionary cannot recover letters absent from the image; unknown text stays
visible instead of being translated into a guessed purchase.

## Distant paper and totals

The supplied screenshot contains TOTAL LEI 44.70. Only the embedded photo rectangle
was used (x97,y276,width405,height539), excluding application labels/buttons.
The previous desktop pipeline already read that crop as 44.70; the original camera
file and physical iPhone runtime were unavailable, so that exact phone failure
cannot be claimed reproduced or universally fixed.

Smaller variants did reproduce failures: at 300px image width, a synthetic hand
beside the paper left no total/candidate. The paper detector was selecting a large
bright piece of textured background. It now rejects broad border-connected
backgrounds and uses the receipt region, including when an edge is obscured.
Small crops can be enlarged up to 6× inside the same 1600×3200 output cap; this is
interpolation, not new image detail.

Total recovery now combines words on the same visual baseline across OCR
paragraphs. A split damaged fraction such as`88. /40` is included in the numeric
crop and reread from pixels; its characters are never guessed into a number, and
dropping the decimal separator is rejected. Observed short TOTAL distortions
such as`TOI LEI`/`TOTAL LE1` need an adjacent currency cue and numeric pixel reads;
they cannot authorize an amount from plain text alone.

Any disagreement with a literal total keeps both amounts for selection, even when
two subsequent numeric reads agree. A correct initial 44.70 must not disappear
because the secondary read produced 44.00. Existing tax/cash/change and document
exclusions remain in force. The 20-photo corpus snapshot remains an old frozen
diagnostic, not a fresh accuracy claim for this release.

In local browser experiments, 44.70 remained recoverable in the photo-only crop
and a 300px variant with a hand. A 220px variant still failed; some correct results
are review candidates, not automatic selections. The date and item letters can
remain wrong or unreadable. No universal photo accuracy or physical Safari pass
is claimed. Source photos and diagnostic artifacts are not checked into Git.

Run the component check and focused receipt unit tests. For the supplied photo
in the built app, set`DAYRIS_RECEIPT_MOLDOVA_SCREEN` to its screenshot path and run
`node tests/receipt-app-ui-check.mjs`; this asserts 44.70 is selected or available,
then corrects date/currency and saves without any checkbox. A synthetic distant
photo/hand check for the earlier 151.85 receipt remains available through
`DAYRIS_RECEIPT_DISTANCE_SAMPLE`.

Validation:154 focused receipt tests and the component browser check passed.
The production-calendar test passed with both supplied screenshots:44.70 was
available for explicit selection in the new crop;151.85 remained recoverable at
original size and in distant table/hand scenes. The44.70 case corrected its
date/currency and persisted exactly one expense using the primary save button.
Mobile390px and desktop1280px results were visually inspected. No complete item
list or accurate date is claimed for the small screenshot crop.
