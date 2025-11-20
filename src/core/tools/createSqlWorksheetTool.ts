import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * Create SQL Worksheet Tool
 *
 * Creates a new SQL worksheet file for organizing and saving queries.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function createSqlWorksheetTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const name: string | undefined = block.params.name
	const initialSql: string | undefined = block.params.initial_sql

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("name", name), block.partial).catch(() => {})
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

		// Create worksheet
		const worksheet = await sqlExecutor.createWorksheet(name, initialSql)

		// Show success message to user
		await task.say("text", `✅ Created SQL worksheet: ${worksheet.name}`)

		// Result for AI
		const result = `Created SQL worksheet successfully.

Worksheet Details:
- ID: ${worksheet.id}
- Name: ${worksheet.name}
- File Path: ${worksheet.filePath}
${initialSql ? `- Initial Content: ${initialSql.length} characters` : "- Content: Empty worksheet"}

Use this worksheet ID with other worksheet tools to read, write, or execute queries.`

		pushToolResult(formatResponse.toolResult(result))
	} catch (error: any) {
		await handleError("creating SQL worksheet", error)
	}
}
