import * as vscode from "vscode"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * Execute SQL Tool
 *
 * Allows AI to execute SQL queries on BigQuery through the OpenAnalyst SQL extension.
 * Returns data to AI for analysis, visualization, and insights.
 * Requires user approval before execution for security.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function executeSqlTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	let query: string | undefined = block.params.query
	const connectionId: string | undefined = block.params.connection_id
	const limitRows: number = parseInt(block.params.limit_rows || "100")

	try {
		// Handle partial tool call (streaming from AI)
		if (block.partial) {
			await task.ask("command", removeClosingTag("query", query), block.partial).catch(() => {})
			return
		}

		// Validate required parameter
		if (!query) {
			task.consecutiveMistakeCount++
			task.recordToolError("execute_sql")
			pushToolResult(await task.sayAndCreateMissingParamError("execute_sql", "query"))
			return
		}

		// Reset consecutive mistake counter on valid input
		task.consecutiveMistakeCount = 0

		// Unescape HTML entities
		query = unescapeHtmlEntities(query)

		// Check if SQL extension is available
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

		// Get connection status for user context
		const status = await sqlExecutor.getStatus()

		// Ask for user approval (security measure)
		const approvalMessage = connectionId
			? `Execute SQL query on connection "${connectionId}":\n\n${query}\n\nConnection: ${status}`
			: `Execute SQL query:\n\n${query}\n\nConnection: ${status}`

		const didApprove = await askApproval("command", approvalMessage)

		if (!didApprove) {
			// User denied - don't return error, just stop execution
			return
		}

		// Show execution started message
		await task.say("text", `Executing SQL query...`)

		// Execute SQL query (don't show panel by default - AI will work with data)
		const result = await sqlExecutor.executeSql(query, {
			connectionId,
			showResults: false, // Don't auto-open panel - AI will analyze data
		})

		if (result.success) {
			// Successful execution
			const rowsInfo = result.rowCount === 1 ? "1 row" : `${result.rowCount} rows`
			const timeInfo = result.executionTime ? ` in ${result.executionTime}ms` : ""

			// Message to user
			await task.say("text", `✅ Query executed successfully. ${rowsInfo} returned${timeInfo}.`)

			// Return comprehensive data to AI for analysis and visualization
			if (result.rowCount > 0 && result.rows.length > 0) {
				// Return up to limitRows for AI to analyze (balance between context and completeness)
				const dataSize = Math.min(limitRows, result.rows.length)
				const dataRows = result.rows.slice(0, dataSize)
				const columns = Object.keys(dataRows[0])

				// Simple, clean format for better model compatibility
				const resultInfo = `Query executed successfully. Returned ${result.rowCount} row(s) in ${result.executionTime}ms.

Columns: ${columns.join(", ")}

Data (${dataSize} of ${result.rowCount} rows):
${JSON.stringify(dataRows, null, 2)}

You can now analyze this data, create visualizations, generate insights, or answer questions about it.`

				pushToolResult(formatResponse.toolResult(resultInfo))
			} else {
				const summary = `Query executed successfully but returned no rows. Execution time: ${result.executionTime}ms.`
				pushToolResult(formatResponse.toolResult(summary))
			}
		} else {
			// Execution failed
			task.consecutiveMistakeCount++

			const errorMessage = result.error || "Unknown error occurred"

			await task.say("error", `❌ SQL execution failed:\n\n${errorMessage}`)

			pushToolResult(formatResponse.toolError(`Query execution failed: ${errorMessage}`))
		}
	} catch (error: any) {
		// Unexpected error
		task.consecutiveMistakeCount++
		await handleError("executing SQL query", error)
	}
}
