---
title: Thinkfy Embedding API
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
---

# Thinkfy Embedding API

Private Hugging Face/Oracle-compatible embedding service for Thinkfy debate corpus retrieval.

## Endpoints

- `GET /healthz` public health check.
- `POST /warmup` loads the model and embeds a tiny Vietnamese query.
- `POST /embed` accepts `text` or `texts` and returns 1024-dimensional embeddings.

Set `THINKFY_EMBEDDING_API_KEY` to require `X-Thinkfy-Embedding-Key` for `/warmup` and `/embed`.

## Environment

```text
EMBEDDING_MODEL_ID=AITeamVN/Vietnamese_Embedding
EMBEDDING_DIMENSIONS=1024
EMBEDDING_MAX_SEQ_LENGTH=2048
THINKFY_EMBEDDING_API_KEY=...
MAX_BATCH_SIZE=16
MAX_TEXT_CHARS=12000
NORMALIZE_EMBEDDINGS=true
```
