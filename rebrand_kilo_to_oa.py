#!/usr/bin/env python3
"""
Comprehensive Kilo → OA Rebranding Script
==========================================

This script systematically replaces "kilo" with "OA" throughout the entire codebase
while preserving functionality and maintaining all references.

Features:
- Smart case preservation
- File and directory renaming
- Reference tracking and updating
- Backup and rollback capabilities
- Dry-run mode for safe testing
- Build verification

Usage:
    python rebrand_kilo_to_oa.py --dry-run    # Preview changes
    python rebrand_kilo_to_oa.py --execute    # Apply changes
    python rebrand_kilo_to_oa.py --rollback   # Restore from backup
"""

import os
import re
import shutil
import json
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple, Set
from datetime import datetime
import logging

# Configuration
OLD_BRAND = "kilo"
NEW_BRAND = "OA"
BACKUP_DIR = "backup_before_rebrand"
LOG_FILE = "rebrand_log.txt"

# Files and directories to exclude from processing
EXCLUDE_PATTERNS = [
    r'\.git',
    r'node_modules',
    r'\.turbo',
    r'dist',
    r'build',
    r'out',
    r'bin',
    r'\.vscode',
    r'coverage',
    r'__pycache__',
    r'\.pytest_cache',
    backup_dir := BACKUP_DIR,
    LOG_FILE,
    r'rebrand_kilo_to_oa\.py',
    r'\.png$',
    r'\.jpg$',
    r'\.gif$',
    r'\.ico$',
    r'\.ttf$',
    r'\.woff$',
    r'\.woff2$',
    r'\.eot$',
    r'\.svg$',  # Some SVGs might need processing, but many are binary-like
]

# File extensions that should have their content processed
PROCESSABLE_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml', 
    '.txt', '.css', '.scss', '.less', '.html', '.xml', '.sh', '.bat',
    '.ps1', '.py', '.rb', '.php', '.java', '.cs', '.cpp', '.c', '.h',
    '.hpp', '.rs', '.go', '.sql', '.toml', '.ini', '.cfg', '.conf',
    '.gitignore', '.nvmrc', '.editorconfig', '.prettierrc', '.eslintrc'
}

