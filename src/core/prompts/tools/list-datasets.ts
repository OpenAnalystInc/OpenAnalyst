import { ToolArgs } from "./types"

export function getListDatasetsDescription(args: ToolArgs): string | undefined {
	return `## list_datasets
Description: List all datasets (database schemas/collections) in a BigQuery connection. Use this after list_bigquery_connections to discover what data collections exist. Datasets group related tables together (e.g., sales_data, customer_info, analytics).
Parameters:
- connection_id: (optional) Specific connection ID from list_bigquery_connections. If not provided, uses the default/first connection.
Usage:
<list_datasets>
<connection_id>conn-prod-123</connection_id>
</list_datasets>

Example: List datasets in default connection
<list_datasets></list_datasets>

Example: List datasets in specific connection
<list_datasets>
<connection_id>production-connection-id</connection_id>
</list_datasets>

The tool returns dataset IDs. Use these with list_tables to see what tables are available in each dataset.`
}
