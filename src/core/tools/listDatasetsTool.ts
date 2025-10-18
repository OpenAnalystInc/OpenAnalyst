import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * List Datasets Tool
 *
 * Lists all datasets in a BigQuery connection.
 * Helps AI discover what data collections exist before querying.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function listDatasetsTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const connectionId: string | undefined = block.params.connection_id

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("connection_id", connectionId), block.partial).catch(() => {})
			return
		}

		// Initialize SQL executor
		const sqlExecutor = getSqlExecutor()

		try {
			await sqlExecutor.initialize()
		} catch (error: any) {
			await task.say("error", `SQL extension is not available: ${error.message}`)
			pushToolResult(formatResponse.toolError(`SQL extension unavailable: ${error.message}`))
			return
		}

		// List datasets
		const result = await sqlExecutor.listDatasets(connectionId)

		if (!result.success) {
			await task.say("error", `Failed to list datasets: ${result.error}`)
			pushToolResult(formatResponse.toolError(result.error || "Failed to list datasets"))
			return
		}

		if (result.datasets.length === 0) {
			await task.say("text", "No datasets found in this connection.")
			pushToolResult(formatResponse.toolResult("No datasets found."))
			return
		}

		// Show summary to user
		await task.say("text", `Found ${result.datasets.length} dataset(s).`)

		// Detailed result for AI
		const datasetInfo = `Found ${result.datasets.length} dataset(s):

${result.datasets.map((ds, idx) => `${idx + 1}. ${ds}`).join("\n")}

Use dataset ID with list_tables tool to discover available tables.`

		pushToolResult(formatResponse.toolResult(datasetInfo))
	} catch (error: any) {
		await handleError("listing datasets", error)
	}
}
