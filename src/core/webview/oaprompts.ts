import os from "os"
import * as path from "path"
import fs from "fs/promises"
import * as vscode from "vscode"
import { fileExistsAtPath } from "../../utils/fs"
import { openFile } from "../../integrations/misc/open-file"
import { getWorkspacePath } from "../../utils/path"

/**
 * Custom prompt file operations for the Create Prompt functionality
 * 
 * This module provides backend support for:
 * - Creating new custom prompt YAML files
 * - Deleting existing custom prompt files
 * - Opening prompt files for editing in VSCode
 * 
 * Custom prompts are stored in:
 * - Workspace: {workspace}/.oacode/prompts/
 * - Global: ~/.oacode/prompts/
 */

/**
 * Get the directory path for custom prompts based on scope
 * @param isGlobal - Whether to use global (~/.oacode/prompts/) or workspace scope
 * @returns Directory path where prompt files are stored
 */
function getPromptDirectoryPath(isGlobal: boolean): string {
	const workspacePath = getWorkspacePath()
	const baseDir = isGlobal ? os.homedir() : workspacePath
	return path.join(baseDir, ".oacode", "prompts")
}

/**
 * Get the full file path for a prompt file
 * @param promptName - Name of the prompt (without .yaml extension)
 * @param isGlobal - Whether to use global or workspace scope
 * @returns Full path to the prompt YAML file
 */
function getPromptFilePath(promptName: string, isGlobal: boolean): string {
	const promptsDir = getPromptDirectoryPath(isGlobal)
	// Ensure .yaml extension
	const filename = promptName.endsWith(".yaml") ? promptName : `${promptName}.yaml`
	return path.join(promptsDir, filename)
}

/**
 * Generate YAML template content for new prompt files
 * @param promptName - Name for the prompt
 * @returns YAML content string
 */
function generatePromptTemplate(promptName: string, category: string): string {
	// Remove .yaml extension if present for clean naming
	const cleanName = promptName.replace(/\.yaml$/, "")
	
	return `name: "${cleanName}"
description: "Add a brief description of what this prompt does"
category: "custom"
tags: ["custom", "prompt"]
priority: 50
enabled: true

prompt: |
  Add your custom prompt instructions here.
  
  You can use multiple lines and include:
  - Specific guidelines for the AI
  - Output format requirements
  - Context or domain-specific instructions
  - Examples of desired responses
  
  This prompt will be applied when activated in the toolbar.
`
}

/**
 * Create a new custom prompt file
 * @param filename - Name of the file to create (with or without .yaml extension)
 * @param isGlobal - Whether to create in global or workspace scope
 * @param category - Category for the prompt
 */
export async function createPromptFile(
	filename: string,
	isGlobal: boolean,
	category: string,
): Promise<void> {
	// Input validation
	if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
		throw new Error("Filename is required and must be a non-empty string")
	}
	
	if (!category || typeof category !== "string") {
		throw new Error("Category is required and must be a valid string")
	}
	
	if (!["analysis", "visualization", "reporting", "methodology"].includes(category)) {
		throw new Error(`Invalid category "${category}". Must be one of: analysis, visualization, reporting, methodology`)
	}

	const workspacePath = getWorkspacePath()
	if (!workspacePath && !isGlobal) {
		throw new Error("No workspace found. Please open a workspace or use global scope.")
	}

	// Sanitize filename and ensure .yaml extension
	const sanitizedFilename = filename.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
	const finalFilename = sanitizedFilename.endsWith(".yaml") ? sanitizedFilename : `${sanitizedFilename}.yaml`
	
	try {
		// Create directory if it doesn't exist
		const promptsDir = getPromptDirectoryPath(isGlobal)
		await fs.mkdir(promptsDir, { recursive: true })

		const filePath = path.join(promptsDir, finalFilename)

		// Check if file already exists
		if (await fileExistsAtPath(filePath)) {
			throw new Error(`Prompt file "${finalFilename}" already exists in ${isGlobal ? "global" : "workspace"} scope`)
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes("already exists")) {
			throw error // Re-throw file exists error as-is
		}
		throw new Error(`Failed to create prompt directory: ${error instanceof Error ? error.message : "Unknown error"}`)
	}

	try {
		// Generate template content
		const promptsDir = getPromptDirectoryPath(isGlobal)
		const filePath = path.join(promptsDir, finalFilename)
		const baseFileName = path.basename(finalFilename, ".yaml")
		const content = generatePromptTemplate(baseFileName, category)

		// Write file and open in editor
		await fs.writeFile(filePath, content, "utf8")
		await openFile(filePath)
		
		// Show success message
		const scope = isGlobal ? "global" : "workspace"
		vscode.window.showInformationMessage(`Created ${scope} prompt: ${finalFilename}`)
	} catch (error) {
		throw new Error(`Failed to create prompt file: ${error instanceof Error ? error.message : "Unknown error"}`)
	}
}

