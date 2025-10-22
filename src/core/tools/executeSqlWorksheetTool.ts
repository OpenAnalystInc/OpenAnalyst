import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * Execute SQL Worksheet Tool
 *
 * Executes the SQL content from a worksheet file.
 * Reads the worksheet, executes its SQL, and returns results.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function executeSqlWorksheetTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const worksheetId: string | undefined = block.params.worksheet_id
	const connectionId: string | undefined = block.params.connection_id
	const limitRows: number = parseInt(block.params.limit_rows || "100")

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("worksheet_id", worksheetId), block.partial).catch(() => {})
			return
		}

		// Validate required parameter
		if (!worksheetId) {
			task.consecutiveMistakeCount++
			task.recordToolError("execute_sql_worksheet")
			pushToolResult(await task.sayAndCreateMissingParamError("execute_sql_worksheet", "worksheet_id"))
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

		// Get worksheet to show SQL for approval
		const worksheet = await sqlExecutor.getWorksheet(worksheetId)
		const sql = worksheet.content || ""

		if (!sql.trim()) {
			await task.say("error", `Worksheet "${worksheet.name}" is empty. Cannot execute.`)
			pushToolResult(formatResponse.toolError("Worksheet is empty"))
			return
		}

		// Get connection status
		const status = await sqlExecutor.getStatus()

		// Ask for user approval (security measure)
		const approvalMessage = connectionId
			? `Execute SQL from worksheet "${worksheet.name}" on connection "${connectionId}":\n\n${sql}\n\nConnection: ${status}`
			: `Execute SQL from worksheet "${worksheet.name}":\n\n${sql}\n\nConnection: ${status}`

		const didApprove = await askApproval("command", approvalMessage)

		if (!didApprove) {
			return
		}

		// Show execution started message
		await task.say("text", `Executing worksheet: ${worksheet.name}...`)

		// Execute worksheet
		const result = await sqlExecutor.executeWorksheet(worksheetId, connectionId)

		if (result.success) {
			// Successful execution
			const rowsInfo = result.rowCount === 1 ? "1 row" : `${result.rowCount} rows`
			const timeInfo = result.executionTime ? ` in ${result.executionTime}ms` : ""

			// Message to user
			await task.say("text", `✅ Worksheet executed successfully. ${rowsInfo} returned${timeInfo}.`)

			// Return data to AI
			if (result.rowCount > 0 && result.rows.length > 0) {
				const dataSize = Math.min(limitRows, result.rows.length)
				const dataRows = result.rows.slice(0, dataSize)
				const columns = Object.keys(dataRows[0])

				const resultInfo = `Worksheet "${result.worksheetName}" executed successfully.

Execution Details:
- Rows returned: ${result.rowCount}
- Execution time: ${result.executionTime}ms
- Columns: ${columns.join(", ")}

Data (${dataSize} of ${result.rowCount} rows):
${JSON.stringify(dataRows, null, 2)}

You can now analyze this data, create visualizations, or generate insights.`

				pushToolResult(formatResponse.toolResult(resultInfo))
			} else {
				pushToolResult(formatResponse.toolResult(`Worksheet executed successfully but returned no rows.`))
			}
		} else {
			// Execution failed
			task.consecutiveMistakeCount++
			await task.say("error", `❌ Worksheet execution failed:\n\n${result.error}`)
			pushToolResult(formatResponse.toolError(`Worksheet execution failed: ${result.error}`))
		}
	} catch (error: any) {
		await handleError("executing SQL worksheet", error)
	}
}
