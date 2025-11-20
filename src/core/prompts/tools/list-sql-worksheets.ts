import { ToolArgs } from "./types"

export function getListSqlWorksheetsDescription(args: ToolArgs): string | undefined {
	return `## list_sql_worksheets
Description: List all available SQL worksheets with their details (names, IDs, created/updated dates). Use this to discover existing saved queries.
Parameters: None
Usage:
<list_sql_worksheets></list_sql_worksheets>

Returns worksheet IDs that can be used with read_sql_worksheet, write_sql_worksheet, or execute_sql_worksheet tools.`
}
