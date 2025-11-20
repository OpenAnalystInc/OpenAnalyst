import { ToolArgs } from "./types"

export function getExecuteSqlDescription(args: ToolArgs): string | undefined {
	return `## execute_sql
Description: Execute SQL queries on BigQuery to analyze data, retrieve information, or generate insights. Results are returned for you to analyze, visualize, or summarize in the chat. Use schema discovery tools (list_bigquery_connections, list_datasets, list_tables, get_table_schema) BEFORE this tool to ensure you use correct table and column names.
Parameters:
- query: (required) SQL query in BigQuery Standard SQL syntax. Table names must use backticks and full format: \`project.dataset.table\`
- connection_id: (optional) Specific connection ID from list_bigquery_connections. If not provided, uses default connection.
- limit_rows: (optional) Maximum rows to return for analysis (default: 100, max: 1000). Use this to control how much data is returned.
Usage:
<execute_sql>
<query>SELECT * FROM \`project.dataset.users\` WHERE active = true LIMIT 10</query>
<connection_id>conn-123</connection_id>
<limit_rows>50</limit_rows>
</execute_sql>

Example: Simple query with default connection
<execute_sql>
<query>SELECT COUNT(*) as total FROM \`project.dataset.users\`</query>
</execute_sql>

Example: Query specific connection with row limit
<execute_sql>
<query>SELECT order_id, customer_name, total_amount FROM \`prod.sales.orders\` ORDER BY order_date DESC LIMIT 20</query>
<connection_id>production-conn-id</connection_id>
<limit_rows>20</limit_rows>
</execute_sql>

Important Notes:
- ALWAYS use schema discovery tools first to get correct table and column names
- Table names in BigQuery MUST use backticks: \`project.dataset.table\`
- Use LIMIT clause to avoid returning excessive data
- Results are returned as JSON data for you to analyze and visualize
- User must approve the query before execution`
}
