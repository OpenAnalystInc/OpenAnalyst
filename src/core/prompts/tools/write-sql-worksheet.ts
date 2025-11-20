import { ToolArgs } from "./types"

export function getWriteSqlWorksheetDescription(args: ToolArgs): string | undefined {
	return `## write_sql_worksheet
Description: Write or update SQL content in a worksheet file. Use this to save queries for later use or modify existing worksheets.
Parameters:
- worksheet_id: (required) Worksheet ID from list_sql_worksheets or create_sql_worksheet
- sql_content: (required) SQL content to write to the worksheet
Usage:
<write_sql_worksheet>
<worksheet_id>2025-10-08 15-30-45.sql</worksheet_id>
<sql_content>SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC LIMIT 100</sql_content>
</write_sql_worksheet>

Use this to persist queries for future execution or sharing.`
}
