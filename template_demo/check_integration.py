#!/usr/bin/env python3
"""
Simple Integration Check Script
"""

import os
import sys
from pathlib import Path

def check_file_exists(file_path, description):
    """Check if a file exists and report result"""
    path = Path(file_path)
    if path.exists():
        print(f"[OK] {description}")
        return True
    else:
        print(f"[MISSING] {description}: {path}")
        return False

def main():
    """Main validation function"""
    print("TEMPLATE SYSTEM INTEGRATION CHECK")
    print("=" * 50)
    
    base_path = Path(__file__).parent.parent
    
    # Check key files
    checks = [
        (base_path / "src/shared/templateModeLoader.ts", "Template Mode Loader"),
        (base_path / "src/core/config/TemplateManager.ts", "Template Manager"),
        (base_path / "src/core/tools/uploadTemplateTool.ts", "Upload Template Tool"),
        (base_path / "webview-ui/src/components/oacode/TemplateSelector.tsx", "Template Selector"),
    ]
    
    all_exist = True
    print("\nChecking core files...")
    for file_path, description in checks:
        if not check_file_exists(file_path, description):
            all_exist = False
    
    # Check template files
    demo_path = Path(__file__).parent
    print("\nChecking template files...")
    template_files = [
        (demo_path / "data-modes-template.yaml", "Data Modes Template"),
        (demo_path / "simple-test-template.yaml", "Simple Test Template"),
    ]
    
    for file_path, description in template_files:
        if not check_file_exists(file_path, description):
            all_exist = False
    
    print("\n" + "=" * 50)
    if all_exist:
        print("SUCCESS: All files found!")
        print("\nNext steps:")
        print("1. Run: python test_flow.py")
        print("2. Build extension: npm run build")
        print("3. Test in VS Code")
    else:
        print("FAILURE: Some files are missing")
    
    return all_exist

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)