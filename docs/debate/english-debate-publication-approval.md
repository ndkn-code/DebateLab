# English debate collection publication approval

**Collection:** `debate.en.competitive`  
**Reviewed manifest:** `ai-knowledge-english-debate-official.v2.json`  
**Decision date:** 2026-09-01  
**Decision owner:** DebateLab product owner  
**Required independent reviewer:** Unassigned  
**Production decision:** **Not yet approved**  
**Controlled staging decision:** **Approved for non-learner-facing review only**

This record deliberately separates three different questions:

1. **Is the material useful and correctly sourced?** Yes, subject to the source-by-source checks below.
2. **May DebateLab test it privately in staging?** Yes, while it remains inactive and unavailable to learner grading or coaching.
3. **May DebateLab publish it in a commercial learner-facing product?** Not until the rights holder or a documented legal review clears each source and a second person independently approves the derived items.

The database release gate must remain the final control. No person should bypass it by editing `rightsStatus`, `reviewStatus`, reviewer identity, or collection activation directly.

## Scope of this decision

Included for controlled review:

- Five official sources from WSDC, WUDC, ESU, and NSDA.
- Fifteen short, DebateLab-authored structured insights.
- Source links and section/page locators.
- No copied PDF text, transcript, or permitted excerpt.

Excluded:

- `ai-knowledge-english-debate-video-candidates.v3.json`.
- Full or partial YouTube transcripts.
- AI-generated claims that have not been checked directly against the source.
- Any claim that DebateLab, its scoring, or its coaching is endorsed by WSDC, WUDC, ESU, or NSDA.

The video collection remains `candidate`, coaching-only, and unpublished until a human verifies every timestamp and insight and the relevant usage rights are cleared.

## Review result

| Gate | Result | Evidence or required action |
|---|---|---|
| Official-source provenance | Pass | Each item has a canonical publisher URL and source locator. |
| Derived-only storage | Pass | The manifest stores paraphrased structured insights and no source excerpt. |
| Format isolation | Pass | WSDC, WUDC/BP, ESU Schools' Mace, and NSDA rules are labelled so one format is not silently applied to another. |
| Source-version record | Pass with follow-up | WSDC rules and the Ottawa WUDC 2027 manual are versioned; each publication must pin the reviewed source checksum. |
| Technical schema and release controls | Pass | Existing tests require cleared rights and an independent reviewer before activation. |
| Rights for commercial derived use | **Pending** | Public availability is not the same as permission for commercial reuse. Obtain written permission or a documented legal basis for each publisher. |
| Independent content review | **Pending** | A reviewer other than the importer must compare every insight with its cited section and approve or reject it. |
| Learner-facing publication | **Blocked** | Both pending gates must pass first. |

## Source-by-source approval register

| Publisher / material | Current status | Permission route | Publication action |
|---|---|---|---|
| WSDC — Adjudicators' Briefing and Tournament Rules | `requires_review` | WSDC Board, `board@wsdcdebating.org` | Request permission for commercial use of derived paraphrases; do not reproduce the PDFs. |
| WUDC — current Debating & Judging Manual | `requires_review` | WUDC Executive, `wudc.exec@gmail.com` | Ask the rights owner/council to confirm the permitted use and required attribution. |
| ESU — Schools' Mace Judging Guide | `requires_review` | ESU Education team, `education@esu.org` | DebateLab's release policy requires written permission or a documented legal basis before production use; ESU materials are marked all-rights-reserved. |
| NSDA — How to Judge World Schools Debate | `requires_review` | NSDA, `info@speechanddebate.org` | Ask for written permission and attribution requirements. |

If a publisher declines or does not respond, replace that source with a DebateLab-authored rubric based on independently understood debating principles and have counsel confirm that it does not reproduce protected expression. Do not silently treat non-response as permission.

## Permission request

**Subject:** Permission request for derived debate-education guidance in DebateLab

Hello,

DebateLab is an English/Vietnamese learning application that helps students practise competitive debating. We would like permission to use the following material as a reference when creating short, original, structured coaching and adjudication guidance:

- **Material:** `[title and exact URL]`
- **Publisher:** `[publisher]`
- **Proposed use:** a commercial educational web application available to learners in Vietnam and potentially other countries.

We would not reproduce or distribute the source document, a transcript, or substantial excerpts. We would store only independently written paraphrases of rules or judging principles, together with the source title, publisher, URL, version, and section/page locator. The material may inform automated practice feedback and coaching, but DebateLab would not claim that the publisher endorses our product or that our feedback is an official tournament adjudication.

Please confirm whether you authorize this derived use and tell us:

1. the exact material and versions covered;
2. whether use in paid/commercial learner features is permitted;
3. the required attribution wording and link;
4. whether short quotations are permitted, and their limits;
5. whether translated Vietnamese paraphrases are permitted;
6. whether permission has a time limit or can be withdrawn; and
7. the name and role of the person granting permission.

We are happy to share the exact derived items for review before publication.

Thank you,

DebateLab

## Independent reviewer checklist

The independent reviewer must not be the person who imported or authored the item. For every source and item, the reviewer records their account identity and review time and confirms:

- the publisher, title, URL, edition, and source locator are correct;
- the insight is a faithful paraphrase and does not add a rule the source does not contain;
- no protected excerpt or transcript has been copied into the item;
- the format, speaker role, scoring rule, and limitations are correctly labelled;
- the insight is appropriate for `grading`, `coaching`, or both;
- the written permission or legal review covers this precise use;
- the collection does not imply endorsement or official status; and
- the source checksum matches the version reviewed.

Approval must be performed through the knowledge administration contract so the database records a different `submitted_by` and `reviewed_by` identity. A spreadsheet, chat message, or manifest edit alone is not publication approval.

## Publication procedure

1. Keep version 2 inactive and unavailable to runtime retrieval.
2. Import it only into an isolated staging project with every source and item still marked `needs_review` / `requires_review`.
3. Obtain and archive a written permission record or a documented legal review for each publisher.
4. Have the independent reviewer verify each item against the immutable source version.
5. Update rights only to the exact status supported by the evidence: normally `approved_for_derived_use`; use `approved_for_excerpt` only when the permission explicitly allows excerpts.
6. Run the release preflight. It must reject missing rights, missing reviewer identity, or reviewer/importer identity equality.
7. Run format-isolation, provenance, retrieval, and adversarial grading tests in staging.
8. Activate a new immutable collection version. Never modify the meaning of an already published item in place.
9. Retain the preceding version and a kill switch so production can roll back without losing learner records.

## Final sign-off

Production publication requires all four signatures/records:

- **Rights evidence owner:** confirms every source is cleared for the precise commercial derived use.
- **Independent debate reviewer:** confirms accuracy and correct format application.
- **Engineering release owner:** confirms preflight, retrieval isolation, tests, rollback, and monitoring.
- **Product owner:** authorizes learner-facing activation after reviewing the preceding evidence.

As of 2026-09-01, the first two records are missing. Therefore this collection is arranged and technically reviewed, but production publication is not approved.
