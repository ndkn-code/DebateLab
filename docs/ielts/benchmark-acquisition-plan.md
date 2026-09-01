# IELTS examiner benchmark acquisition

This is the acquisition path for the locked IELTS Speaking/Writing benchmark.
It is not a source list for learner-facing retrieval. Exa research reviewed 180
result slots across official data-access, assessment-research, examiner, and
Vietnam partnership routes. No public downloadable dataset met the commercial
rights, IELTS-criterion, audio, independent-double-marking, and adjudication
requirements together.

## Required partnership

Use two independently accountable parties:

1. A language-assessment research centre designs the overlap matrix,
   adjudication, many-facet Rasch analysis, fairness slices, and locked holdout.
2. A current official IELTS partner/test centre verifies and recruits currently
   certified examiners. Self-attested “former examiner” profiles do not satisfy
   the provenance contract.

Evidence-backed enquiry routes:

- [IELTS joint-funded research](https://ielts.org/researchers/funding-and-awards/research-funding)
  is the official long-horizon research route, but is not an immediate
  commercial procurement channel and does not guarantee data access.
- [Cambridge research data/material requests](https://www.cambridgeenglish.org/Images/554694-requests-for-data.pdf)
  may support qualified academic research under a written agreement; it does
  not grant commercial product rights by default.
- [Cambridge English Assessment Services](https://www.cambridgeenglish.org/consultancy/our-expertise/assessment-services/)
  offers bespoke assessment review and validation. A contract must explicitly
  confirm examiner recruitment, commercial evaluation rights, and that no
  official IELTS endorsement is implied.
- [CRELLA](https://www.beds.ac.uk/crella/our-research/) and the
  [University of Melbourne Language Testing Research Centre](https://arts.unimelb.edu.au/language-testing-research-centre)
  have directly relevant language-assessment validation experience. Neither
  public page promises a current IELTS examiner panel, so recruitment and
  credential verification remain separate.
- [British Council Vietnam](https://www.britishcouncil.vn/en/about/contact) is
  an official local enquiry route. Its public page does not offer benchmark
  scoring, so any participation must be negotiated and documented.
- [IDP examiner recruitment](https://ielts.idp.com/about/ielts-for-teachers/ielts-examiner-jobs-recruitment-training)
  describes the official test-centre recruitment/certification route. An IDP
  marketing or registration partnership must not be represented as examiner or
  scoring authorization.

## Locked sample design

The release gate requires at least 15 independent artifacts in every released
half-band × task type × criterion cell. One response supplies four criterion
labels, but it counts once per cell regardless of repeated imports.

- Writing: Bands 4–9 in half-band increments across Academic Task 1, General
  Training Task 1, and Task 2. This is at least 495 distinct locked responses.
- Speaking: Bands 4–9 in half-band increments across Parts 1–3, repeated for
  every represented accent group. Each record includes L1 and audio-quality
  strata. Full-test recordings and any derived part artifacts must preserve
  candidate/source isolation; the same artifact hash cannot be counted twice.
- At least two blind, independent current qualified examiner marks for all four
  criteria. A third examiner adjudicates any criterion or overall difference
  greater than 0.5 and every important boundary crossing.
- Preserve original marks, pseudonymous rater identity, credential-verification
  record, rubric version, timestamps, adjudication rationale, final label, and
  immutable artifact checksum.
- Split by candidate, prompt/task family, and source before any development,
  retrieval, prompt example, or tuning use. The holdout never enters retrieval.

## Rights and privacy

- Before any scored run, the locked manifest records `modelInputSha256`: the
  canonical SHA-256 of the exact centralized-core `{task,messages}` request
  built from the protected artifact, prompt, rubric, and deterministic
  preprocessing. The provider audit derives the same digest from the request
  it actually sends and signs the artifact/request/output binding with an
  executor-only secret, preventing the service-role importer from fabricating
  or relabelling benchmark calls after the fact.
- Use DebateLab-authored prompts and newly consented responses.
- Evaluation use and model-training use are separate consent choices.
- Consent covers commercial AI evaluation, human review, voice
  re-identification risk, storage/processing jurisdictions, retention, deletion,
  and future versioned re-evaluation.
- Prefer adults. Minors require guardian consent, learner assent, safeguarding
  review, and shorter retention.
- Pseudonymize before rater access; encrypt audio/text; log access; execute DPAs
  with the study lead, examiner supplier, transcription/acoustic providers, and
  model providers.
- Contractually prohibit secure/current IELTS task use, response redistribution,
  and claims that DebateLab produces an official IELTS score.

## Public data rejection record

- [Speak & Improve 2025](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)
  and [Write & Improve 2024](https://researchdatasets.cambridge.org/datasets/write-and-improve-corpus-2024)
  are useful research corpora but do not provide the required commercial,
  operational-IELTS, four-criterion gold labels.
- Public Hugging Face/Kaggle IELTS datasets found in the search lacked adequate
  examiner provenance, commercial rights, or source integrity.
- CEFR learner corpora cannot substitute for IELTS criterion labels.

The new grader stays disabled until the acquired holdout passes the repository's
release gate. Public official examples may inform methodology or preliminary
research but cannot prove examiner-equivalent accuracy by themselves.
