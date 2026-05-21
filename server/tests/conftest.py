import os

# Existing unit tests boot the FastAPI app via TestClient and don't need a real
# API key or Docker daemon. Skip the lifespan preflight for them. The E2E test
# (test_e2e.py) explicitly unsets this before booting.
os.environ.setdefault("SENTINEL_SKIP_PREFLIGHT", "1")
