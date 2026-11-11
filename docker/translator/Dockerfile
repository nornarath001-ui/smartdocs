FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=15 HF_HOME=/models/hf HF_HUB_DISABLE_TELEMETRY=1
RUN --mount=type=cache,target=/root/.cache/pip pip install ctranslate2 sentencepiece
RUN --mount=type=cache,target=/root/.cache/pip pip install transformers huggingface_hub fastapi "uvicorn[standard]"
COPY app.py .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
