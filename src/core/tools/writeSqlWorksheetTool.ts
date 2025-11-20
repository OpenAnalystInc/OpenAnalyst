import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * Write SQL Worksheet Tool
 *
 * Writes or updates SQL content in a worksheet file.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function writeSqlWorksheetTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const worksheetId: string | undefined = block.params.worksheet_id
	const sqlContent: string | undefined = block.params.sql_content

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("sql_content", sqlContent), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!worksheetId) {
			task.consecutiveMistakeCount++
			task.recordToolError("write_sql_worksheet")
			pushToolResult(await task.sayAndCreateMissingParamError("write_sql_worksheet", "worksheet_id"))
			return
		}

		if (!sqlContent) {
			task.consecutiveMistakeCount++
			task.recordToolError("write_sql_worksheet")
			pushToolResult(await task.sayAndCreateMissingParamError("write_sql_worksheet", "sql_content"))
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

		// Write to worksheet
		const updatedWorksheet = await sqlExecutor.writeWorksheet(worksheetId, sqlContent)

		// Show success message
		await task.say("text", `✅ Updated worksheet: ${worksheetId}`)

		// Result for AI
		const result = `Worksheet updated successfully.

Worksheet: ${worksheetId}
Content Length: ${sqlContent.length} characters
Updated At: ${new Date(updatedWorksheet.updatedAt).toLocaleString()}

The SQL content has been saved to the worksheet file.`

		pushToolResult(formatResponse.toolResult(result))
	} catch (error: any) {
		await handleError("writing to SQL worksheet", error)
	}
}
