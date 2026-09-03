FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/data/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/data/sentence-transformers \
    PORT=7860

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.7.1 \
    && python -m pip install --no-cache-dir -r requirements.txt

RUN groupadd --system app \
    && useradd --system --gid app --create-home app \
    && mkdir -p /data/huggingface /data/sentence-transformers \
    && chown -R app:app /app /data

COPY --chown=app:app app.py .

EXPOSE 7860

USER app

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]
