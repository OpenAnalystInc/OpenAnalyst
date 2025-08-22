#!/usr/bin/env python3
"""
Integration Validation Script

This script checks that all components of the template system
are properly integrated and ready for testing.
"""

import os
import sys
from pathlib import Path

def check_file_exists(file_path, description):
    """Check if a file exists and report result"""
    path = Path(file_path)
    if path.exists():
        print(f"✅ {description}: {path}")
        return True
    else:
        print(f"❌ {description}: {path} (NOT FOUND)")
        return False

def check_directory_structure():
    """Validate the project directory structure"""
    print("Building: Checking Directory Structure...")
    
    base_path = Path(__file__).parent.parent
    checks = [
        # Core template system files
        (base_path / "src/shared/templateModeLoader.ts", "Template Mode Loader"),
        (base_path / "src/core/config/TemplateManager.ts", "Template Manager"),
        
        # Tool files
        (base_path / "src/core/tools/uploadTemplateTool.ts", "Upload Template Tool"),
        (base_path / "src/core/tools/listTemplatesTool.ts", "List Templates Tool"),
        (base_path / "src/core/tools/activateTemplateTool.ts", "Activate Template Tool"),
        (base_path / "src/core/tools/deactivateTemplateTool.ts", "Deactivate Template Tool"),
        (base_path / "src/core/tools/deleteTemplateTool.ts", "Delete Template Tool"),
        
        # Tool descriptions
        (base_path / "src/core/prompts/tools/upload-template.ts", "Upload Template Description"),
        (base_path / "src/core/prompts/tools/list-templates.ts", "List Templates Description"),
        (base_path / "src/core/prompts/tools/activate-template.ts", "Activate Template Description"),
        (base_path / "src/core/prompts/tools/deactivate-template.ts", "Deactivate Template Description"),
        (base_path / "src/core/prompts/tools/delete-template.ts", "Delete Template Description"),
        
        # UI components
        (base_path / "webview-ui/src/components/oacode/TemplateSelector.tsx", "Template Selector Component"),
        
        # Type definitions
        (base_path / "packages/types/src/mode.ts", "Mode Types"),
        (base_path / "packages/types/src/tool.ts", "Tool Types"),
        
        # Core integration points
        (base_path / "src/core/webview/ClineProvider.ts", "Cline Provider"),
        (base_path / "src/core/webview/webviewMessageHandler.ts", "Message Handler"),
        (base_path / "src/core/assistant-message/presentAssistantMessage.ts", "Assistant Message Handler"),
        (base_path / "src/shared/modes.ts", "Modes System"),
        (base_path / "src/shared/tools.ts", "Tools System"),
        (base_path / "src/shared/WebviewMessage.ts", "Webview Messages"),
        (base_path / "src/shared/ExtensionMessage.ts", "Extension Messages"),
    ]
    
    all_exist = True
    for file_path, description in checks:
        if not check_file_exists(file_path, description):
            all_exist = False
    
    return all_exist

def check_template_files():
    """Check template files in demo directory"""
    print("\n📄 Checking Template Files...")
    
    demo_path = Path(__file__).parent
    template_files = [
        (demo_path / "data-modes-template.yaml", "Comprehensive Data Modes Template"),
        (demo_path / "simple-test-template.yaml", "Simple Test Template"),
    ]
    
    all_exist = True
    for file_path, description in template_files:
        if not check_file_exists(file_path, description):
            all_exist = False
    
    return all_exist

def check_code_integration():
    """Check key integration points in the code"""
    print("\n🔗 Checking Code Integration...")
    
    base_path = Path(__file__).parent.parent
    
    # Check if TemplateManager is imported in ClineProvider
    cline_provider_path = base_path / "src/core/webview/ClineProvider.ts"
    if cline_provider_path.exists():
        content = cline_provider_path.read_text(encoding='utf-8')
        if "TemplateManager" in content:
            print("✅ TemplateManager imported in ClineProvider")
        else:
            print("❌ TemplateManager NOT imported in ClineProvider")
            return False
    
    # Check if template tools are registered in tools system
    tools_path = base_path / "src/shared/tools.ts" 
    if tools_path.exists():
        content = tools_path.read_text(encoding='utf-8')
        template_tools = ["upload_template", "list_templates", "activate_template", "deactivate_template", "delete_template"]
        missing_tools = []
        for tool in template_tools:
            if f'"{tool}"' not in content:
                missing_tools.append(tool)
        
        if not missing_tools:
            print("✅ All template tools registered in tools system")
        else:
            print(f"❌ Missing template tools: {missing_tools}")
            return False
    
    # Check if tool descriptions are registered
    tools_index_path = base_path / "src/core/prompts/tools/index.ts"
    if tools_index_path.exists():
        content = tools_index_path.read_text(encoding='utf-8')
        if "getUploadTemplateDescription" in content:
            print("✅ Template tool descriptions registered")
        else:
            print("❌ Template tool descriptions NOT registered")
            return False
    
    # Check if message handlers are added
    message_handler_path = base_path / "src/core/webview/webviewMessageHandler.ts"
    if message_handler_path.exists():
        content = message_handler_path.read_text(encoding='utf-8')
        if "getTemplateList" in content:
            print("✅ Template message handlers added")
        else:
            print("❌ Template message handlers NOT added")
            return False
    
    # Check if TemplateSelector is added to ChatTextArea
    chat_textarea_path = base_path / "webview-ui/src/components/chat/ChatTextArea.tsx"
    if chat_textarea_path.exists():
        content = chat_textarea_path.read_text(encoding='utf-8')
        if "TemplateSelector" in content:
            print("✅ TemplateSelector integrated in ChatTextArea")
        else:
            print("❌ TemplateSelector NOT integrated in ChatTextArea")
            return False
    
    return True

def generate_build_command():
    """Generate build command for testing"""
    print("\n🔨 Build Command:")
    print("To build the extension for testing:")
    print("  cd to project root")
    print("  npm run build  # or pnpm build")
    print("  F5 in VS Code to launch extension host")

def main():
    """Main validation function"""
    print("🔍 TEMPLATE SYSTEM INTEGRATION VALIDATION")
    print("=" * 60)
    
    all_checks_pass = True
    
    # Check directory structure
    if not check_directory_structure():
        all_checks_pass = False
    
    # Check template files
    if not check_template_files():
        all_checks_pass = False
    
    # Check code integration
    if not check_code_integration():
        all_checks_pass = False
    
    print("\n" + "=" * 60)
    
    if all_checks_pass:
        print("✅ ALL INTEGRATION CHECKS PASSED!")
        print("\n🚀 System is ready for testing!")
        print("\nNext steps:")
        print("1. Build the extension (npm run build)")
        print("2. Launch VS Code extension host (F5)")
        print("3. Run the test flow: python test_flow.py")
        print("4. Follow the manual testing checklist")
        
        generate_build_command()
        
    else:
        print("❌ SOME INTEGRATION CHECKS FAILED!")
        print("\n🔧 Please fix the missing components before testing")
        print("Review the error messages above and ensure all files are properly created and integrated")
    
    return all_checks_pass

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)