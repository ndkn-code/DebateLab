import importlib
import math
import os
from pathlib import Path
import sys

import numpy as np
from fastapi.testclient import TestClient


os.environ["EMBEDDING_BACKGROUND_WARMUP"] = "false"
os.environ["THINKFY_EMBEDDING_API_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).parents[1]))
embedding_app = importlib.import_module("app")


def normalized_vectors(texts: list[str]) -> np.ndarray:
    value = 1 / math.sqrt(embedding_app.EXPECTED_DIMENSIONS)
    return np.full(
        (len(texts), embedding_app.EXPECTED_DIMENSIONS),
        value,
        dtype=np.float32,
    )


def test_health_and_authenticated_embedding_contract(monkeypatch):
    monkeypatch.setattr(embedding_app, "encode_texts", normalized_vectors)
    client = TestClient(embedding_app.app)

    health = client.get("/healthz")
    assert health.status_code == 200
    assert health.json()["model"] == "AITeamVN/Vietnamese_Embedding"
    assert health.json()["dimensions"] == 1024

    assert client.post("/embed", json={"text": "hello"}).status_code == 401
    response = client.post(
        "/embed",
        json={"texts": ["Xin chào", "Debate evidence"], "input_type": "document"},
        headers={"x-thinkfy-embedding-key": "test-key", "x-request-id": "contract-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "self_hosted"
    assert payload["input_type"] == "document"
    assert payload["dimensions"] == 1024
    assert payload["count"] == 2
    assert payload["request_id"] == "contract-1"
    assert all(len(vector) == 1024 for vector in payload["embeddings"])
    assert all(all(math.isfinite(value) for value in vector) for vector in payload["embeddings"])
    assert all(abs(math.sqrt(sum(value * value for value in vector)) - 1) < 1e-6 for vector in payload["embeddings"])


def test_request_limits_and_exclusive_input_contract(monkeypatch):
    monkeypatch.setattr(embedding_app, "encode_texts", normalized_vectors)
    client = TestClient(embedding_app.app)
    headers = {"x-thinkfy-embedding-key": "test-key"}

    too_many = client.post(
        "/embed",
        json={"texts": ["item"] * (embedding_app.MAX_BATCH_SIZE + 1)},
        headers=headers,
    )
    assert too_many.status_code == 422
    both = client.post(
        "/embed",
        json={"text": "one", "texts": ["two"]},
        headers=headers,
    )
    assert both.status_code == 400


def test_model_load_is_cached_and_preserves_dimension_and_sequence_contract(monkeypatch):
    created = []

    class FakeModel:
        max_seq_length = 0

        def __init__(self, model_id: str):
            created.append(model_id)

        def get_sentence_embedding_dimension(self):
            return embedding_app.EXPECTED_DIMENSIONS

    monkeypatch.setattr(embedding_app, "SentenceTransformer", FakeModel)
    monkeypatch.setattr(embedding_app, "_model", None)
    first = embedding_app.load_model()
    second = embedding_app.load_model()

    assert first is second
    assert created == ["AITeamVN/Vietnamese_Embedding"]
    assert first.max_seq_length == 2048
