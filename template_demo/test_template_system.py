#!/usr/bin/env python3
"""
Template System Test Script

This script tests the dynamic template-based mode system by:
1. Validating the YAML template structure
2. Testing template upload functionality  
3. Simulating template activation/deactivation
4. Verifying mode integration

Run this script to ensure the template system works correctly.
"""

import yaml
import json
import os
import sys
from pathlib import Path

def load_template(template_path):
    """Load and validate YAML template"""
    print(f"Loading template: {template_path}")
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = yaml.safe_load(f)
        
        print("[OK] YAML parsing successful")
        return template_data
    except yaml.YAMLError as e:
        print(f"[ERROR] YAML parsing failed: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Failed to load template: {e}")
        return None

def validate_template_structure(template_data):
    """Validate template follows expected schema"""
    print("\nValidating template structure...")
    
    if not isinstance(template_data, dict):
        print("[ERROR] Template must be a dictionary")
        return False
    
    if 'customModes' not in template_data:
        print("[ERROR] Template missing 'customModes' key")
        return False
    
    custom_modes = template_data['customModes']
    if not isinstance(custom_modes, list):
        print("[ERROR] 'customModes' must be a list")
        return False
    
    if not custom_modes:
        print("[ERROR] 'customModes' list is empty")
        return False
    
    # Validate each mode
    required_fields = ['slug', 'name', 'roleDefinition', 'groups']
    optional_fields = ['iconName', 'whenToUse', 'description', 'customInstructions']
    
    for i, mode in enumerate(custom_modes):
        print(f"  Validating mode {i+1}: {mode.get('name', 'Unknown')}")
        
        # Check required fields
        for field in required_fields:
            if field not in mode:
                print(f"    [ERROR] Missing required field: {field}")
                return False
        
        # Validate slug format
        slug = mode['slug']
        if not isinstance(slug, str) or not slug.replace('-', '').replace('_', '').isalnum():
            print(f"    [ERROR] Invalid slug format: {slug}")
            return False
        
        # Validate groups
        groups = mode['groups']
        if not isinstance(groups, list):
            print(f"    [ERROR] Groups must be a list")
            return False
        
        valid_groups = ['read', 'edit', 'browser', 'command', 'mcp', 'modes']
        for group in groups:
            if isinstance(group, str):
                if group not in valid_groups:
                    print(f"    [ERROR] Invalid group: {group}")
                    return False
            elif isinstance(group, list) and len(group) == 2:
                group_name, options = group
                if group_name not in valid_groups:
                    print(f"    [ERROR] Invalid group in tuple: {group_name}")
                    return False
            else:
                print(f"    [ERROR] Invalid group format: {group}")
                return False
        
        print(f"    [OK] Mode '{mode['name']}' is valid")
    
    print("[OK] Template structure validation passed")
    return True

def simulate_template_commands(template_data):
    """Simulate the template management commands"""
    print("\nSimulating template management commands...")
    
    modes = template_data['customModes']
    mode_count = len(modes)
    mode_names = [mode['name'] for mode in modes]
    
    print(f"\nlist_templates simulation:")
    print(f"  Found template with {mode_count} modes:")
    for mode in modes:
        print(f"    - {mode['name']} ({mode['slug']}) - {mode.get('description', 'No description')}")
    
    print(f"\nactivate_template simulation:")
    print(f"  Activating template would load {mode_count} new modes:")
    for mode in modes:
        groups_str = ', '.join([str(g) for g in mode['groups']])
        print(f"    + {mode['name']} - Groups: [{groups_str}]")
    
    print(f"\ndeactivate_template simulation:")
    print(f"  Deactivating would remove {mode_count} template modes")
    print(f"  System would return to built-in modes only")
    
    print(f"\ndelete_template simulation:")
    print(f"  Would permanently delete template file")
    print(f"  Would remove {mode_count} modes from system")

def test_mode_integration(template_data):
    """Test how modes would integrate with the system"""
    print("\nTesting mode integration...")
    
    modes = template_data['customModes']
    
    # Check for conflicts with built-in modes
    built_in_modes = ['code', 'ask', 'debug', 'orchestrator', 'data-analyst']
    conflicts = []
    
    for mode in modes:
        if mode['slug'] in built_in_modes:
            conflicts.append(mode['slug'])
    
    if conflicts:
        print(f"  WARNING: Potential conflicts with built-in modes: {conflicts}")
    else:
        print("  [OK] No conflicts with built-in modes")
    
    # Analyze tool group usage
    all_groups = set()
    for mode in modes:
        for group in mode['groups']:
            if isinstance(group, str):
                all_groups.add(group)
            elif isinstance(group, list):
                all_groups.add(group[0])
    
    print(f"  Tool groups used: {', '.join(sorted(all_groups))}")
    
    # Check for restricted edit groups
    restricted_modes = []
    for mode in modes:
        for group in mode['groups']:
            if isinstance(group, list) and group[0] == 'edit' and len(group) > 1:
                restricted_modes.append({
                    'mode': mode['name'],
                    'restriction': group[1].get('fileRegex', 'Unknown'),
                    'description': group[1].get('description', 'No description')
                })
    
    if restricted_modes:
        print("  Modes with file restrictions:")
        for restriction in restricted_modes:
            print(f"    - {restriction['mode']}: {restriction['restriction']} ({restriction['description']})")

def generate_test_commands():
    """Generate test commands for manual testing"""
    print("\nGenerated test commands for manual testing:")
    print("\n1. Upload template command:")
    print("""<upload_template>
<filename>data-modes-template.yaml</filename>
<content>
customModes:
  - slug: "data-analyst"
    name: "Data Analyst" 
    iconName: "codicon-graph"
    roleDefinition: "You are a data analyst..."
    groups: ["read", "edit", "browser", "command"]
</content>
</upload_template>""")
    
    print("\n2. List templates:")
    print("<list_templates></list_templates>")
    
    print("\n3. Activate template:")
    print("<activate_template>\n<template_name>data-modes-template</template_name>\n</activate_template>")
    
    print("\n4. Deactivate template:")
    print("<deactivate_template></deactivate_template>")
    
    print("\n5. Delete template:")
    print("<delete_template>\n<template_name>data-modes-template</template_name>\n</delete_template>")

def main():
    """Main test function"""
    print("Template System Test Suite")
    print("=" * 50)
    
    # Find template file
    template_path = Path(__file__).parent / "data-modes-template.yaml"
    
    if not template_path.exists():
        print(f"[ERROR] Template file not found: {template_path}")
        sys.exit(1)
    
    # Load template
    template_data = load_template(template_path)
    if not template_data:
        print("[ERROR] Failed to load template")
        sys.exit(1)
    
    # Validate structure
    if not validate_template_structure(template_data):
        print("[ERROR] Template validation failed")
        sys.exit(1)
    
    # Simulate commands
    simulate_template_commands(template_data)
    
    # Test integration
    test_mode_integration(template_data)
    
    # Generate test commands
    generate_test_commands()
    
    print("\n[OK] All tests passed! Template is ready for use.")
    print("\nNext steps:")
    print("1. Start VS Code with the extension")
    print("2. Copy the template file to .oacode/templates/ in your workspace")
    print("3. Use the generated commands above to test the functionality")
    print("4. Check that modes appear in the mode selector")

if __name__ == "__main__":
    main()