"""CLI tools for managing ontology store builds."""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


def list_builds(output_root: Path) -> None:
    """List all available store builds and identify the active one."""
    current_json = output_root / "current.json"
    active_build = None
    if current_json.exists():
        try:
            active_build = json.loads(current_json.read_text())["build_id"]
        except (json.JSONDecodeError, KeyError):
            pass

    builds_dir = output_root / "builds"
    if not builds_dir.exists():
        print(f"No builds directory found at {builds_dir}")
        return

    print(f"{'BUILD ID':<22} | {'CREATED AT':<30} | {'STATUS'}")
    print("-" * 70)
    for build_path in builds_dir.iterdir():
        if not build_path.is_dir():
            continue
        
        build_id = build_path.name
        manifest_path = build_path / "store-manifest.json"
        
        created_at = "Unknown"
        if manifest_path.exists():
            try:
                metadata = json.loads(manifest_path.read_text())
                created_at = metadata.get("created_at", "Unknown")
            except (json.JSONDecodeError, KeyError):
                pass
                
        status = "ACTIVE" if build_id == active_build else ""
        print(f"{build_id:<22} | {created_at:<30} | {status}")


def backup_build(output_root: Path, build_id: str, archive_path: Path) -> None:
    """Create a zip/tar archive of a specific build directory."""
    build_dir = output_root / "builds" / build_id
    if not build_dir.exists():
        print(f"Error: Build {build_id} not found.")
        sys.exit(1)
        
    archive_format = "zip"
    if str(archive_path).endswith(".tar.gz") or str(archive_path).endswith(".tgz"):
        archive_format = "gztar"
    elif str(archive_path).endswith(".tar"):
        archive_format = "tar"
        
    base_name = str(archive_path)
    for ext in [".zip", ".tar.gz", ".tgz", ".tar"]:
        if base_name.endswith(ext):
            base_name = base_name[:-len(ext)]
            break

    print(f"Backing up build {build_id} to {archive_path}...")
    shutil.make_archive(base_name, archive_format, root_dir=str(build_dir.parent), base_dir=build_id)
    print("Backup complete.")


def restore_build(output_root: Path, archive_path: Path) -> None:
    """Restore a build directory from an archive."""
    if not archive_path.exists():
        print(f"Error: Archive {archive_path} not found.")
        sys.exit(1)
        
    builds_dir = output_root / "builds"
    builds_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Restoring from {archive_path} into {builds_dir}...")
    shutil.unpack_archive(str(archive_path), extract_dir=str(builds_dir))
    print("Restore complete.")


def promote_build(output_root: Path, build_id: str) -> None:
    """Update current.json to point to a valid build directory."""
    build_dir = output_root / "builds" / build_id
    if not build_dir.exists():
        print(f"Error: Build {build_id} not found.")
        sys.exit(1)
        
    manifest_path = build_dir / "store-manifest.json"
    if not manifest_path.exists():
        print(f"Error: Build {build_id} is missing store-manifest.json.")
        sys.exit(1)
        
    try:
        metadata = json.loads(manifest_path.read_text())
        triple_count = metadata.get("triple_count", 0)
    except json.JSONDecodeError:
        print(f"Error: Could not parse store-manifest.json in build {build_id}.")
        sys.exit(1)

    current_json = output_root / "current.json"
    previous_build = None
    if current_json.exists():
        try:
            previous_build = json.loads(current_json.read_text()).get("build_id")
        except json.JSONDecodeError:
            pass

    current_state = {
        "build_id": build_id,
        "path": f"builds/{build_id}",
        "triple_count": triple_count,
    }
    if previous_build and previous_build != build_id:
        current_state["previous_build_id"] = previous_build

    import uuid
    temporary_path = current_json.with_name(f".current.{uuid.uuid4().hex}.tmp")
    temporary_path.write_text(json.dumps(current_state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary_path, current_json)
    
    print(f"Promoted build {build_id} to active.")


def rollback_build(output_root: Path) -> None:
    """Revert current.json to the previous build if recorded."""
    current_json = output_root / "current.json"
    if not current_json.exists():
        print("Error: No active build found.")
        sys.exit(1)
        
    try:
        current_state = json.loads(current_json.read_text())
        previous_build = current_state.get("previous_build_id")
    except json.JSONDecodeError:
        print("Error: Could not parse current.json.")
        sys.exit(1)

    if not previous_build:
        print("Error: No previous build recorded in current.json.")
        sys.exit(1)
        
    print(f"Rolling back to previous build: {previous_build}")
    promote_build(output_root, previous_build)


def main() -> None:
    parser = argparse.ArgumentParser(description="Store lifecycle operations")
    parser.add_argument("--output", type=Path, default=Path(".data/oxigraph"), help="Output root directory")
    
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    _ = subparsers.add_parser("list", help="List available builds")
    
    backup_parser = subparsers.add_parser("backup", help="Backup a build")
    backup_parser.add_argument("build_id", type=str, help="ID of the build to backup")
    backup_parser.add_argument("archive_path", type=Path, help="Path for the backup archive (e.g., backup.zip)")
    
    restore_parser = subparsers.add_parser("restore", help="Restore a build from backup")
    restore_parser.add_argument("archive_path", type=Path, help="Path to the backup archive")
    
    promote_parser = subparsers.add_parser("promote", help="Promote a build to active")
    promote_parser.add_argument("build_id", type=str, help="ID of the build to promote")
    
    _ = subparsers.add_parser("rollback", help="Rollback to the previous active build")
    
    args = parser.parse_args()
    
    if args.command == "list":
        list_builds(args.output)
    elif args.command == "backup":
        backup_build(args.output, args.build_id, args.archive_path)
    elif args.command == "restore":
        restore_build(args.output, args.archive_path)
    elif args.command == "promote":
        promote_build(args.output, args.build_id)
    elif args.command == "rollback":
        rollback_build(args.output)


if __name__ == "__main__":
    main()
