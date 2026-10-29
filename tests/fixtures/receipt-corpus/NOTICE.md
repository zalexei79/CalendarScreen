# Receipt corpus attribution

These fixtures contain derived public receipt text/annotations and frozen OCR
outputs. No customer photos or private DAYRIS records are included. Original
source photographs remain outside Git in the untracked local artifacts area.

## CORD v2

Copyright NAVER CLOVA / CORD contributors. Source:
https://github.com/clovaai/cord and
https://huggingface.co/datasets/naver-clova-ix/cord-v2 at revision
`7f0115a4b758a71d6473b8d085751692da2fef98`.
Licensed under Creative Commons Attribution 4.0 International:
https://creativecommons.org/licenses/by/4.0/ . The original license text is
included as `LICENSE-CC-BY`.

Changes: projected 1,000 annotations into row text, geometry, role labels and
reference fields; removed duplicate training transcripts; compressed JSONL;
derived local OCR outputs and a small advisory row-role model. CORD's public
release masks merchant names and omits some metadata. It cannot independently
validate merchant extraction. This experiment does not imply creator endorsement.

## ExpressExpense SRD

Receipt-image source and attribution: **ExpressExpense.com**.
https://expressexpense.com/blog/free-receipt-images-ocr-machine-learning-dataset/
The publisher identifies the 200-image dataset as MIT licensed. The downloaded
archive SHA256 is recorded in `manifest.json`. Images are not redistributed here.
`ocr-evaluation.jsonl.gz` includes text and geometry generated locally from 40
of those images; `field-gold.jsonl` contains manually selected field evidence.

## Manual receipt transcriptions

Authors: Manoela Auad, Sarah Alves, Gabriel Kakizaki, Julio Reis and Michel Silva,
MaViLab-UFV, 2024, “A labeled dataset of hand-captured images of restaurant receipts.”
https://github.com/MaVILab-UFV/Filtering-Preparation-for-OCR_SIBGRAPI-2024
at revision `eeca2d823e2eccb4e76688fa010a26514215afc8`.
Dataset record: https://doi.org/10.5281/zenodo.13688441 . The DOI's DataCite
metadata identifies CC BY 4.0:
https://api.datacite.org/dois/10.5281/zenodo.13688441 .

Changes: converted 192 original manual transcripts to compressed JSONL; added
source hashes and manually curated 40 field-calibration records. Empty fields
mean unavailable or ambiguous, never zero. These were not AI-generated labels.

See `manifest.json` for file hashes and [the experiment report](../../../docs/receipt-corpus.md)
for selection rules, reproduction and limitations.