class KiloToOARebrandingTool:
    def __init__(self, root_path: str, dry_run: bool = True):
        self.root_path = Path(root_path).resolve()
        self.dry_run = dry_run
        self.backup_path = self.root_path / BACKUP_DIR
        self.changes_log = []
        self.file_renames = {}  # old_path -> new_path mapping
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.root_path / LOG_FILE, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def should_exclude(self, path: Path) -> bool:
        """Check if a path should be excluded from processing."""
        path_str = str(path.relative_to(self.root_path))
        for pattern in EXCLUDE_PATTERNS:
            if re.search(pattern, path_str):
                return True
        return False
    
    def get_case_variations(self, text: str) -> List[Tuple[str, str]]:
        """Generate all case variations for replacement."""
        variations = [
            # Basic variations
            (text.lower(), NEW_BRAND.lower()),
            (text.upper(), NEW_BRAND.upper()),
            (text.capitalize(), NEW_BRAND.capitalize()),
            
            # CamelCase variations
            (f"{text.lower()}Code", f"{NEW_BRAND}Code"),
            (f"{text.capitalize()}Code", f"{NEW_BRAND}Code"),
            (f"{text.lower()}code", f"{NEW_BRAND}code"),
            
            # Kebab-case variations  
            (f"{text.lower()}-code", f"{NEW_BRAND.lower()}-code"),
            (f"{text.capitalize()}-Code", f"{NEW_BRAND}-Code"),
            
            # Snake_case variations
            (f"{text.lower()}_code", f"{NEW_BRAND.lower()}_code"),
            (f"{text.lower()}_change", f"{NEW_BRAND.lower()}_change"),
            
            # Special compound words
            (f"{text.lower()}Languages", f"{NEW_BRAND}Languages"),
            (f"{text.capitalize()}Languages", f"{NEW_BRAND}Languages"),
            
            # Directory/file naming patterns
            (f"{text.lower()}code", f"{NEW_BRAND.lower()}code"),
            (f".{text.lower()}code", f".{NEW_BRAND.lower()}code"),
        ]
        
        return variations
    
    def create_backup(self):
        """Create a complete backup of the codebase."""
        if self.dry_run:
            self.logger.info(f"[DRY RUN] Would create backup at: {self.backup_path}")
            return
            
        if self.backup_path.exists():
            shutil.rmtree(self.backup_path)
            
        self.logger.info(f"Creating backup at: {self.backup_path}")
        
        # Copy everything except excluded directories
        self.backup_path.mkdir(exist_ok=True)
        
        for item in self.root_path.iterdir():
            if item.name == BACKUP_DIR:
                continue
            if self.should_exclude(item):
                continue
                
            dest = self.backup_path / item.name
            if item.is_dir():
                shutil.copytree(item, dest, ignore=shutil.ignore_patterns(*[p.replace('\\', '') for p in EXCLUDE_PATTERNS if not p.startswith(r'\.')]))
            else:
                shutil.copy2(item, dest)
    
    def restore_from_backup(self):
        """Restore the codebase from backup."""
        if not self.backup_path.exists():
            self.logger.error("No backup found to restore from!")
            return False
            
        self.logger.info("Restoring from backup...")
        
        # Remove current files (except backup)
        for item in self.root_path.iterdir():
            if item.name == BACKUP_DIR or item.name == LOG_FILE:
                continue
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        
        # Restore from backup
        for item in self.backup_path.iterdir():
            dest = self.root_path / item.name
            if item.is_dir():
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)
                
        self.logger.info("Restore completed successfully!")
        return True
    
    def find_files_to_rename(self) -> List[Tuple[Path, Path]]:
        """Find all files and directories that need to be renamed."""
        renames = []
        
        # Walk through all files and directories
        for root, dirs, files in os.walk(self.root_path):
            root_path = Path(root)
            
            if self.should_exclude(root_path):
                dirs.clear()  # Don't recurse into excluded directories
                continue
            
            # Check directories for renaming (process in reverse order for nested renames)
            for dirname in reversed(dirs):
                if OLD_BRAND.lower() in dirname.lower():
                    old_dir_path = root_path / dirname
                    new_dirname = self.rename_string(dirname)
                    new_dir_path = root_path / new_dirname
                    if old_dir_path != new_dir_path:
                        renames.append((old_dir_path, new_dir_path))
            
            # Check files for renaming
            for filename in files:
                if OLD_BRAND.lower() in filename.lower():
                    old_file_path = root_path / filename
                    if self.should_exclude(old_file_path):
                        continue
                    new_filename = self.rename_string(filename)
                    new_file_path = root_path / new_filename
                    if old_file_path != new_file_path:
                        renames.append((old_file_path, new_file_path))
        
        return renames
    
    def rename_string(self, text: str) -> str:
        """Apply all case-preserving renames to a string."""
        result = text
        for old_pattern, new_pattern in self.get_case_variations(OLD_BRAND):
            result = result.replace(old_pattern, new_pattern)
        return result
    
    def rename_files_and_directories(self):
        """Rename all files and directories containing 'kilo'."""
        renames = self.find_files_to_rename()
        
        if not renames:
            self.logger.info("No files or directories need renaming.")
            return
        
        self.logger.info(f"Found {len(renames)} files/directories to rename")
        
        # Sort by depth (deepest first) to avoid issues with nested renames
        renames.sort(key=lambda x: len(str(x[0]).split(os.sep)), reverse=True)
        
        for old_path, new_path in renames:
            relative_old = old_path.relative_to(self.root_path)
            relative_new = new_path.relative_to(self.root_path)
            
            self.file_renames[str(relative_old)] = str(relative_new)
            
            if self.dry_run:
                self.logger.info(f"[DRY RUN] Would rename: {relative_old} -> {relative_new}")
                continue
            
            try:
                # Ensure parent directory exists
                new_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Rename the file/directory
                old_path.rename(new_path)
                self.logger.info(f"Renamed: {relative_old} -> {relative_new}")
                self.changes_log.append(f"RENAME: {relative_old} -> {relative_new}")
                
            except Exception as e:
                self.logger.error(f"Failed to rename {relative_old}: {e}")
    
    def update_file_content(self, file_path: Path) -> bool:
        """Update the content of a single file."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            self.logger.warning(f"Could not read {file_path}: {e}")
            return False
        
        original_content = content
        
        # Apply case-preserving replacements
        for old_pattern, new_pattern in self.get_case_variations(OLD_BRAND):
            content = content.replace(old_pattern, new_pattern)
        
        # Update import/require paths for renamed files
        content = self.update_import_paths(content)
        
        # Special handling for specific file types
        if file_path.name == 'package.json':
            content = self.update_package_json(content)
        
        if content != original_content:
            if self.dry_run:
                changes = sum(1 for a, b in zip(original_content, content) if a != b)
                self.logger.info(f"[DRY RUN] Would update {file_path.relative_to(self.root_path)} ({changes} character changes)")
                return True
            
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.logger.info(f"Updated content: {file_path.relative_to(self.root_path)}")
                self.changes_log.append(f"CONTENT: {file_path.relative_to(self.root_path)}")
                return True
            except Exception as e:
                self.logger.error(f"Failed to write {file_path}: {e}")
                return False
        
        return False
    
    def update_import_paths(self, content: str) -> str:
        """Update import/require paths for renamed files."""
        result = content
        
        for old_path, new_path in self.file_renames.items():
            # Convert Windows paths to forward slashes for imports
            old_import = old_path.replace('\\', '/')
            new_import = new_path.replace('\\', '/')
            
            # Remove file extensions for TypeScript/JavaScript imports
            for ext in ['.ts', '.tsx', '.js', '.jsx']:
                if old_import.endswith(ext):
                    old_import = old_import[:-len(ext)]
                    new_import = new_import[:-len(ext)]
                    break
            
            # Update various import/require patterns
            patterns = [
                (f"from '{old_import}'", f"from '{new_import}'"),
                (f'from "{old_import}"', f'from "{new_import}"'),
                (f"import('{old_import}')", f"import('{new_import}')"),
                (f'import("{old_import}")', f'import("{new_import}")'),
                (f"require('{old_import}')", f"require('{new_import}')"),
                (f'require("{old_import}")', f'require("{new_import}")'),
                (f"'../{old_import}'", f"'../{new_import}'"),
                (f'"../{old_import}"', f'"../{new_import}"'),
                (f"'./{old_import}'", f"'./{new_import}'"),
                (f'"./{old_import}"', f'"./{new_import}"'),
            ]
            
            for old_pattern, new_pattern in patterns:
                result = result.replace(old_pattern, new_pattern)
        
        return result
    
    def update_package_json(self, content: str) -> str:
        """Special handling for package.json files."""
        try:
            data = json.loads(content)
            
            # Update common package.json fields
            fields_to_update = ['name', 'displayName', 'description', 'publisher']
            
            for field in fields_to_update:
                if field in data and isinstance(data[field], str):
                    data[field] = self.rename_string(data[field])
            
            # Update scripts, dependencies, etc.
            for section in ['scripts', 'dependencies', 'devDependencies', 'peerDependencies']:
                if section in data and isinstance(data[section], dict):
                    updated_section = {}
                    for key, value in data[section].items():
                        new_key = self.rename_string(key)
                        new_value = self.rename_string(str(value)) if isinstance(value, str) else value
                        updated_section[new_key] = new_value
                    data[section] = updated_section
            
            return json.dumps(data, indent='\t', ensure_ascii=False)
            
        except json.JSONDecodeError:
            # Fallback to string replacement if JSON parsing fails
            return self.rename_string(content)
    
    def process_all_files(self):
        """Process all files in the codebase."""
        processed_count = 0
        updated_count = 0
        
        for root, dirs, files in os.walk(self.root_path):
            root_path = Path(root)
            
            if self.should_exclude(root_path):
                dirs.clear()
                continue
            
            for filename in files:
                file_path = root_path / filename
                
                if self.should_exclude(file_path):
                    continue
                
                # Check if file should be processed based on extension
                if file_path.suffix.lower() not in PROCESSABLE_EXTENSIONS and not file_path.name.startswith('.'):
                    continue
                
                processed_count += 1
                if self.update_file_content(file_path):
                    updated_count += 1
        
        self.logger.info(f"Processed {processed_count} files, updated {updated_count} files")
    
    def verify_build(self) -> bool:
        """Verify that the project still builds after changes."""
        if self.dry_run:
            self.logger.info("[DRY RUN] Would verify build with: pnpm lint && pnpm check-types")
            return True
        
        self.logger.info("Verifying build...")
        
        try:
            # Run linting
            result = subprocess.run(['pnpm', 'lint'], 
                                  cwd=self.root_path, 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=300)
            
            if result.returncode != 0:
                self.logger.error(f"Linting failed: {result.stderr}")
                return False
            
            # Run type checking
            result = subprocess.run(['pnpm', 'check-types'], 
                                  cwd=self.root_path, 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=300)
            
            if result.returncode != 0:
                self.logger.error(f"Type checking failed: {result.stderr}")
                return False
            
            self.logger.info("Build verification successful!")
            return True
            
        except subprocess.TimeoutExpired:
            self.logger.error("Build verification timed out")
            return False
        except Exception as e:
            self.logger.error(f"Build verification failed: {e}")
            return False
    
    def generate_report(self):
        """Generate a summary report of all changes."""
        report_path = self.root_path / "rebrand_report.txt"
        
        report_content = f"""
