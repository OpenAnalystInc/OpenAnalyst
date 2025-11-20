import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * List SQL Worksheets Tool
 *
 * Lists all available SQL worksheets with their details.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function listSqlWorksheetsTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		// Handle partial (no parameters for this tool)
		if (block.partial) {
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

		// List worksheets
		const worksheets = await sqlExecutor.listWorksheets()

		if (worksheets.length === 0) {
			await task.say("text", "No SQL worksheets found.")
			pushToolResult(formatResponse.toolResult("No SQL worksheets found. Create one with create_sql_worksheet tool."))
			return
		}

		// Show summary to user
		await task.say("text", `Found ${worksheets.length} SQL worksheet(s).`)

		// Detailed result for AI
		const result = `Found ${worksheets.length} SQL worksheet(s):

${worksheets
	.map(
		(w: any, idx: number) =>
			`${idx + 1}. ${w.name}
   - ID: ${w.id}
   - Created: ${new Date(w.createdAt).toLocaleString()}
   - Updated: ${new Date(w.updatedAt).toLocaleString()}
   - Path: ${w.filePath}`,
	)
	.join("\n\n")}

Use worksheet ID with read_sql_worksheet, write_sql_worksheet, or execute_sql_worksheet tools.`

		pushToolResult(formatResponse.toolResult(result))
	} catch (error: any) {
		await handleError("listing SQL worksheets", error)
	}
}
