#!/usr/bin/env python3
"""
Runner script for system prompt extraction

This script provides a convenient way to run the system prompt extraction
with different configurations and options.
"""

import sys
import os
import argparse
from pathlib import Path
from typing import Dict, Any

# Add the current directory to the Python path to import our modules
sys.path.insert(0, str(Path(__file__).parent))

try:
    from config import SystemPromptConfig, create_custom_config, print_config_summary
    from extract_system_prompt import SystemPromptExtractor
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure all required files are in the same directory:")
    print("  - config.py")
    print("  - extract_system_prompt.py")
    print("  - section_parsers.py")
    sys.exit(1)


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Extract and generate the complete system prompt used by Open Analyst",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py                           # Use default configuration
  python run.py --mode architect          # Use architect mode
  python run.py --enable-computer-use     # Enable browser actions
  python run.py --enable-experiments      # Enable all experimental features
  python run.py --output-dir ./outputs    # Custom output directory
  python run.py --verbose                 # Show detailed progress
        """
    )
    
    parser.add_argument(
        "--mode",
        choices=["code", "architect"],
        default="code",
        help="The mode to generate the system prompt for (default: code)"
    )
    
    parser.add_argument(
        "--enable-computer-use",
        action="store_true",
        help="Enable computer use capabilities (browser actions)"
    )
    
    parser.add_argument(
        "--enable-diff",
        action="store_true",
        default=True,
        help="Enable diff strategy for file editing (default: True)"
    )
    
    parser.add_argument(
        "--disable-diff",
        action="store_true",
        help="Disable diff strategy for file editing"
    )
    
    parser.add_argument(
        "--enable-experiments",
        action="store_true",
        help="Enable all experimental features"
    )
    
    parser.add_argument(
        "--enable-mcp",
        action="store_true",
        help="Enable MCP server creation and tools"
    )
    
    parser.add_argument(
        "--language",
        default="en",
        help="Language setting (default: en)"
    )
    
    parser.add_argument(
        "--output-dir",
        type=str,
        help="Directory to save output files (default: same as script)"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show verbose output during generation"
    )
    
    parser.add_argument(
        "--config-only",
        action="store_true",
        help="Only show configuration without generating prompt"
    )
    
    parser.add_argument(
        "--custom-instructions",
        type=str,
        help="Add custom global instructions to the prompt"
    )
    
    return parser.parse_args()


def setup_output_directory(output_dir: str = None) -> Path:
    """Setup and return the output directory"""
    if output_dir:
        output_path = Path(output_dir)
    else:
        output_path = Path(__file__).parent
    
    # Create directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)
    
    return output_path


def create_config_from_args(args) -> SystemPromptConfig:
    """Create configuration from command line arguments"""
    config_overrides = {
        "mode": args.mode,
        "supports_computer_use": args.enable_computer_use,
        "language": args.language,
        "enable_mcp_server_creation": args.enable_mcp
    }
    
    # Handle diff strategy
    if args.disable_diff:
        config_overrides["diff_enabled"] = False
    elif args.enable_diff:
        config_overrides["diff_enabled"] = True
    
    # Handle experiments
    if args.enable_experiments:
        config_overrides["experiments"] = {
            "morphFastApply": True,
            "multiFileApplyDiff": True,
            "codebaseSearch": True,
            "todoList": True
        }
    
    # Handle custom instructions
    if args.custom_instructions:
        config_overrides["global_custom_instructions"] = args.custom_instructions
    
    return create_custom_config(**config_overrides)


def main():
    """Main function"""
    print("=== Open Analyst System Prompt Extractor ===\n")
    
    # Parse arguments
    args = parse_arguments()
    
    # Create configuration
    config = create_config_from_args(args)
    
    # Show configuration
    if args.verbose or args.config_only:
        print_config_summary(config)
        print()
    
    if args.config_only:
        print("Configuration shown. Use without --config-only to generate prompt.")
        return
    
    # Setup output directory
    output_dir = setup_output_directory(args.output_dir)
    
    try:
        # Create extractor
        extractor = SystemPromptExtractor(config)
        
        print("Starting system prompt generation...")
        if not args.verbose:
            print("(Use --verbose for detailed progress)")
        print()
        
        # Generate the complete prompt
        prompt = extractor.generate_complete_prompt()
        
        # Save outputs
        prompt_file = output_dir / "generated-system-prompt.md"
        analysis_file = output_dir / "prompt-analysis.md"
        config_file = output_dir / "extraction-config.json"
        
        print("\nSaving outputs...")
        
        # Save the main prompt
        extractor.save_prompt_to_file(prompt, str(prompt_file))
        
        # Save the analysis
        extractor.save_analysis_to_file(str(analysis_file))
        
        # Save the configuration used
        import json
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config.to_dict(), f, indent=2, default=str)
        
        print(f"Configuration saved to: {config_file}")
        
        # Summary
        print(f"\n=== Extraction Complete ===")
        print(f"Mode: {config.mode}")
        print(f"Generated prompt: {len(prompt):,} characters")
        print(f"Output directory: {output_dir.absolute()}")
        print(f"\nFiles created:")
        print(f"  * {prompt_file.name} - Complete system prompt")
        print(f"  * {analysis_file.name} - Detailed section analysis")
        print(f"  * {config_file.name} - Configuration used")
        
        # Show some stats
        sections_with_content = sum(1 for section in [
            extractor.sections.role_definition,
            extractor.sections.markdown_formatting,
            extractor.sections.shared_tool_use,
            extractor.sections.tool_descriptions,
            extractor.sections.tool_use_guidelines,
            extractor.sections.capabilities,
            extractor.sections.modes,
            extractor.sections.rules,
            extractor.sections.system_info,
            extractor.sections.objective,
            extractor.sections.custom_instructions
        ] if section.strip())
        
        print(f"\nStatistics:")
        print(f"  • Sections with content: {sections_with_content}")
        print(f"  • Available tools: {len(config.get_tools_for_mode())}")
        print(f"  • Mode: {config.get_mode_data()['name']} ({config.mode})")
        
        if config.experiments:
            enabled_experiments = [k for k, v in config.experiments.items() if v]
            if enabled_experiments:
                print(f"  • Experiments enabled: {', '.join(enabled_experiments)}")
        
        print(f"\nPrompt ready for analysis!")
        
    except Exception as e:
        print(f"\nError during extraction: {e}")
        if args.verbose:
            import traceback
            print("\nFull traceback:")
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()