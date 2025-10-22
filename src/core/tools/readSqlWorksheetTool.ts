import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * Read SQL Worksheet Tool
 *
 * Reads SQL content from an existing worksheet.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function readSqlWorksheetTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const worksheetId: string | undefined = block.params.worksheet_id

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("worksheet_id", worksheetId), block.partial).catch(() => {})
			return
		}

		// Validate required parameter
		if (!worksheetId) {
			task.consecutiveMistakeCount++
			task.recordToolError("read_sql_worksheet")
			pushToolResult(await task.sayAndCreateMissingParamError("read_sql_worksheet", "worksheet_id"))
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

		// Get worksheet with content
		const worksheet = await sqlExecutor.getWorksheet(worksheetId)

		// Show summary to user
		await task.say("text", `Read worksheet: ${worksheet.name} (${worksheet.content?.length || 0} characters)`)

		// Result for AI
		const result = `Worksheet: ${worksheet.name}

Details:
- ID: ${worksheet.id}
- Created: ${new Date(worksheet.createdAt).toLocaleString()}
- Updated: ${new Date(worksheet.updatedAt).toLocaleString()}
- File Path: ${worksheet.filePath}

SQL Content:
${worksheet.content || "(empty)"}

You can now execute this SQL with execute_sql_worksheet tool or modify it with write_sql_worksheet tool.`

		pushToolResult(formatResponse.toolResult(result))
	} catch (error: any) {
		await handleError("reading SQL worksheet", error)
	}
}
