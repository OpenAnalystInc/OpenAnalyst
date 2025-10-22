import { ToolArgs } from "./types"

export function getExecuteSqlWorksheetDescription(args: ToolArgs): string | undefined {
	return `## execute_sql_worksheet
Description: Execute the SQL content from a saved worksheet. This tool reads the worksheet file, executes its SQL on BigQuery, and returns results for analysis. Useful for running saved/predefined queries.
Parameters:
- worksheet_id: (required) Worksheet ID from list_sql_worksheets
- connection_id: (optional) Specific connection ID to use. If not provided, uses default connection.
- limit_rows: (optional) Maximum rows to return for analysis (default: 100, max: 1000)
Usage:
<execute_sql_worksheet>
<worksheet_id>2025-10-08 15-30-45.sql</worksheet_id>
<connection_id>conn-123</connection_id>
<limit_rows>50</limit_rows>
</execute_sql_worksheet>

Example: Execute worksheet with default connection
<execute_sql_worksheet>
<worksheet_id>sales-analysis.sql</worksheet_id>
</execute_sql_worksheet>

The tool reads the SQL from the worksheet, asks for user approval, executes it, and returns the results for you to analyze.`
}
