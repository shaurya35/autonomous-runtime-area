import pytest
from pathlib import Path
from unittest.mock import AsyncMock
from sentinel.tools.code import CodeTools
from sentinel.tools.exec import ExecTools
from sentinel.models import CommandResult


@pytest.fixture
def src(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("def foo():\n    x = None\n    return x.unwrap()\n")
    return tmp_path


@pytest.mark.asyncio
async def test_list_files(src):
    result = await CodeTools(src).execute("list_files", {})
    assert any("main.py" in f for f in result["files"])


@pytest.mark.asyncio
async def test_read_file(src):
    result = await CodeTools(src).execute("read_file", {"path": "src/main.py"})
    assert "unwrap" in result["content"]


@pytest.mark.asyncio
async def test_path_escape(src):
    result = await CodeTools(src).execute("read_file", {"path": "../../etc/passwd"})
    assert "error" in result


@pytest.mark.asyncio
async def test_search_code(src):
    result = await CodeTools(src).execute("search_code", {"pattern": "unwrap"})
    assert len(result["matches"]) > 0


@pytest.mark.asyncio
async def test_run_command_blocked():
    rt = AsyncMock()
    tools = ExecTools(rt, {"commands": {"test": "pytest"}})
    result = await tools.execute("run_command", {"cmd": "rm -rf /"})
    assert "error" in result


@pytest.mark.asyncio
async def test_run_command_allowed():
    rt = AsyncMock()
    rt.exec.return_value = CommandResult(returncode=0, stdout="ok", stderr="")
    tools = ExecTools(rt, {"commands": {"test": "pytest"}})
    result = await tools.execute("run_command", {"cmd": "ls -la"})
    assert result["returncode"] == 0
