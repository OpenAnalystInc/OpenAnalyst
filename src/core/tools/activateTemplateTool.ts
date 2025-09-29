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
		const templateExists = await provider.templateManager.templateExists(templateName)
		if (!templateExists) {
			const availableTemplates = await provider.templateManager.listTemplates()
			cline.consecutiveMistakeCount++
			cline.recordToolError("activate_template")
			pushToolResult(
				`Template "${templateName}" not found. Available templates: ${availableTemplates.join(", ")}`,
			)
			return
		}

		// Load and activate the template
		const loadResult = await provider.templateManager.loadTemplate(templateName)
		if (!loadResult.ok) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("activate_template")
			pushToolResult(`Failed to load template: ${loadResult.error.message}`)
			return
		}

		await provider.templateManager.setActiveTemplate(loadResult.value)

		const template = loadResult.value
		const modeNames = template.agents.map((agent: any) => agent.name || agent.slug).join(", ")
		pushToolResult(
			formatResponse.toolResult(
				`Template "${templateName}" activated successfully!\n\n` +
					`**Modes added:** ${modeNames}\n` +
					`**Mode count:** ${template.agents.length}\n` +
					`**Prompts:** ${template.prompts.length}\n` +
					`**Rules:** ${template.rules.length}\n\n` +
					`The new modes are now available in the mode selector.`,
			),
		)

		// Reset error count on success
		cline.consecutiveMistakeCount = 0
	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("activate_template")
		await handleError(`Failed to activate template`, error instanceof Error ? error : new Error(String(error)))
	}
}
