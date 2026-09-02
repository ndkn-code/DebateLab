# IELTS knowledge release operations

IELTS release preparation creates review-gated drafts only. It requires an
attributable submitter and never publishes automatically:

```sh
npm run ai:knowledge-prepare-ielts-release -w @thinkfy/web -- \
  --collection-version <future-version> \
  --submitted-by <admin-user-uuid>
```

The submitted-by UUID is written to the version, every newly inserted source,
and every item. A different reviewer must approve the source and item, clear
rights, and produce current embeddings before publication can pass preflight.

Purpose policy is fail-closed:

- Official rubric and band-descriptor derivations may be used for grading and
  coaching only after official-source authority, rights, independent approval,
  and current embeddings are verified.
- Official scored-example locators remain coaching-only. They are not answer
  keys or benchmark truth, and candidate response text is not copied.
- DebateLab mock prompts remain coaching-only and contain no answer material.

The admin read model checks the latest real draft version from the database. If
there is no draft, it reports the active release version; it does not assume a
hardcoded corpus version. A missing eligible version disables publication.
