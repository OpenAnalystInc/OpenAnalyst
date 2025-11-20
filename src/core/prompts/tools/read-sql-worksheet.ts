import { ToolArgs } from "./types"

export function getReadSqlWorksheetDescription(args: ToolArgs): string | undefined {
	return `## read_sql_worksheet
Description: Read the SQL content from an existing worksheet. Use this to see what queries are saved before executing or modifying them.
Parameters:
- worksheet_id: (required) Worksheet ID from list_sql_worksheets
Usage:
<read_sql_worksheet>
<worksheet_id>2025-10-08 15-30-45.sql</worksheet_id>
</read_sql_worksheet>

Returns the worksheet's SQL content along with metadata.`
}
