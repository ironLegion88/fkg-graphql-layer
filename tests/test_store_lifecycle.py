import json
import tarfile
import zipfile
from pathlib import Path
from unittest.mock import patch
import pytest

from ingestion.lifecycle import list_builds, backup_build, restore_build, promote_build, rollback_build


def test_backup_and_restore(tmp_path: Path):
    output_root = tmp_path / ".data/oxigraph"
    builds_dir = output_root / "builds"
    
    # Create fake build
    build_id = "test-build-123"
    build_dir = builds_dir / build_id
    build_dir.mkdir(parents=True, exist_ok=True)
    
    (build_dir / "store-manifest.json").write_text(json.dumps({"triple_count": 42}))
    (build_dir / "data.txt").write_text("fake store data")
    
    archive_path = tmp_path / "backup.zip"
    backup_build(output_root, build_id, archive_path)
    
    assert archive_path.exists()
    
    # Verify contents
    with zipfile.ZipFile(archive_path) as z:
        assert f"{build_id}/store-manifest.json" in z.namelist()
        assert f"{build_id}/data.txt" in z.namelist()
        
    # Test restore
    restore_root = tmp_path / "restore_test"
    restore_build(restore_root, archive_path)
    
    restored_dir = restore_root / "builds" / build_id
    assert restored_dir.exists()
    assert (restored_dir / "data.txt").read_text() == "fake store data"


def test_promote_and_rollback(tmp_path: Path):
    output_root = tmp_path / ".data/oxigraph"
    builds_dir = output_root / "builds"
    
    # Create two builds
    build1_id = "test-build-1"
    build1_dir = builds_dir / build1_id
    build1_dir.mkdir(parents=True, exist_ok=True)
    (build1_dir / "store-manifest.json").write_text(json.dumps({"triple_count": 10}))
    
    build2_id = "test-build-2"
    build2_dir = builds_dir / build2_id
    build2_dir.mkdir(parents=True, exist_ok=True)
    (build2_dir / "store-manifest.json").write_text(json.dumps({"triple_count": 20}))
    
    # Promote build 1
    promote_build(output_root, build1_id)
    current_json = output_root / "current.json"
    assert current_json.exists()
    
    current_state = json.loads(current_json.read_text())
    assert current_state["build_id"] == build1_id
    assert current_state["triple_count"] == 10
    
    # Promote build 2
    promote_build(output_root, build2_id)
    current_state = json.loads(current_json.read_text())
    assert current_state["build_id"] == build2_id
    assert current_state["triple_count"] == 20
    assert current_state["previous_build_id"] == build1_id
    
    # Rollback to build 1
    rollback_build(output_root)
    current_state = json.loads(current_json.read_text())
    assert current_state["build_id"] == build1_id
    
    # Another rollback toggles back to build 2
    rollback_build(output_root)
    current_state = json.loads(current_json.read_text())
    assert current_state["build_id"] == build2_id
