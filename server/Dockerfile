FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    patch \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://get.docker.com | sh || true
RUN pip install --no-cache-dir uv

COPY . .
RUN uv pip install --system -e "."

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
