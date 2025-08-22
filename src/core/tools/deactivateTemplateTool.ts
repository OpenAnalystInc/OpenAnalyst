// oacode_change - new file
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"

export async function deactivateTemplateTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		const provider = cline.providerRef.deref()
		if (!provider) {
			pushToolResult("Extension provider not available")
			return
		}

		const currentTemplate = provider.templateManager.getActiveTemplateName()
		
		if (!currentTemplate) {
			pushToolResult("No template is currently active.")
			return
		}

		// Deactivate the current template
		await provider.templateManager.deactivateTemplate()

		pushToolResult(formatResponse.toolResult(
			`Template "${currentTemplate}" deactivated successfully!\n\n` +
			`All template modes have been removed. Only built-in modes are now available.`
		))

		// Reset error count on success
		cline.consecutiveMistakeCount = 0

	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("deactivate_template")
		await handleError(`Failed to deactivate template`, error instanceof Error ? error : new Error(String(error)))
	}
}