// oacode_change - new file
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"

export async function deleteTemplateTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const templateName: string | undefined = block.params.template_name

	if (block.partial && !templateName) {
		return
	}

	if (!templateName) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("delete_template")
		pushToolResult(await cline.sayAndCreateMissingParamError("delete_template", "template_name"))
		return
	}

	try {
		const provider = cline.providerRef.deref()
		if (!provider) {
			pushToolResult("Extension provider not available")
			return
		}

		// Check if template exists
		const templates = await provider.templateManager.getAvailableTemplates()
		const template = templates.find(t => t.name === templateName)
		
		if (!template) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("delete_template")
			pushToolResult(`Template "${templateName}" not found. Available templates: ${templates.map(t => t.name).join(", ")}`)
			return
		}

		// Ask for confirmation
		const approval = await askApproval(
			"tool",
			`Are you sure you want to delete template "${templateName}"? This will permanently remove the template file (${template.filename}) from the .oacode/templates/ directory.`
		)
		
		if (!approval) {
			pushToolResult("Template deletion cancelled.")
			return
		}

		// Delete the template
		await provider.templateManager.deleteTemplate(templateName)

		pushToolResult(formatResponse.toolResult(
			`Template "${templateName}" deleted successfully!\n\n` +
			`The template file "${template.filename}" has been removed from the .oacode/templates/ directory.` +
			(provider.templateManager.getActiveTemplateName() === null ? 
				"\n\nThe template was active and has been deactivated. Only built-in modes are now available." : "")
		))

		// Reset error count on success
		cline.consecutiveMistakeCount = 0

	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("delete_template")
		await handleError(`Failed to delete template`, error instanceof Error ? error : new Error(String(error)))
	}
}