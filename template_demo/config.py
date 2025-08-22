#!/usr/bin/env python3
"""
Configuration module for system prompt extraction

Contains default values and settings that match the TypeScript extension behavior.
"""

import os
import platform
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class SystemPromptConfig:
    """Configuration class containing all parameters needed for prompt generation"""
    
    # Core directory and environment settings
    cwd: str = field(default_factory=lambda: str(Path(__file__).parent.parent.absolute()).replace('\\', '/'))
    home_directory: str = field(default_factory=lambda: str(Path.home()).replace('\\', '/'))
    operating_system: str = field(default_factory=lambda: platform.system())
    default_shell: str = field(default_factory=lambda: os.environ.get('SHELL', '/bin/bash' if platform.system() != 'Windows' else 'cmd.exe'))
    
    # Mode and behavior settings
    mode: str = "code"  # Default mode
    supports_computer_use: bool = False
    diff_enabled: bool = True
    partial_reads_enabled: bool = True
    enable_mcp_server_creation: bool = False
    language: str = "en"
    
    # Browser settings
    browser_viewport_size: str = "1024x768"
    
    # Experimental features
    experiments: Dict[str, bool] = field(default_factory=lambda: {
        "morphFastApply": False,
        "multiFileApplyDiff": False,
        "codebaseSearch": True,
        "todoList": True
    })
    
    # Tool and feature settings
    settings: Dict[str, Any] = field(default_factory=lambda: {
        "todoListEnabled": True,
        "enableMcpServerCreation": False
    })
    
    # Custom instructions
    global_custom_instructions: str = ""
    roo_ignore_instructions: str = ""
    
    # Mode configurations - simulating built-in modes
    built_in_modes: List[Dict[str, Any]] = field(default_factory=lambda: [
        {
            "slug": "code",
            "name": "Code",
            "roleDefinition": "You are Open Analyst, an AI coding assistant integrated into VS Code.",
            "description": "A general-purpose coding assistant that can read, write, and edit files.",
            "customInstructions": "",
            "groups": ["edit", "read", "terminal", "browser"]
        },
        {
            "slug": "architect",
            "name": "Architect",
            "roleDefinition": "You are Open Analyst Architect, specialized in high-level software architecture and design.",
            "description": "Focus on system design, architecture documentation, and planning.",
            "customInstructions": "Focus on architectural decisions and documentation. Avoid implementation details.",
            "groups": ["read", "terminal", "architect"]
        }
    ])
    
    # Tool groups - simulating TOOL_GROUPS from TypeScript
    tool_groups: Dict[str, Dict[str, List[str]]] = field(default_factory=lambda: {
        "edit": {
            "tools": ["write_to_file", "apply_diff", "search_and_replace", "insert_content", "edit_file"]
        },
        "read": {
            "tools": ["read_file", "search_files", "list_files", "list_code_definition_names", "codebase_search"]
        },
        "terminal": {
            "tools": ["execute_command"]
        },
        "browser": {
            "tools": ["browser_action"]
        },
        "architect": {
            "tools": ["read_file", "search_files", "list_files"]
        },
        "mcp": {
            "tools": ["use_mcp_tool", "access_mcp_resource"]
        }
    })
    
    # Always available tools
    always_available_tools: List[str] = field(default_factory=lambda: [
        "ask_followup_question",
        "attempt_completion",
        "switch_mode",
        "new_task",
        "fetch_instructions"
    ])
    
    def get_mode_data(self) -> Dict[str, Any]:
        """Get data for the current mode"""
        for mode in self.built_in_modes:
            if mode["slug"] == self.mode:
                return mode
        
        # Fallback to code mode if not found
        return self.built_in_modes[0]
    
    def get_tools_for_mode(self) -> List[str]:
        """Get all tools available for the current mode"""
        mode_data = self.get_mode_data()
        tools = set()
        
        # Add tools from mode's groups
        for group_name in mode_data.get("groups", []):
            if group_name in self.tool_groups:
                for tool in self.tool_groups[group_name]["tools"]:
                    tools.add(tool)
        
        # Add always available tools
        for tool in self.always_available_tools:
            tools.add(tool)
        
        # Apply experimental feature filters
        if not self.experiments.get("morphFastApply", False):
            tools.discard("edit_file")
        
        if not self.experiments.get("codebaseSearch", True):
            tools.discard("codebase_search")
        
        if not self.settings.get("todoListEnabled", True):
            tools.discard("update_todo_list")
        
        return sorted(list(tools))
    
    def is_codebase_search_available(self) -> bool:
        """Check if codebase search feature is available"""
        return self.experiments.get("codebaseSearch", True)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for debugging"""
        return {
            "cwd": self.cwd,
            "mode": self.mode,
            "supports_computer_use": self.supports_computer_use,
            "diff_enabled": self.diff_enabled,
            "experiments": self.experiments,
            "available_tools": self.get_tools_for_mode(),
            "operating_system": self.operating_system,
            "language": self.language
        }


# Default configuration instance
default_config = SystemPromptConfig()


def create_custom_config(**kwargs) -> SystemPromptConfig:
    """Create a custom configuration with overrides"""
    config = SystemPromptConfig()
    
    for key, value in kwargs.items():
        if hasattr(config, key):
            setattr(config, key, value)
        else:
            print(f"Warning: Unknown configuration key: {key}")
    
    return config


def print_config_summary(config: SystemPromptConfig):
    """Print a summary of the current configuration"""
    print("=== System Prompt Configuration ===")
    print(f"Mode: {config.mode}")
    print(f"Working Directory: {config.cwd}")
    print(f"Operating System: {config.operating_system}")
    print(f"Language: {config.language}")
    print(f"Computer Use: {config.supports_computer_use}")
    print(f"Diff Strategy: {'Enabled' if config.diff_enabled else 'Disabled'}")
    print(f"Available Tools: {len(config.get_tools_for_mode())}")
    print(f"Experiments: {list(k for k, v in config.experiments.items() if v)}")
    print("=" * 35)