/**
 * Delete an existing custom prompt file
 * @param promptName - Name of the prompt to delete
 * @param source - Source scope ("workspace" or "global")
 */
export async function deletePromptFile(
	promptName: string,
	source: "workspace" | "global"
): Promise<void> {
	// Input validation
	if (!promptName || typeof promptName !== "string" || promptName.trim().length === 0) {
		throw new Error("Prompt name is required and must be a non-empty string")
	}
	
	if (!source || (source !== "workspace" && source !== "global")) {
		throw new Error("Source must be either 'workspace' or 'global'")
	}

	const isGlobal = source === "global"
	const filePath = getPromptFilePath(promptName.trim(), isGlobal)
	
	// Check if file exists
	if (!(await fileExistsAtPath(filePath))) {
		throw new Error(`Prompt file "${promptName}" not found in ${source} scope`)
	}

	try {
		// Show confirmation dialog
		const deleteAction = "Delete"
		const result = await vscode.window.showWarningMessage(
			`Are you sure you want to delete the prompt "${promptName}"?\n\nThis action cannot be undone.`,
			{ modal: true },
			deleteAction,
		)

		if (result === deleteAction) {
			await fs.unlink(filePath)
			const scope = isGlobal ? "global" : "workspace"
			vscode.window.showInformationMessage(`Deleted ${scope} prompt: ${promptName}`)
		} else {
			// User cancelled deletion
			console.log(`[deletePromptFile] User cancelled deletion of prompt: ${promptName}`)
		}
	} catch (error) {
		throw new Error(`Failed to delete prompt file: ${error instanceof Error ? error.message : "Unknown error"}`)
	}
}

/**
 * Open an existing prompt file for editing in VSCode
 * @param promptName - Name of the prompt to edit
 * @param source - Source scope ("workspace" or "global")
 */
export async function editPromptBlock(
	promptName: string,
	source: "workspace" | "global"
): Promise<void> {
	// Input validation
	if (!promptName || typeof promptName !== "string" || promptName.trim().length === 0) {
		throw new Error("Prompt name is required and must be a non-empty string")
	}
	
	if (!source || (source !== "workspace" && source !== "global")) {
		throw new Error("Source must be either 'workspace' or 'global'")
	}

	const isGlobal = source === "global"
	const filePath = getPromptFilePath(promptName.trim(), isGlobal)
	
	// Check if file exists
	if (!(await fileExistsAtPath(filePath))) {
		throw new Error(`Prompt file "${promptName}" not found in ${source} scope`)
	}

	try {
		// Open file in VSCode editor
		await openFile(filePath)
		console.log(`[editPromptBlock] Opened prompt file for editing: ${promptName} (${source})`)
	} catch (error) {
		throw new Error(`Failed to open prompt file for editing: ${error instanceof Error ? error.message : "Unknown error"}`)
	}
}