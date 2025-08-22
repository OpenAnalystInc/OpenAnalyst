// oacode_change - new file
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"

export async function listTemplatesTool(
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

		const templates = await provider.templateManager.getAvailableTemplates()
		const activeTemplate = provider.templateManager.getActiveTemplateName()

		if (templates.length === 0) {
			pushToolResult(formatResponse.toolResult(
				"No templates found. Upload a template using the upload_template tool or add YAML files to the .oacode/templates/ directory."
			))
			return
		}

		let output = "**Available Templates:**\n\n"
		
		for (const template of templates) {
			const isActive = template.name === activeTemplate
			const status = isActive ? " (ACTIVE)" : ""
			output += `• **${template.name}**${status}\n`
			output += `  - File: ${template.filename}\n`
			output += `  - Modes: ${template.modeCount} (${template.modes.map(m => m.name).join(", ")})\n\n`
		}

		if (activeTemplate) {
			output += `\n**Currently Active:** ${activeTemplate}`
		} else {
			output += `\n**No template is currently active** (using built-in modes only)`
		}

		pushToolResult(formatResponse.toolResult(output))

		// Reset error count on success
		cline.consecutiveMistakeCount = 0

	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("list_templates")
		await handleError(`Failed to list templates`, error instanceof Error ? error : new Error(String(error)))
	}
}