Kilo → OA Rebranding Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Mode: {'DRY RUN' if self.dry_run else 'EXECUTED'}

=== Summary ===
Total file renames: {len(self.file_renames)}
Total content changes: {len([c for c in self.changes_log if c.startswith('CONTENT:')])}

=== File Renames ===
{chr(10).join(f"{old} -> {new}" for old, new in self.file_renames.items())}

=== All Changes ===
{chr(10).join(self.changes_log)}
"""
        
        if not self.dry_run:
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write(report_content)
        
        print(report_content)
    
    def run_rebranding(self):
        """Execute the complete rebranding process."""
        self.logger.info(f"Starting {'DRY RUN' if self.dry_run else 'EXECUTION'} of Kilo -> OA rebranding")
        self.logger.info(f"Root path: {self.root_path}")
        
        try:
            # Step 1: Create backup (only if not dry run)
            if not self.dry_run:
                self.create_backup()
            
            # Step 2: Rename files and directories
            self.logger.info("=== Phase 1: Renaming files and directories ===")
            self.rename_files_and_directories()
            
            # Step 3: Update file contents
            self.logger.info("=== Phase 2: Updating file contents ===")
            self.process_all_files()
            
            # Step 4: Verify build (only if not dry run)
            if not self.dry_run:
                self.logger.info("=== Phase 3: Verifying build ===")
                if not self.verify_build():
                    self.logger.error("Build verification failed! Consider rolling back.")
                    return False
            
            # Step 5: Generate report
            self.logger.info("=== Phase 4: Generating report ===")
            self.generate_report()
            
            self.logger.info("Rebranding completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"Rebranding failed: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Rebrand Kilo Code to OpenAnalyst")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', help='Preview changes without applying them')
    group.add_argument('--execute', action='store_true', help='Apply the rebranding changes')
    group.add_argument('--rollback', action='store_true', help='Restore from backup')
    
    parser.add_argument('--root', default='.', help='Root directory of the project (default: current directory)')
    
    args = parser.parse_args()
    
    tool = KiloToOARebrandingTool(args.root, dry_run=not args.execute)
    
    if args.rollback:
        return tool.restore_from_backup()
    else:
        return tool.run_rebranding()

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)