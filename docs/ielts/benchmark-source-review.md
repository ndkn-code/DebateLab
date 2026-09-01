# IELTS benchmark source review

This ledger records source-level release decisions for the protected IELTS
grading benchmark. It is not a corpus manifest and contains no learner
responses or gold labels. The protected importer remains the enforcement point.

## Acceptance rule

A grading-authoritative source needs all of the following:

- official IELTS or qualified-human-examiner provenance;
- commercial-use-compatible rights, or explicit written permission;
- the actual response artifact and all four criterion scores;
- a stable source locator and checksum;
- privacy/de-identification review;
- one source-level split, so related examples cannot leak across development
  and evaluation.

Holistic scores, CEFR conversions, AI-generated labels, marketing claims, and
descriptions of unavailable data are insufficient.

## Reviewed candidates

| Source | Decision | Evidence and reason |
| --- | --- | --- |
| [EWCCE-DATA](https://data.mendeley.com/datasets/cd874w6g5k/1), DOI `10.17632/cd874w6g5k.1` | Rejected until corrected by publisher | The repository describes two-instructor scoring across four IELTS criteria and uses CC BY 4.0. The published 105,136,916-byte archive matched SHA-256 `60bf639d2afeb3620ab252bb1000642547d66e1be373287414461a00f650aba7`, but inspection found only 200 response PDFs and no criterion-label file. It therefore cannot provide reproducible ground truth. |
| [Expert-Annotated IELTS Writing Corpus](https://doi.org/10.5281/zenodo.15811905) | Not approved for product use | The record claims four trait scores, but the license is CC BY-NC-SA 4.0 and therefore does not authorize DebateLab's commercial product use without additional permission. AI-assisted feedback is also not accepted as gold rationale without case-level human verification. |
| [Speak & Improve Corpus 2025](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025) | Research reference only | High-quality L2 audio with human holistic CEFR-like scores, but it is licensed for non-commercial research and does not supply the four IELTS Speaking criterion labels required by the gate. |
| Public IELTS research reports and band descriptors | Rubric/retrieval evidence only | These are authoritative for scale interpretation. Public reports may contain aggregate or transcript examples, but without a licensed response artifact plus all four case-level criterion labels they cannot independently populate the protected benchmark. |
| Public YouTube/Kaggle IELTS compilations | Coaching-only candidate material | Publisher/examiner authority, participant consent, redistribution rights, or human criterion-label provenance is incomplete. They must never be imported as grading ground truth. |

## Open release dependencies

- Obtain a writing source with the actual four criterion labels and complete its
  privacy review; the EWCCE authors may be asked to publish the omitted score
  sheet under the existing CC BY record.
- Obtain a commercially usable Speaking set containing audio, prompt, all four
  human criterion scores, and accent metadata. Public holistic/CEFR corpora do
  not meet this requirement.
- Keep `IELTS_EVIDENCE_ADJUDICATION_ENABLED=false` until the source-separated
  benchmark is imported, evaluated, and passes the pinned release gate.
