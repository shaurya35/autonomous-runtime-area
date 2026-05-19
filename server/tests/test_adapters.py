import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sentinel.adapters.logs.docker import _parse_line
from sentinel.adapters.logs.file import FileLogSource
from sentinel.adapters.metrics.prometheus import _parse_text
from sentinel.adapters.health.http import HttpHealthProbe


def test_parse_line_error():
    assert _parse_line("2024-01-01T00:00:00Z ERROR crash").level == "ERROR"


def test_parse_line_info():
    assert _parse_line("2024-01-01T00:00:00Z request ok").level == "INFO"


def test_parse_prometheus():
    text = 'http_requests_total{path="/",status="200"} 42\nerrors_total 5\n'
    series = _parse_text(text)
    names = [s.name for s in series]
    assert "http_requests_total" in names
    assert "errors_total" in names


@pytest.mark.asyncio
async def test_file_log_missing(tmp_path):
    src = FileLogSource(str(tmp_path / "missing.log"))
    lines = await src.tail()
    assert lines[0].level == "ERROR"


@pytest.mark.asyncio
async def test_file_log_reads(tmp_path):
    log = tmp_path / "app.log"
    log.write_text("INFO ok\nERROR bad\n")
    src = FileLogSource(str(log))
    lines = await src.tail()
    assert len(lines) == 2
    assert any(l.level == "ERROR" for l in lines)


@pytest.mark.asyncio
async def test_health_probe_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "ok"}
    with patch("httpx.AsyncClient") as mc:
        mc.return_value.__aenter__ = AsyncMock(return_value=mc.return_value)
        mc.return_value.__aexit__ = AsyncMock(return_value=False)
        mc.return_value.get = AsyncMock(return_value=mock_resp)
        status = await HttpHealthProbe("http://localhost/healthz").check()
    assert status.healthy is True
