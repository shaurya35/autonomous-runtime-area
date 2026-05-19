import json
from datetime import datetime, timezone

from flask import Flask, jsonify, request

app = Flask(__name__)

_metrics = {"http_requests_total": {}, "errors_total": 0, "divide_calls_total": 0}


def _log(level: str, msg: str, **extra):
    print(json.dumps({"ts": datetime.now(timezone.utc).isoformat(), "level": level, "message": msg, **extra}), flush=True)


@app.after_request
def log_req(response):
    _log("INFO", "request", path=request.path, status=response.status_code)
    key = f'{{"path":"{request.path}","status":"{response.status_code}"}}'
    _metrics["http_requests_total"][key] = _metrics["http_requests_total"].get(key, 0) + 1
    return response


@app.get("/")
def index():
    return jsonify({"status": "ok", "app": "sample-app"})


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok", "checks": {"self": "ok"}})


@app.get("/metrics")
def metrics():
    lines = ["# HELP http_requests_total Total requests", "# TYPE http_requests_total counter"]
    for labels, count in _metrics["http_requests_total"].items():
        lines.append(f"http_requests_total{labels} {count}")
    lines += [f"errors_total {_metrics['errors_total']}", f"divide_calls_total {_metrics['divide_calls_total']}"]
    return "\n".join(lines) + "\n", 200, {"Content-Type": "text/plain; version=0.0.4"}


@app.get("/divide")
def divide():
    _metrics["divide_calls_total"] += 1
    a = request.args.get("a", "0")
    b = request.args.get("b", "1")
    # BUG: no check for b == 0
    result = int(a) / int(b)
    return jsonify({"result": result})


@app.errorhandler(Exception)
def handle_error(e):
    _metrics["errors_total"] += 1
    _log("ERROR", str(e), path=request.path)
    return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
