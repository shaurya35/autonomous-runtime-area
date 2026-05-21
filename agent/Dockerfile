FROM python:3.13-slim

WORKDIR /app

# System packages for bcrypt native extension and docker CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install docker CLI so the agent can run docker-compose commands
RUN curl -fsSL https://get.docker.com | sh || true

# Python deps for the agent
RUN pip install --no-cache-dir \
    httpx \
    pyyaml \
    pydantic \
    websockets \
    anthropic

# Copy the sentinel tool + adapter modules from the server package.
# The build context is the repo root (see docker-compose.yml).
COPY server/sentinel /app/sentinel
COPY agent/main.py agent/protocol.py /app/

# User code is mounted at runtime
VOLUME /workspace

ENV REPO_PATH=/workspace
ENV SENTINEL_API_URL=wss://sentinel.sh

ENTRYPOINT ["python", "main.py"]
