# System Prompt Extraction Tool

This Python script extracts and reconstructs the complete system prompt that the Open Analyst VS Code extension generates and sends to language models.

## Overview

The Open Analyst extension builds complex system prompts by assembling multiple sections including role definitions, tool descriptions, capabilities, rules, and more. This script simulates that entire process to generate the exact prompt content that would be sent to the LLM.

## Files

- **`run.py`** - Main runner script with command-line interface
- **`extract_system_prompt.py`** - Core extraction logic and orchestration
- **`config.py`** - Configuration management and default settings
- **`section_parsers.py`** - Parsers for reconstructing each prompt section
- **`requirements.txt`** - Python dependencies (uses only standard library)

## Quick Start

```bash
# Basic usage - generate prompt with default settings
python run.py

# Generate for architect mode
python run.py --mode architect

# Enable all experimental features
python run.py --enable-experiments

# Enable browser actions (computer use)
python run.py --enable-computer-use

# Show detailed progress
python run.py --verbose
```

## Generated Files

Running the script creates three output files:

1. **`generated-system-prompt.md`** - The complete system prompt as it would be sent to the LLM
2. **`prompt-analysis.md`** - Detailed breakdown of each section with statistics
3. **`extraction-config.json`** - Configuration parameters used for generation

## Command Line Options

```
--mode {code,architect}     Mode to generate prompt for (default: code)
--enable-computer-use       Enable browser actions and computer use
--enable-diff / --disable-diff  Control diff strategy for file editing
--enable-experiments        Enable all experimental features
--enable-mcp               Enable MCP server tools
--language LANG            Language setting (default: en)
--output-dir DIR           Custom output directory
--verbose                  Show detailed progress
--config-only              Show configuration without generating
--custom-instructions TEXT Add custom global instructions
```

## Example Usage

```bash
# Generate architect mode prompt with experiments
python run.py --mode architect --enable-experiments --verbose

# Generate with custom instructions and MCP enabled
python run.py --enable-mcp --custom-instructions "Focus on security best practices"

# Save to custom directory
python run.py --output-dir ./outputs --enable-computer-use
```

## Configuration

The script uses realistic defaults that match the extension's behavior:

- **Working Directory**: Current project root
- **Default Mode**: `code` (general-purpose coding assistant)
- **Available Tools**: 16 tools including file operations, search, terminal, etc.
- **Experiments**: Codebase search and todo list enabled by default
- **System Info**: Detected OS, shell, and directory information

## Modes

### Code Mode
General-purpose coding assistant with full access to:
- File reading/writing (read_file, write_to_file, apply_diff, etc.)
- Code search and analysis (search_files, codebase_search)
- Terminal operations (execute_command)
- Task management (attempt_completion, ask_followup_question)

### Architect Mode  
Specialized for high-level design and architecture:
- Read-only file access
- Documentation focus
- Restricted editing capabilities
- Architecture-focused instructions

## Generated Content

The extracted system prompt includes:

1. **Role Definition** - AI assistant identity and purpose
2. **Markdown Rules** - Response formatting requirements
3. **Tool Use Instructions** - XML-based tool invocation format
4. **Tool Descriptions** - Detailed specs for all available tools
5. **Capabilities Section** - Overview of assistant abilities
6. **Modes Information** - Available operational modes
7. **Rules and Constraints** - Operating limitations and guidelines
8. **System Information** - Environment details (OS, paths, shell)
9. **Objective Framework** - Task completion methodology
10. **Custom Instructions** - Mode-specific and user customizations

## Technical Details

- **Python Version**: 3.8+ (uses only standard library)
- **Total Prompt Size**: ~25,000 characters for default configuration
- **Processing**: Reconstructs TypeScript logic in Python
- **Output Format**: Markdown with proper formatting and structure

## Verification

The script generates the same logical structure and content as the TypeScript extension code by:

1. Parsing the original section generation functions
2. Reconstructing tool availability based on mode configuration
3. Applying experimental feature flags correctly
4. Maintaining the exact prompt assembly order
5. Preserving all formatting and content rules

## Use Cases

- **Prompt Engineering**: Analyze and optimize system prompts
- **Documentation**: Understand assistant capabilities and constraints
- **Testing**: Verify prompt consistency across different configurations
- **Development**: Debug prompt generation logic
- **Research**: Study LLM instruction patterns and effectiveness