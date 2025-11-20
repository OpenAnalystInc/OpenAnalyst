import { ToolArgs } from "./types"

export function getGetTableSchemaDescription(args: ToolArgs): string | undefined {
	return `## get_table_schema
Description: Get detailed column information for a BigQuery table including column names, data types, nullability, and descriptions. Use this before writing SQL queries to ensure you use correct column names and understand the data structure. This is essential for generating accurate queries.
Parameters:
- table_id: (required) Table identifier in format "dataset.table" (e.g., "sales_data.orders")
- connection_id: (optional) Specific connection ID. If not provided, uses default connection.
Usage:
<get_table_schema>
<table_id>sales_data.orders</table_id>
<connection_id>conn-prod-123</connection_id>
</get_table_schema>

Example: Get schema for orders table
<get_table_schema>
<table_id>sales_data.orders</table_id>
</get_table_schema>

The tool returns all columns with their names, types (INTEGER, STRING, FLOAT, TIMESTAMP, etc.), nullability, and descriptions. Use this information to write SQL queries with exact column names.`
}
