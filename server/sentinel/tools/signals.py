class SignalTools:
    def __init__(self, log_source, metric_source, health_probe):
        self._logs = log_source
        self._metrics = metric_source
        self._health = health_probe

    def definitions(self) -> list[dict]:
        return [
            {
                "name": "read_logs",
                "description": "Tail recent log lines from the app. Use grep to filter by keyword (ERROR, panic, timeout, etc.).",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "since_seconds": {"type": "integer", "default": 60, "description": "How far back to look"},
                        "grep": {"type": "string", "description": "Optional keyword filter"},
                    },
                    "required": [],
                },
            },
            {
                "name": "get_metric",
                "description": "Get current Prometheus metric values. Filter by metric name substring.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Metric name substring (e.g. 'errors', 'http_requests')"},
                        "window_seconds": {"type": "integer", "default": 60},
                    },
                    "required": ["name"],
                },
            },
            {
                "name": "check_health",
                "description": "Run the app health probe and return current status.",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            },
        ]

    async def execute(self, name: str, inputs: dict) -> dict:
        if name == "read_logs":
            lines = await self._logs.tail(since_seconds=inputs.get("since_seconds", 60), grep=inputs.get("grep"))
            return {"logs": [l.model_dump() for l in lines]}
        elif name == "get_metric":
            series = await self._metrics.scrape()
            nf = inputs.get("name", "").lower()
            filtered = [s for s in series if nf in s.name.lower()]
            return {"series": [{"name": s.name, "labels": s.labels,
                                 "latest_value": s.points[-1].value if s.points else None} for s in filtered]}
        elif name == "check_health":
            return (await self._health.check()).model_dump()
        return {"error": f"unknown: {name}"}
