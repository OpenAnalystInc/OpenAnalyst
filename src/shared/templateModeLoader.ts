// oacode_change - new file
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import stripBom from "strip-bom"

import { type ModeConfig, customModesSettingsSchema } from "@roo-code/types"
import { fileExistsAtPath } from "../utils/fs"
import { getWorkspacePath } from "../utils/path"

const TEMPLATES_DIRECTORY = ".oacode/templates"

interface TemplateModesData {
	customModes: ModeConfig[]
}

/**
 * Clean invisible and problematic characters from YAML content
 */
function cleanInvisibleCharacters(content: string): string {
	const PROBLEMATIC_CHARS_REGEX =
		/[\u00A0\u200B\u200C\u200D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]/g

	return content.replace(PROBLEMATIC_CHARS_REGEX, (match) => {
		switch (match) {
			case "\u00A0": // Non-breaking space
				return " "
			case "\u200B": // Zero-width space
			case "\u200C": // Zero-width non-joiner
			case "\u200D": // Zero-width joiner
				return ""
			case "\u2018": // Left single quotation mark
			case "\u2019": // Right single quotation mark
				return "'"
			case "\u201C": // Left double quotation mark
			case "\u201D": // Right double quotation mark
				return '"'
			default: // Dash characters
				return "-"
		}
	})
}

/**
 * Parse YAML content with enhanced error handling
 */
function parseYamlSafely(content: string, filePath: string): any {
	let cleanedContent = stripBom(content)
	cleanedContent = cleanInvisibleCharacters(cleanedContent)

	try {
		const parsed = yaml.parse(cleanedContent)
		return parsed ?? {}
	} catch (yamlError) {
		const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
		console.error(`[TemplateModeLoader] Failed to parse YAML from ${filePath}:`, errorMsg)
		return {}
	}
}

/**
 * Get the templates directory path for the current workspace
 */
async function getTemplatesDirectory(): Promise<string | null> {
	const workspacePath = getWorkspacePath()
	if (!workspacePath) {
		return null
	}

	const templatesPath = path.join(workspacePath, TEMPLATES_DIRECTORY)
	
	try {
		const stats = await fs.stat(templatesPath)
		return stats.isDirectory() ? templatesPath : null
	} catch {
		return null
	}
}

/**
 * Load modes from a single YAML template file
 */
async function loadModesFromTemplateFile(filePath: string): Promise<ModeConfig[]> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const data = parseYamlSafely(content, filePath)

		if (!data || typeof data !== "object" || !data.customModes) {
			return []
		}

		const result = customModesSettingsSchema.safeParse(data)

		if (!result.success) {
			console.error(`[TemplateModeLoader] Schema validation failed for ${filePath}:`, result.error)
			return []
		}

		// Return modes without source modification - they'll be treated as default modes
		return result.data.customModes
	} catch (error) {
		console.error(`[TemplateModeLoader] Failed to load modes from template ${filePath}:`, error)
		return []
	}
}

// oacode_change - updated to work with active template system
let _activeTemplateName: string | null = null

/**
 * Set the active template name (called by TemplateManager)
 */
export function setActiveTemplate(templateName: string | null): void {
	_activeTemplateName = templateName
}

/**
 * Load modes from the currently active template only
 * These modes will be added to DEFAULT_MODES dynamically
 */
export async function loadTemplateModes(): Promise<ModeConfig[]> {
	// If no active template, return empty array
	if (!_activeTemplateName) {
		return []
	}

	const templatesDir = await getTemplatesDirectory()
	if (!templatesDir) {
		return []
	}

	try {
		// Look for the active template file
		const entries = await fs.readdir(templatesDir, { withFileTypes: true })
		const yamlFiles = entries
			.filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))

		// Find the file that matches the active template name
		let activeTemplateFile: string | null = null
		for (const file of yamlFiles) {
			const baseName = path.basename(file.name, path.extname(file.name))
			if (baseName === _activeTemplateName) {
				activeTemplateFile = path.join(templatesDir, file.name)
				break
			}
		}

		if (!activeTemplateFile) {
			console.warn(`[TemplateModeLoader] Active template "${_activeTemplateName}" file not found`)
			return []
		}

		const modes = await loadModesFromTemplateFile(activeTemplateFile)
		console.log(`[TemplateModeLoader] Loaded ${modes.length} modes from active template "${_activeTemplateName}"`)
		return modes
	} catch (error) {
		console.error("[TemplateModeLoader] Failed to load template modes:", error)
		return []
	}
}

/**
 * Check if templates directory exists
 */
export async function hasTemplatesDirectory(): Promise<boolean> {
	const templatesDir = await getTemplatesDirectory()
	return templatesDir !== null
}