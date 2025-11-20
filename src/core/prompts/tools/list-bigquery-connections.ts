import { ToolArgs } from "./types"

export function getListBigqueryConnectionsDescription(args: ToolArgs): string | undefined {
	return `## list_bigquery_connections
Description: List all available BigQuery connections with their details (names, IDs, project IDs, connection status). Use this tool FIRST when the user asks about databases or before executing queries to discover which connections are available and select the appropriate one.
Parameters: None
Usage:
<list_bigquery_connections></list_bigquery_connections>

Example: Discovering available connections
<list_bigquery_connections></list_bigquery_connections>

The tool returns connection details including names, project IDs, authentication modes, and connection status. Use connection IDs when executing queries on specific connections.`
}
