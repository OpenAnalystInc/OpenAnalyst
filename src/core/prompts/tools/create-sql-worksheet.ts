import { ToolArgs } from "./types"

export function getCreateSqlWorksheetDescription(args: ToolArgs): string | undefined {
	return `## create_sql_worksheet
Description: Create a new SQL worksheet file for organizing and saving queries. Worksheets persist across sessions and can be edited, executed, and shared.
Parameters:
- name: (optional) Custom worksheet name. If not provided, uses timestamp format (YYYY-MM-DD HH-MM-SS).
- initial_sql: (optional) Initial SQL content to write to the worksheet.
Usage:
<create_sql_worksheet>
<name>Sales Analysis</name>
<initial_sql>SELECT * FROM sales WHERE date >= CURRENT_DATE() - 30</initial_sql>
</create_sql_worksheet>

Example: Create empty worksheet
<create_sql_worksheet></create_sql_worksheet>

Example: Create worksheet with initial SQL
<create_sql_worksheet>
<name>Customer Report</name>
<initial_sql>SELECT customer_name, SUM(order_amount) as total FROM orders GROUP BY customer_name</initial_sql>
</create_sql_worksheet>`
}
