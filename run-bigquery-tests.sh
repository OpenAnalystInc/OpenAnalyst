#!/bin/bash

# BigQuery Tools Test Runner
# This script runs the comprehensive BigQuery tools test suite

echo ""
echo "========================================="
echo "BigQuery Tools Test Runner"
echo "========================================="
echo ""

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code CLI not found. Please install VS Code command line tools."
    echo "   Run: code --install-extension in VS Code"
    exit 1
fi

echo "🔧 Setting up test environment..."
echo ""

# Make sure the extension is built
if [ ! -f "bin/oa-code-0.0.1.vsix" ]; then
    echo "❌ Extension not built. Please run: npm run build"
    exit 1
fi

echo "✅ Extension build found"
echo ""

# Check if test file exists
if [ ! -f "src/test/bigquery-tools.test.ts" ]; then
    echo "❌ Test file not found: src/test/bigquery-tools.test.ts"
    exit 1
fi

echo "✅ Test file found"
echo ""

echo "========================================="
echo "Running Tests"
echo "========================================="
echo ""

# Run tests using VS Code's test runner
echo "Note: This will open VS Code Extension Host for testing..."
echo ""

cd src

# Check if we have mocha installed
if [ ! -d "node_modules/mocha" ]; then
    echo "Installing test dependencies..."
    npm install --save-dev mocha @types/mocha
fi

# Run the test
npx mocha \
    --require ts-node/register \
    --require source-map-support/register \
    --timeout 60000 \
    --colors \
    test/bigquery-tools.test.ts

TEST_EXIT_CODE=$?

echo ""
echo "========================================="
echo "Test Results"
echo "========================================="
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "Next steps:"
    echo "1. Your BigQuery integration is working correctly"
    echo "2. You can now use BigQuery tools in Data Analyst mode"
    echo "3. Make sure you have configured a BigQuery connection"
    echo ""
else
    echo "❌ Some tests failed (exit code: $TEST_EXIT_CODE)"
    echo ""
    echo "Common issues:"
    echo "1. SQL extension not activated - reload VS Code window"
    echo "2. No BigQuery connections configured - add a connection first"
    echo "3. Authentication issues - check your GCP credentials"
    echo ""
fi

exit $TEST_EXIT_CODE
