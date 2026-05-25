import os
import time
from threading import Lock
from typing import Literal

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sentence_transformers import SentenceTransformer


MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "AITeamVN/Vietnamese_Embedding")
EXPECTED_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1024"))
MAX_SEQ_LENGTH = int(os.getenv("EMBEDDING_MAX_SEQ_LENGTH", "2048"))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "16"))
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "12000"))
NORMALIZE_EMBEDDINGS = os.getenv("NORMALIZE_EMBEDDINGS", "true").lower() == "true"
API_KEY = os.getenv("THINKFY_EMBEDDING_API_KEY", "")

app = FastAPI(title="Thinkfy Embedding API", version="0.1.0")
_model: SentenceTransformer | None = None
_model_lock = Lock()
_loaded_at: float | None = None


class EmbedRequest(BaseModel):
    text: str | None = None
    texts: list[str] | None = None
    input_type: Literal["document", "query"] = "query"

    @field_validator("text")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("text must not be empty")
        if len(trimmed) > MAX_TEXT_CHARS:
            return trimmed[:MAX_TEXT_CHARS]
        return trimmed

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        if len(value) == 0:
            raise ValueError("texts must not be empty")
        if len(value) > MAX_BATCH_SIZE:
            raise ValueError(f"texts cannot exceed {MAX_BATCH_SIZE} items")
        normalized = []
        for item in value:
            trimmed = item.strip()
            if not trimmed:
                raise ValueError("texts must not contain empty items")
            normalized.append(trimmed[:MAX_TEXT_CHARS])
        return normalized

    def normalized_texts(self) -> list[str]:
        if self.text and self.texts:
            raise HTTPException(status_code=400, detail="Use either text or texts, not both")
        if self.text:
            return [self.text]
        if self.texts:
            return self.texts
        raise HTTPException(status_code=400, detail="Missing text or texts")


def require_api_key(header_value: str | None) -> None:
    if not API_KEY:
        return
    if header_value != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid embedding API key")


def load_model() -> SentenceTransformer:
    global _model, _loaded_at
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            started = time.perf_counter()
            model = SentenceTransformer(MODEL_ID)
            model.max_seq_length = MAX_SEQ_LENGTH
            dimensions = model.get_sentence_embedding_dimension()
            if dimensions != EXPECTED_DIMENSIONS:
                raise RuntimeError(
                    f"Model dimension mismatch: expected {EXPECTED_DIMENSIONS}, got {dimensions}"
                )
            _model = model
            _loaded_at = time.time()
            print(f"Loaded {MODEL_ID} in {time.perf_counter() - started:.2f}s", flush=True)
    return _model


@app.get("/healthz")
def healthz() -> dict:
    return {
        "ok": True,
        "model": MODEL_ID,
        "dimensions": EXPECTED_DIMENSIONS,
        "loaded": _model is not None,
        "loaded_at": _loaded_at,
    }


@app.post("/warmup")
def warmup(x_thinkfy_embedding_key: str | None = Header(default=None)) -> dict:
    require_api_key(x_thinkfy_embedding_key)
    started = time.perf_counter()
    model = load_model()
    embedding = model.encode(
        ["kiểm tra truy xuất ngữ nghĩa tranh biện"],
        normalize_embeddings=NORMALIZE_EMBEDDINGS,
        convert_to_numpy=True,
    )
    return {
        "ok": True,
        "model": MODEL_ID,
        "dimensions": int(embedding.shape[1]),
        "latency_ms": round((time.perf_counter() - started) * 1000),
    }


@app.post("/embed")
async def embed(
    payload: EmbedRequest,
    request: Request,
    x_thinkfy_embedding_key: str | None = Header(default=None),
) -> dict:
    require_api_key(x_thinkfy_embedding_key)
    texts = payload.normalized_texts()
    started = time.perf_counter()
    model = load_model()
    vectors = model.encode(
        texts,
        normalize_embeddings=NORMALIZE_EMBEDDINGS,
        convert_to_numpy=True,
    )
    if not isinstance(vectors, np.ndarray) or vectors.ndim != 2:
        raise HTTPException(status_code=500, detail="Model returned invalid embeddings")
    if vectors.shape[1] != EXPECTED_DIMENSIONS:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding dimension mismatch: expected {EXPECTED_DIMENSIONS}, got {vectors.shape[1]}",
        )
    return {
        "model": MODEL_ID,
        "provider": "self_hosted",
        "input_type": payload.input_type,
        "dimensions": EXPECTED_DIMENSIONS,
        "count": len(texts),
        "embeddings": vectors.astype(float).tolist(),
        "usage": {
            "text_count": len(texts),
            "character_count": sum(len(text) for text in texts),
        },
        "latency_ms": round((time.perf_counter() - started) * 1000),
        "request_id": request.headers.get("x-request-id"),
    }
