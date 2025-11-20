#!/usr/bin/env bash

# Changelog validation script for pre-commit hooks
# Ensures that source code changes include corresponding changelog entries
# Based on production-grade TypeScript coding standards

set -euo pipefail

echo "🔍 Checking changelog requirements..."

# Get list of changed files in the commit
CHANGED_FILES=$(git diff --cached --name-only)

# Check if only docs/tests changed (skip changelog requirement)
if echo "$CHANGED_FILES" | grep -qE '^(src/|packages/|extension\.ts|package\.json|webview-ui/src/)'; then
    echo "📝 Source code changes detected, checking for changelog entry..."
    
    # Require CHANGELOG.md modification in the commit
    if ! echo "$CHANGED_FILES" | grep -q '^CHANGELOG.md$'; then
        echo "❌ CHANGELOG.md missing from commit."
        echo ""
        echo "📋 Source code changes require a changelog entry."
        echo "Please add an entry to CHANGELOG.md using this template:"
        echo ""
        echo "### Feature: <short name>"
        echo "Date: $(date +%Y-%m-%d) • Author: @$(git config user.name)"
        echo "Files: $(echo "$CHANGED_FILES" | grep -E '^(src/|packages/|extension\.ts|webview-ui/src/)' | head -5 | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')"
        echo ""
        echo "**WHY**"
        echo "- Problem & constraints in 1–3 bullets."
        echo "- Decision summary (trade-offs)."
        echo ""
        echo "**Functionality**"
        echo "- What the new code does; user-visible effects; risk & rollback."
        echo ""
        echo "**BEFORE**"
        echo "\`\`\`ts"
        echo "// previous code"
        echo "\`\`\`"
        echo ""
        echo "**AFTER**"
        echo "\`\`\`ts"
        echo "// new code"
        echo "\`\`\`"
        echo ""
        echo "**Tests**"
        echo "- New/updated tests and coverage focus."
        echo ""
        echo "**Notes**"
        echo "- Perf/Security/UX considerations; migration details if any."
        echo ""
        exit 1
    else
        echo "✅ CHANGELOG.md updated"
        
        # Validate changelog entry has required sections
        if ! grep -q "$(date +%Y-%m-%d)" CHANGELOG.md; then
            echo "⚠️  Warning: No entry with today's date found in CHANGELOG.md"
            echo "Please ensure your changelog entry includes today's date: $(date +%Y-%m-%d)"
        fi
        
        # Check for required sections
        CHANGELOG_CONTENT=$(tail -50 CHANGELOG.md)
        MISSING_SECTIONS=""
        
        if ! echo "$CHANGELOG_CONTENT" | grep -q "**WHY**"; then
            MISSING_SECTIONS="$MISSING_SECTIONS WHY"
        fi
        
        if ! echo "$CHANGELOG_CONTENT" | grep -q "**Functionality**"; then
            MISSING_SECTIONS="$MISSING_SECTIONS Functionality"
        fi
        
        if ! echo "$CHANGELOG_CONTENT" | grep -q "**BEFORE**"; then
            MISSING_SECTIONS="$MISSING_SECTIONS BEFORE"
        fi
        
        if ! echo "$CHANGELOG_CONTENT" | grep -q "**AFTER**"; then
            MISSING_SECTIONS="$MISSING_SECTIONS AFTER"
        fi
        
        if [ -n "$MISSING_SECTIONS" ]; then
            echo "⚠️  Warning: Missing required changelog sections:$MISSING_SECTIONS"
            echo "Consider adding these sections for complete documentation."
        fi
    fi
else
    echo "📝 Only documentation/tests changed, skipping changelog requirement."
fi

echo "✅ Changelog validation complete"