#!/usr/bin/env python3
"""
Template System Testing Flow

This script provides step-by-step testing instructions and validation
for the dynamic template-based mode system.
"""

import yaml
import json
import os
import sys
from pathlib import Path

def print_header(title):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_step(step_num, title):
    """Print a formatted step"""
    print(f"\nStep {step_num}: {title}")
    print("-" * 40)

def validate_yaml_template(file_path):
    """Validate YAML template and show its contents"""
    print(f"Validating: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        print("[OK] YAML is valid")
        
        modes = data.get('customModes', [])
        print(f"Found {len(modes)} modes:")
        
        for i, mode in enumerate(modes, 1):
            print(f"  {i}. {mode.get('name', 'Unnamed')} ({mode.get('slug', 'no-slug')})")
            print(f"     Description: {mode.get('description', 'No description')}")
            print(f"     Groups: {mode.get('groups', [])}")
        
        return True
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False

def generate_upload_command(template_path):
    """Generate upload command for a template"""
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        filename = os.path.basename(template_path)
        
        return f"""<upload_template>
<filename>{filename}</filename>
<content>{content}</content>
</upload_template>"""
    except Exception as e:
        return f"Error reading template: {e}"

def main():
    """Main testing flow"""
    print_header("TEMPLATE SYSTEM TESTING FLOW")
    
    # Step 1: Validate templates
    print_step(1, "Validate Template Files")
    
    template_dir = Path(__file__).parent
    yaml_files = list(template_dir.glob("*.yaml"))
    
    if not yaml_files:
        print("[ERROR] No YAML template files found in current directory")
        return
    
    valid_templates = []
    for template_file in yaml_files:
        if validate_yaml_template(template_file):
            valid_templates.append(template_file)
        print()
    
    if not valid_templates:
        print("[ERROR] No valid templates found")
        return
    
    # Step 2: Test Commands
    print_step(2, "Test Command Generation")
    
    print("Generated test commands:")
    print("\n" + "="*50)
    print("COPY THESE COMMANDS TO TEST IN VS CODE:")
    print("="*50)
    
    for template_file in valid_templates:
        template_name = template_file.stem
        print(f"\nCommands for {template_name}:")
        print(f"{'-'*40}")
        
        # Upload command
        print(f"\nUPLOAD TEMPLATE:")
        upload_cmd = generate_upload_command(template_file)
        print(upload_cmd)
        
        # List command  
        print(f"\nLIST TEMPLATES:")
        print("<list_templates></list_templates>")
        
        # Activate command
        print(f"\nACTIVATE TEMPLATE:")
        print(f"<activate_template>\n<template_name>{template_name}</template_name>\n</activate_template>")
        
        # Deactivate command
        print(f"\nDEACTIVATE TEMPLATE:")
        print("<deactivate_template></deactivate_template>")
        
        # Delete command
        print(f"\nDELETE TEMPLATE:")
        print(f"<delete_template>\n<template_name>{template_name}</template_name>\n</delete_template>")
        
        print("\n" + "-"*40)
    
    # Step 3: Testing Instructions
    print_step(3, "Manual Testing Instructions")
    
    instructions = """
    COMPLETE TESTING CHECKLIST:
    
    Pre-Test Setup:
    [] Ensure VS Code extension is running with latest changes
    [] Open a workspace (any folder)
    [] Open the chat interface
    
    Template Upload Test:
    [] Copy one of the upload commands above
    [] Paste into chat and send
    [] Verify success message appears
    [] Check that .oacode/templates/ directory was created
    [] Verify template file exists in the directory
    
    Template List Test:  
    [] Send: <list_templates></list_templates>
    [] Verify template appears in the list
    [] Check mode count and descriptions are correct
    
    Template Activation Test:
    [] Send activate_template command
    [] Verify success message appears
    [] Check mode selector UI - new modes should appear
    [] Try switching to a template mode
    [] Verify template mode works (send a test message)
    
    UI Template Selector Test:
    [] Look for template selector dropdown in chat interface  
    [] Try selecting different templates from dropdown
    [] Verify modes update in real-time
    
    Template Deactivation Test:
    [] Send deactivate_template command
    [] Verify success message appears
    [] Check mode selector - template modes should disappear
    [] Only built-in modes should remain
    
    Template Deletion Test:
    [] Send delete_template command
    [] Confirm deletion when prompted
    [] Verify template is removed from list
    [] Check .oacode/templates/ - file should be gone
    
    Error Handling Tests:
    [] Try activating non-existent template
    [] Try deleting non-existent template  
    [] Upload invalid YAML and verify error handling
    [] Test template with duplicate mode slugs
    
    Persistence Test:
    [] Activate a template
    [] Restart VS Code
    [] Verify template remains active after restart
    [] Check that template modes are still available
    """
    
    print(instructions)
    
    # Step 4: Expected Results
    print_step(4, "Expected Results Summary")
    
    results = """
    EXPECTED BEHAVIOR:
    
    Upload: Template file created in .oacode/templates/
    List: Shows available templates with mode counts
    Activate: New modes appear in mode selector
    Deactivate: Template modes disappear
    Delete: Template file removed permanently
    UI: Template selector allows real-time switching
    Persistence: Active template survives restart
    
    POTENTIAL ISSUES TO WATCH FOR:
    
    - Templates not appearing in mode selector
    - Mode selector not updating after template changes
    - Template modes not working correctly
    - File watching not triggering updates
    - Persistence not working across restarts
    - Error messages not appearing for invalid operations
    """
    
    print(results)
    
    print_step(5, "Debugging Tips")
    
    debug_tips = """
    DEBUGGING CHECKLIST:
    
    Check Console Logs:
    [] Open VS Code Developer Tools (Help > Toggle Developer Tools)
    [] Look for [TemplateModeLoader] and [TemplateManager] log messages
    [] Check for any error messages or warnings
    
    Verify File System:
    [] Check .oacode/templates/ directory exists
    [] Verify YAML files are properly formatted
    [] Ensure file permissions allow read/write
    
    Test Component Integration:
    [] Verify TemplateManager is initialized in ClineProvider
    [] Check webview message handlers are responding
    [] Confirm mode loading system is calling template loader
    
    Common Issues:
    [] Template file parsing errors (check YAML syntax)
    [] Mode selector not refreshing (check state updates)
    [] File watcher not working (check directory permissions)
    [] WebView communication failing (check message handlers)
    """
    
    print(debug_tips)
    
    print_header("READY TO TEST!")
    print("Copy the commands above and test them in VS Code")
    print("Use the debugging tips if you encounter issues")  
    print("Follow the checklist to ensure complete testing")

if __name__ == "__main__":
    main()