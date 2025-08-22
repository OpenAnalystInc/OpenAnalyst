// oacode_change - new file
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"

export async function activateTemplateTool(
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
		cline.recordToolError("activate_template")
		pushToolResult(await cline.sayAndCreateMissingParamError("activate_template", "template_name"))
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
			cline.recordToolError("activate_template")
			pushToolResult(`Template "${templateName}" not found. Available templates: ${templates.map(t => t.name).join(", ")}`)
			return
		}

		// Activate the template
		await provider.templateManager.activateTemplate(templateName)

		const modeNames = template.modes.map(m => m.name).join(", ")
		pushToolResult(formatResponse.toolResult(
			`Template "${templateName}" activated successfully!\n\n` +
			`**Modes added:** ${modeNames}\n` +
			`**Mode count:** ${template.modeCount}\n\n` +
			`The new modes are now available in the mode selector.`
		))

		// Reset error count on success
		cline.consecutiveMistakeCount = 0

	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("activate_template")
		await handleError(`Failed to activate template`, error instanceof Error ? error : new Error(String(error)))
	}
}