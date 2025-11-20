import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * List Tables Tool
 *
 * Lists all tables in a BigQuery dataset with metadata.
 * Helps AI discover which tables contain the data needed for queries.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function listTablesTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const datasetId: string | undefined = block.params.dataset_id
	const connectionId: string | undefined = block.params.connection_id

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("dataset_id", datasetId), block.partial).catch(() => {})
			return
		}

		// Validate required parameter
		if (!datasetId) {
			task.consecutiveMistakeCount++
			task.recordToolError("list_tables")
			pushToolResult(await task.sayAndCreateMissingParamError("list_tables", "dataset_id"))
			return
		}

		task.consecutiveMistakeCount = 0

		// Initialize SQL executor
		const sqlExecutor = getSqlExecutor()

		try {
			await sqlExecutor.initialize()
		} catch (error: any) {
			await task.say("error", `SQL extension is not available: ${error.message}`)
			pushToolResult(formatResponse.toolError(`SQL extension unavailable: ${error.message}`))
			return
		}

		// List tables
		const result = await sqlExecutor.listTables(datasetId, connectionId)

		if (!result.success) {
			await task.say("error", `Failed to list tables: ${result.error}`)
			pushToolResult(formatResponse.toolError(result.error || "Failed to list tables"))
			return
		}

		if (result.tables.length === 0) {
			await task.say("text", `No tables found in dataset "${datasetId}".`)
			pushToolResult(formatResponse.toolResult(`No tables found in dataset "${datasetId}".`))
			return
		}

		// Show summary to user
		await task.say("text", `Found ${result.tables.length} table(s) in dataset "${datasetId}".`)

		// Detailed result for AI
		const tableInfo = `Found ${result.tables.length} table(s) in dataset "${datasetId}":

${result.tables
	.map((tbl, idx) => {
		const sizeInMB = (tbl.numBytes / 1024 / 1024).toFixed(2)
		const rowsFormatted = tbl.numRows.toLocaleString()
		return `${idx + 1}. ${tbl.tableId}
   - Description: ${tbl.description || "No description"}
   - Type: ${tbl.type}
   - Rows: ${rowsFormatted}
   - Size: ${sizeInMB} MB
   - Last Modified: ${new Date(tbl.lastModified).toLocaleDateString()}`
	})
	.join("\n\n")}

Use table ID with get_table_schema tool to see detailed column information before writing queries.`

		pushToolResult(formatResponse.toolResult(tableInfo))
	} catch (error: any) {
		await handleError("listing tables", error)
	}
}
