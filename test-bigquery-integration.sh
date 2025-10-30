#!/bin/bash

echo ""
echo "========================================"
echo "BigQuery Tools Integration Test"
echo "========================================"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Test 1: Check if SQL extension is installed
echo "Test 1: Checking SQL extension installation..."
if [ -d "$HOME/.vscode/extensions/openanalyst-team.open-analyst-0.1.0" ]; then
    echo "✅ PASSED: SQL extension is installed"
    ((PASSED++))
else
    echo "❌ FAILED: SQL extension NOT found in ~/.vscode/extensions/"
    ((FAILED++))
fi
echo ""

# Test 2: Check if TOOL_GROUPS has bigquery
echo "Test 2: Checking TOOL_GROUPS for bigquery..."
if grep -q "bigquery:" src/shared/tools.ts && grep -q "list_bigquery_connections" src/shared/tools.ts; then
    echo "✅ PASSED: BigQuery tools registered in TOOL_GROUPS"
    TOOL_COUNT=$(grep -A 15 "bigquery:" src/shared/tools.ts | grep -c '\".*\"')
    echo "   Found $TOOL_COUNT BigQuery tool definitions"
    ((PASSED++))
else
    echo "❌ FAILED: BigQuery tools NOT found in TOOL_GROUPS"
    ((FAILED++))
fi
echo ""

# Test 3: Check if toolGroups enum includes bigquery
echo "Test 3: Checking toolGroups enum in types package..."
if grep -q '"bigquery"' packages/types/src/tool.ts; then
    echo "✅ PASSED: 'bigquery' found in toolGroups enum (source)"
    ((PASSED++))
else
    echo "❌ FAILED: 'bigquery' NOT in toolGroups enum"
    ((FAILED++))
fi
echo ""

# Test 4: Check if compiled types include bigquery
echo "Test 4: Checking compiled types package..."
if [ -f "packages/types/dist/index.js" ]; then
    if grep -q '"bigquery"' packages/types/dist/index.js && grep -q 'toolGroups' packages/types/dist/index.js; then
        echo "✅ PASSED: Compiled types include 'bigquery'"
        ((PASSED++))
    else
        echo "❌ FAILED: Compiled types do NOT include 'bigquery'"
        echo "   ACTION: cd packages/types && npm run build"
        ((FAILED++))
    fi
else
    echo "⚠️  WARNING: Compiled types not found"
    ((WARNINGS++))
fi
echo ""

# Test 5: Check if data-analyst mode has bigquery in DEFAULT_MODES
echo "Test 5: Checking data-analyst mode in DEFAULT_MODES..."
if grep -A 20 'slug: "data-analyst"' packages/types/src/mode.ts | grep -q '"bigquery"'; then
    echo "✅ PASSED: data-analyst mode includes 'bigquery' group"
    ((PASSED++))
else
    echo "❌ FAILED: data-analyst mode does NOT include 'bigquery'"
    echo "   This is the CRITICAL issue preventing tool access!"
    ((FAILED++))
fi
echo ""

# Test 6: Check if SqlExecutor uses command-based API
echo "Test 6: Checking SqlExecutor implementation..."
if grep -q "vscode.commands.executeCommand" src/services/SqlExecutor.ts && \
   grep -q "openAnalyst.executeSQLInternal" src/services/SqlExecutor.ts; then
    echo "✅ PASSED: SqlExecutor uses command-based API"
    ((PASSED++))
else
    echo "❌ FAILED: SqlExecutor does NOT use command-based API"
    echo "   Should use vscode.commands.executeCommand"
    ((FAILED++))
fi
echo ""

# Test 7: Check if all 10 BigQuery tool files exist
echo "Test 7: Checking BigQuery tool files..."
TOOL_FILES=(
    "src/core/tools/listBigqueryConnectionsTool.ts"
    "src/core/tools/listDatasetsTool.ts"
    "src/core/tools/listTablesTool.ts"
    "src/core/tools/getTableSchemaTool.ts"
    "src/core/tools/executeSqlTool.ts"
    "src/core/tools/createSqlWorksheetTool.ts"
    "src/core/tools/listSqlWorksheetsTool.ts"
    "src/core/tools/readSqlWorksheetTool.ts"
    "src/core/tools/writeSqlWorksheetTool.ts"
    "src/core/tools/executeSqlWorksheetTool.ts"
)

MISSING_TOOLS=0
for tool in "${TOOL_FILES[@]}"; do
    if [ ! -f "$tool" ]; then
        echo "   ❌ Missing: $tool"
        ((MISSING_TOOLS++))
    fi
done

if [ $MISSING_TOOLS -eq 0 ]; then
    echo "✅ PASSED: All 10 BigQuery tool files exist"
    ((PASSED++))
else
    echo "❌ FAILED: $MISSING_TOOLS tool file(s) missing"
    ((FAILED++))
fi
echo ""

# Test 8: Check modes.json (workspace file)
echo "Test 8: Checking modes.json (workspace config)..."
if [ -f "modes.json" ]; then
    if grep -A 10 '"data-analyst"' modes.json | grep -q '"bigquery"'; then
        echo "✅ PASSED: modes.json includes 'bigquery' in data-analyst"
        echo "   Note: This file is for UI only, DEFAULT_MODES is what matters"
        ((PASSED++))
    else
        echo "⚠️  WARNING: modes.json doesn't have 'bigquery'"
        ((WARNINGS++))
    fi
else
    echo "⚠️  WARNING: modes.json not found"
    ((WARNINGS++))
fi
echo ""

# Print summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo ""
echo "✅ PASSED: $PASSED tests"
echo "❌ FAILED: $FAILED tests"
echo "⚠️  WARNINGS: $WARNINGS"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "========================================"
    echo "Action Required"
    echo "========================================"
    echo ""
    echo "To fix the integration, run these commands:"
    echo ""
    echo "1. Rebuild packages/types (if test 4 or 5 failed):"
    echo "   cd packages/types && npm run build && cd ../.."
    echo ""
    echo "2. Rebuild main extension:"
    echo "   npm run build"
    echo ""
    echo "3. Reload VS Code window:"
    echo "   Press Cmd+Shift+P → 'Developer: Reload Window'"
    echo ""
    exit 1
else
    echo "✅ All critical tests passed!"
    echo ""
    echo "Next steps:"
    echo "1. Rebuild: npm run build"
    echo "2. Reload VS Code: Cmd+Shift+P → 'Developer: Reload Window'"
    echo "3. Test BigQuery tools in Data Analyst mode"
    echo ""
    exit 0
fi
