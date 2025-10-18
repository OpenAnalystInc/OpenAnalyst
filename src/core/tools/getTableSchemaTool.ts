import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getSqlExecutor } from "../../services/SqlExecutor"

/**
 * Get Table Schema Tool
 *
 * Gets detailed column information for a BigQuery table.
 * Provides AI with exact column names, types, and descriptions for accurate query generation.
 *
 * @param task - The current task instance
 * @param block - The tool use block containing parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Error handling function
 * @param pushToolResult - Function to return results to AI
 * @param removeClosingTag - Utility to remove closing tags from partial content
 */
export async function getTableSchemaTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const tableId: string | undefined = block.params.table_id
	const connectionId: string | undefined = block.params.connection_id

	try {
		// Handle partial tool call
		if (block.partial) {
			await task.ask("command", removeClosingTag("table_id", tableId), block.partial).catch(() => {})
			return
		}

		// Validate required parameter
		if (!tableId) {
			task.consecutiveMistakeCount++
			task.recordToolError("get_table_schema")
			pushToolResult(await task.sayAndCreateMissingParamError("get_table_schema", "table_id"))
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

		// Get table schema
		const result = await sqlExecutor.getTableSchema(tableId, connectionId)

		if (!result.success || !result.schema) {
			await task.say("error", `Failed to get schema for table "${tableId}": ${result.error}`)
			pushToolResult(formatResponse.toolError(result.error || "Failed to get table schema"))
			return
		}

		const schema = result.schema

		// Show summary to user
		await task.say(
			"text",
			`Retrieved schema for table "${tableId}" (${schema.totalColumns} columns, ${schema.totalRows.toLocaleString()} rows).`,
		)

		// Detailed result for AI
		const schemaInfo = `Table Schema: ${tableId}

Description: ${schema.tableDescription || "No description"}
Total Rows: ${schema.totalRows.toLocaleString()}
Total Columns: ${schema.totalColumns}
Last Modified: ${new Date(schema.lastModified).toLocaleString()}

Columns:
${schema.columns
	.map(
		(col, idx) =>
			`${idx + 1}. ${col.name}
   - Type: ${col.type}
   - Nullable: ${col.mode === "NULLABLE" ? "Yes" : "No"}
   - Description: ${col.description || "No description"}`,
	)
	.join("\n\n")}

You now have all column names and types. Use this information to write accurate SQL queries with correct column names and data types.`

		pushToolResult(formatResponse.toolResult(schemaInfo))
	} catch (error: any) {
		await handleError("getting table schema", error)
	}
}
