# English debate knowledge release v4

Version 4 is a future draft assembled from the existing official-derived v2
manifest and coaching-video-candidate v3 manifest. Preparing it does not
publish it or make it available to retrieval.

Prepare an attributable draft:

```sh
npm run ai:knowledge-prepare-english-debate-release -w @thinkfy/web -- \
  --collection-version 4 \
  --submitted-by <admin-user-uuid>
```

The submitter must be a real user UUID and cannot perform the independent
review. The combined draft stores paraphrased insights and source locators. It
must not store full transcripts, raw text, or excerpts from videos or manuals.

Before publication, a different reviewer must:

1. Verify each official-derived item against its exact source locator.
2. Verify every video-derived annotation at its timestamp and set its
   `verified` metadata only after that check.
3. Record cleared derived-use rights for every source.
4. Keep video-derived items coaching-only; they cannot become grading evidence.
5. Keep official-derived grading items bound to an official source.
6. Generate embeddings with the collection's current provider, model,
   dimensions, input type, and content hash.

Run the safe preflight after review:

```sh
npm run ai:knowledge-release-preflight -w @thinkfy/web -- \
  --collection debate.en.competitive \
  --version 4
```

Any missing review identity, unresolved rights, unverified video annotation,
purpose mismatch, copied-text marker, stale embedding, answer-key flag, or
source record blocks release. Publication remains a separate administrative
action.
