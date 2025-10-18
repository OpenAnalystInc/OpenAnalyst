import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * List BigQuery Connections Tool
 *
 * Lists all available BigQuery connections with their details.
 * Helps AI discover which databases are available before executing queries.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function listBigqueryConnectionsTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		// This tool has no parameters, but handle partial calls
		if (block.partial) {
			return
		}

		// Initialize SQL executor
		const sqlExecutor = getSqlExecutor()

		try {
			await sqlExecutor.initialize()
		} catch (error: any) {
			await task.say(
				"error",
				`SQL extension is not available: ${error.message}\n\nPlease ensure the OpenAnalyst SQL extension is installed and you have configured a BigQuery connection.`,
			)
			pushToolResult(formatResponse.toolError(`SQL extension unavailable: ${error.message}`))
			return
		}

		// Get all connections
		const connections = await sqlExecutor.getConnections()
		const bqConnections = await sqlExecutor.getBigQueryConnections()

		if (connections.length === 0) {
			await task.say("text", "No BigQuery connections configured.")
			pushToolResult(
				formatResponse.toolResult(
					"No BigQuery connections found. User needs to configure a connection in OpenAnalyst extension first.",
				),
			)
			return
		}

		// Format connection details for AI
		const connectionDetails = connections.map((conn, idx) => {
			const bqConn = bqConnections.find((bq: any) => bq.id === conn.id)
			return {
				index: idx + 1,
				id: conn.id,
				name: conn.connectionName,
				projectId: conn.connectionCredentials.project_id || "Unknown",
				authMode: conn.connectionCredentials.mode,
				isConnected: bqConn?.isConnected || false,
			}
		})

		// Show summary to user
		const connectedCount = connectionDetails.filter((c) => c.isConnected).length
		await task.say("text", `Found ${connections.length} BigQuery connection(s), ${connectedCount} connected.`)

		// Detailed result for AI
		const result = `Found ${connections.length} BigQuery connection(s):

${connectionDetails
	.map(
		(c) =>
			`${c.index}. ${c.name}
   - ID: ${c.id}
   - Project: ${c.projectId}
   - Auth: ${c.authMode}
   - Status: ${c.isConnected ? "✓ Connected" : "✗ Disconnected"}`,
	)
	.join("\n\n")}

Use connection ID when querying specific connections with execute_sql tool.`

		pushToolResult(formatResponse.toolResult(result))
	} catch (error: any) {
		await handleError("listing BigQuery connections", error)
	}
}
