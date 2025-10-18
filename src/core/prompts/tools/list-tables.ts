import { ToolArgs } from "./types"

export function getListTablesDescription(args: ToolArgs): string | undefined {
	return `## list_tables
Description: List all tables in a BigQuery dataset with metadata (descriptions, row counts, sizes). Use this after list_datasets to discover which tables contain the data you need for the user's query. Table descriptions and names help identify the correct table to query.
Parameters:
- dataset_id: (required) Dataset ID from list_datasets
- connection_id: (optional) Specific connection ID. If not provided, uses default connection.
Usage:
<list_tables>
<dataset_id>sales_data</dataset_id>
<connection_id>conn-prod-123</connection_id>
</list_tables>

Example: List tables in a dataset
<list_tables>
<dataset_id>sales_data</dataset_id>
</list_tables>

The tool returns table names, descriptions, row counts, and sizes. Use get_table_schema to see detailed column information before writing queries.`
}
