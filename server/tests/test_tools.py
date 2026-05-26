import pytest
from pathlib import Path
from unittest.mock import AsyncMock
from sentinel.tools.code import CodeTools
from sentinel.tools.exec import ExecTools
from sentinel.tools.patch import PatchTools
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
async def test_sibling_prefix_path_escape(tmp_path):
    root = tmp_path / "app"
    sibling = tmp_path / "app2"
    root.mkdir()
    sibling.mkdir()
    (sibling / "secret.py").write_text("hidden")
    result = await CodeTools(root).execute("read_file", {"path": "../app2/secret.py"})
    assert "error" in result


@pytest.mark.asyncio
async def test_search_code(src):
    result = await CodeTools(src).execute("search_code", {"pattern": "unwrap"})
    assert len(result["matches"]) > 0


@pytest.mark.asyncio
async def test_search_code_rejects_glob_escape(tmp_path):
    root = tmp_path / "app"
    sibling = tmp_path / "app2"
    root.mkdir()
    sibling.mkdir()
    (sibling / "secret.py").write_text("unwrap")

    result = await CodeTools(root).execute("search_code", {"pattern": "unwrap", "glob": "../app2/*"})

    assert "error" in result


@pytest.mark.asyncio
async def test_run_command_blocked():
    rt = AsyncMock()
    tools = ExecTools(rt, {"commands": {"test": "pytest"}})
    result = await tools.execute("run_command", {"cmd": "rm -rf /"})
    assert "error" in result


@pytest.mark.asyncio
async def test_run_command_rejects_shell_chaining():
    rt = AsyncMock()
    tools = ExecTools(rt, {"commands": {"test": "pytest"}})
    result = await tools.execute("run_command", {"cmd": "cargo test; rm -rf /"})
    assert "error" in result
    rt.exec.assert_not_called()


@pytest.mark.asyncio
async def test_run_command_rejects_mutating_git():
    rt = AsyncMock()
    tools = ExecTools(rt, {"commands": {"test": "pytest"}})
    result = await tools.execute("run_command", {"cmd": "git checkout HEAD -- src/main.rs"})
    assert "error" in result
    rt.exec.assert_not_called()


@pytest.mark.asyncio
async def test_run_command_allowed():
    rt = AsyncMock()
    rt.exec.return_value = CommandResult(returncode=0, stdout="ok", stderr="")
    tools = ExecTools(rt, {"commands": {"test": "pytest"}})
    result = await tools.execute("run_command", {"cmd": "ls -la"})
    assert result["returncode"] == 0


@pytest.mark.asyncio
async def test_run_tests_rejects_shell_chaining():
    rt = AsyncMock()
    tools = ExecTools(rt, {"commands": {"test": "cargo test"}})
    result = await tools.execute("run_tests", {"test_name": "checkout; rm -rf /"})
    assert "error" in result
    assert result["passed"] is False
    rt.exec.assert_not_called()


@pytest.mark.asyncio
async def test_patch_path_escape(tmp_path):
    root = tmp_path / "app"
    sibling = tmp_path / "app2"
    root.mkdir()
    sibling.mkdir()
    (sibling / "main.py").write_text("old\n")
    tools = PatchTools(None, root)
    result = await tools.execute("write_file", {"file": "../app2/main.py", "content": "new\n"})
    assert result["success"] is False
    assert (sibling / "main.py").read_text() == "old\n"
