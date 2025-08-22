// oacode_change - new file
import path from "path"
import * as vscode from "vscode"
import fs from "fs/promises"
import * as yaml from "yaml"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"
import { customModesSettingsSchema } from "@roo-code/types"

const TEMPLATES_DIRECTORY = ".oacode/templates"

export async function uploadTemplateTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const fileName: string | undefined = block.params.filename
	const content: string | undefined = block.params.content
	const overwrite: boolean = block.params.overwrite === "true"

	if (block.partial && (!fileName || content === undefined)) {
		return
	}

	if (!fileName) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("upload_template")
		pushToolResult(await cline.sayAndCreateMissingParamError("upload_template", "filename"))
		return
	}

	if (content === undefined) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("upload_template")
		pushToolResult(await cline.sayAndCreateMissingParamError("upload_template", "content"))
		return
	}

	// Validate filename extension
	if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("upload_template")
		pushToolResult(`Template files must have .yaml or .yml extension`)
		return
	}

	// Get workspace path
	const workspacePath = getWorkspacePath()
	if (!workspacePath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("upload_template")
		pushToolResult(`No workspace found. Please open a workspace to upload templates.`)
		return
	}

	try {
		const provider = cline.providerRef.deref()
		if (!provider) {
			pushToolResult("Extension provider not available")
			return
		}

		// Validate YAML content
		let parsedContent: any
		try {
			parsedContent = yaml.parse(content)
		} catch (yamlError) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("upload_template")
			pushToolResult(`Invalid YAML format: ${yamlError instanceof Error ? yamlError.message : 'Failed to parse YAML'}`)
			return
		}

		// Validate against schema
		const validationResult = customModesSettingsSchema.safeParse(parsedContent)
		if (!validationResult.success) {
			const issues = validationResult.error.issues
				.map((issue) => `• ${issue.path.join(".")}: ${issue.message}`)
				.join("\n")
			
			cline.consecutiveMistakeCount++
			cline.recordToolError("upload_template")
			pushToolResult(`Template validation failed:\n${issues}`)
			return
		}

		// Create templates directory if it doesn't exist
		const templatesDir = path.join(workspacePath, TEMPLATES_DIRECTORY)
		try {
			await fs.mkdir(templatesDir, { recursive: true })
		} catch (mkdirError) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("upload_template")
			pushToolResult(`Failed to create templates directory: ${mkdirError instanceof Error ? mkdirError.message : 'Unknown error'}`)
			return
		}

		// Check if file already exists
		const filePath = path.join(templatesDir, fileName)
		const fileExists = await fileExistsAtPath(filePath)

		if (fileExists && !overwrite) {
			const approval = await askApproval(
				"tool",
				`Template file "${fileName}" already exists. Do you want to overwrite it?`
			)
			
			if (!approval) {
				pushToolResult(`Upload cancelled. Template "${fileName}" was not overwritten.`)
				return
			}
		}

		// Write the template file
		await fs.writeFile(filePath, content, "utf-8")

		// Force template refresh by getting available templates (this will scan the directory)
		await provider.templateManager.getAvailableTemplates()

		// Count modes in the template
		const modeCount = validationResult.data.customModes?.length || 0
		const modeNames = validationResult.data.customModes?.map(m => m.name || m.slug).join(", ") || ""

		// Notify about successful upload
		pushToolResult(formatResponse.toolResult(
			`Template "${fileName}" uploaded successfully to ${TEMPLATES_DIRECTORY}/\n\n` +
			`Contains ${modeCount} mode(s): ${modeNames}\n\n` +
			`The template modes will be available after activating this template.`
		))

		// Reset error count on success
		cline.consecutiveMistakeCount = 0

	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("upload_template")
		await handleError(`Failed to upload template`, error instanceof Error ? error : new Error(String(error)))
	}
}