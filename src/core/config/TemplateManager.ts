// oacode_change - new file
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import stripBom from "strip-bom"

import { type ModeConfig, customModesSettingsSchema } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"
import { initializeModes, reloadTemplateModes } from "../../shared/modes"
import { setActiveTemplate } from "../../shared/templateModeLoader"

const TEMPLATES_DIRECTORY = ".oacode/templates"

interface TemplateInfo {
	name: string
	filename: string
	modeCount: number
	modes: { slug: string; name: string }[]
}

interface TemplateData {
	customModes: ModeConfig[]
}

export class TemplateManager {
	private activeTemplateName: string | null = null
	private disposables: vscode.Disposable[] = []

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onTemplateChange: () => Promise<void>,
	) {
		this.loadActiveTemplate()
		this.watchTemplateDirectory()
	}

	/**
	 * Clean invisible and problematic characters from YAML content
	 */
	private cleanInvisibleCharacters(content: string): string {
		const PROBLEMATIC_CHARS_REGEX =
			/[\u00A0\u200B\u200C\u200D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]/g

		return content.replace(PROBLEMATIC_CHARS_REGEX, (match) => {
			switch (match) {
				case "\u00A0": return " "
				case "\u200B":
				case "\u200C":
				case "\u200D": return ""
				case "\u2018":
				case "\u2019": return "'"
				case "\u201C":
				case "\u201D": return '"'
				default: return "-"
			}
		})
	}

	/**
	 * Parse YAML content safely
	 */
	private parseYamlSafely(content: string, filePath: string): any {
		let cleanedContent = stripBom(content)
		cleanedContent = this.cleanInvisibleCharacters(cleanedContent)

		try {
			const parsed = yaml.parse(cleanedContent)
			return parsed ?? {}
		} catch (yamlError) {
			const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
			console.error(`[TemplateManager] Failed to parse YAML from ${filePath}:`, errorMsg)
			throw new Error(`Invalid YAML: ${errorMsg}`)
		}
	}

	/**
	 * Get templates directory path
	 */
	private getTemplatesDirectory(): string | null {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) {
			return null
		}
		return path.join(workspacePath, TEMPLATES_DIRECTORY)
	}

	/**
	 * Get all available template files
	 */
	public async getAvailableTemplates(): Promise<TemplateInfo[]> {
		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) {
			return []
		}

		try {
			const exists = await fileExistsAtPath(templatesDir)
			if (!exists) {
				return []
			}

			const entries = await fs.readdir(templatesDir, { withFileTypes: true })
			const yamlFiles = entries
				.filter((entry) => entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))

			const templates: TemplateInfo[] = []

			for (const file of yamlFiles) {
				try {
					const filePath = path.join(templatesDir, file.name)
					const content = await fs.readFile(filePath, 'utf-8')
					const data = this.parseYamlSafely(content, filePath)

					const validationResult = customModesSettingsSchema.safeParse(data)
					if (validationResult.success) {
						const modes = validationResult.data.customModes.map(mode => ({
							slug: mode.slug,
							name: mode.name || mode.slug
						}))

						templates.push({
							name: path.basename(file.name, path.extname(file.name)),
							filename: file.name,
							modeCount: validationResult.data.customModes.length,
							modes
						})
					}
				} catch (error) {
					console.warn(`[TemplateManager] Failed to parse template ${file.name}:`, error)
				}
			}

			return templates
		} catch (error) {
			console.error('[TemplateManager] Failed to get available templates:', error)
			return []
		}
	}

	/**
	 * Load active template from storage
	 */
	private async loadActiveTemplate(): Promise<void> {
		this.activeTemplateName = await this.context.globalState.get<string | null>('activeTemplate', null)
		// Sync with template loader
		setActiveTemplate(this.activeTemplateName)
	}

	/**
	 * Save active template to storage
	 */
	private async saveActiveTemplate(): Promise<void> {
		await this.context.globalState.update('activeTemplate', this.activeTemplateName)
		// Sync with template loader
		setActiveTemplate(this.activeTemplateName)
	}

	/**
	 * Get currently active template name
	 */
	public getActiveTemplateName(): string | null {
		return this.activeTemplateName
	}

	/**
	 * Activate a template by name
	 */
	public async activateTemplate(templateName: string): Promise<boolean> {
		const templates = await this.getAvailableTemplates()
		const template = templates.find(t => t.name === templateName)
		
		if (!template) {
			throw new Error(`Template "${templateName}" not found`)
		}

		this.activeTemplateName = templateName
		await this.saveActiveTemplate()

		// Reload modes with the new template
		await reloadTemplateModes()
		await this.onTemplateChange()

		return true
	}

	/**
	 * Deactivate current template
	 */
	public async deactivateTemplate(): Promise<void> {
		this.activeTemplateName = null
		await this.saveActiveTemplate()

		// Reload modes without template
		await reloadTemplateModes()
		await this.onTemplateChange()
	}

	/**
	 * Delete a template file
	 */
	public async deleteTemplate(templateName: string): Promise<boolean> {
		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) {
			throw new Error('No workspace found')
		}

		const templates = await this.getAvailableTemplates()
		const template = templates.find(t => t.name === templateName)
		
		if (!template) {
			throw new Error(`Template "${templateName}" not found`)
		}

		const filePath = path.join(templatesDir, template.filename)
		
		try {
			await fs.unlink(filePath)
			
			// If this was the active template, deactivate it
			if (this.activeTemplateName === templateName) {
				await this.deactivateTemplate()
			}
			
			return true
		} catch (error) {
			throw new Error(`Failed to delete template: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Get modes from active template
	 */
	public async getActiveTemplateModes(): Promise<ModeConfig[]> {
		if (!this.activeTemplateName) {
			return []
		}

		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) {
			return []
		}

		const templates = await this.getAvailableTemplates()
		const template = templates.find(t => t.name === this.activeTemplateName)
		
		if (!template) {
			console.warn(`[TemplateManager] Active template "${this.activeTemplateName}" not found`)
			this.activeTemplateName = null
			await this.saveActiveTemplate()
			return []
		}

		try {
			const filePath = path.join(templatesDir, template.filename)
			const content = await fs.readFile(filePath, 'utf-8')
			const data = this.parseYamlSafely(content, filePath)

			const validationResult = customModesSettingsSchema.safeParse(data)
			if (validationResult.success) {
				return validationResult.data.customModes
			}
		} catch (error) {
			console.error(`[TemplateManager] Failed to load active template modes:`, error)
		}

		return []
	}

	/**
	 * Watch template directory for changes
	 */
	private async watchTemplateDirectory(): Promise<void> {
		if (process.env.NODE_ENV === "test") {
			return
		}

		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) {
			return
		}

		// Create directory if it doesn't exist
		try {
			await fs.mkdir(templatesDir, { recursive: true })
		} catch (error) {
			console.warn('[TemplateManager] Failed to create templates directory:', error)
			return
		}

		// Watch for changes in template files
		const pattern = path.join(templatesDir, "**/*.{yaml,yml}")
		const watcher = vscode.workspace.createFileSystemWatcher(pattern)

		const handleChange = async () => {
			try {
				await reloadTemplateModes()
				await this.onTemplateChange()
			} catch (error) {
				console.error('[TemplateManager] Error handling template change:', error)
			}
		}

		this.disposables.push(watcher.onDidChange(handleChange))
		this.disposables.push(watcher.onDidCreate(handleChange))
		this.disposables.push(watcher.onDidDelete(handleChange))
		this.disposables.push(watcher)
	}

	/**
	 * Initialize template manager and load active template modes
	 */
	public async initialize(): Promise<void> {
		await initializeModes()
		if (this.activeTemplateName) {
			await reloadTemplateModes()
		}
	}

	/**
	 * Dispose of watchers and clean up
	 */
	public dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}
}