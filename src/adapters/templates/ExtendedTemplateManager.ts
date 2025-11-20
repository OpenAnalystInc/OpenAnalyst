/**
 * Module: ExtendedTemplateManager (adapter)
 * Purpose: VS Code implementation of template management with hot reload
 * Responsibilities:
 *  - Parse YAML template files
 *  - Watch for file changes
 *  - Manage active template state
 *  - Provide blocks to other systems
 * Invariants:
 *  - Cache invalidated on file changes
 *  - Rule toggles persist across sessions
 *  - Source tracking maintained for all blocks
 * Dependencies: vscode, yaml parser, file system
 * Security: Sanitize YAML content, prevent path traversal
 * Performance: Cache parsed templates (5 minute TTL), debounce file watches
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "yaml"
import stripBom from "strip-bom"
import { GlobalFileNames } from "../../shared/globalFileNames"

import type { IExtendedTemplateRepository, Disposable } from "../../core/templates/ports/IExtendedTemplateRepository"
import type { ITemplateBlockProvider } from "../../core/templates/ports/ITemplateBlockProvider"
import type { ExtendedTemplate, TemplatePromptBlock, TemplateRule } from "../../core/templates/domain/ExtendedTemplate"
import { ExtendedTemplateBuilder } from "../../core/templates/domain/ExtendedTemplate"
import type { TemplateError } from "../../core/templates/domain/TemplateError"
import { TemplateErrorCode } from "../../core/templates/domain/TemplateError"
import type { Result } from "../../core/templates/domain/Result"
import { Result as R } from "../../core/templates/domain/Result"
import { customModesSettingsSchema, type ModeConfig } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"

const TEMPLATES_DIRECTORY = ".oacode/templates"
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Cached template with timestamp
 */
interface CachedTemplate {
	readonly template: ExtendedTemplate
	readonly timestamp: number
}

/**
 * Extended template manager adapter
 * @description VS Code implementation of template repository and provider
 * @example
 * const manager = new ExtendedTemplateManager(context, onTemplateChange)
 * await manager.initialize()
 */
export class ExtendedTemplateManager implements IExtendedTemplateRepository, ITemplateBlockProvider, vscode.Disposable {
	private cache = new Map<string, CachedTemplate>()
	private activeTemplate: ExtendedTemplate | null = null
	private activeTemplateName: string | null = null
	private disposables: vscode.Disposable[] = []
	private ruleToggles = new Map<string, boolean>()
	private fileWatcher: vscode.FileSystemWatcher | null = null
	private debounceTimer: NodeJS.Timeout | null = null
	private externalCallbacks: (() => void)[] = []
	private generatedFiles = new Set<string>() // Track generated files for cleanup

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onTemplateChange: () => Promise<void>,
	) {}

	/**
	 * Initialize the manager
	 * @description Sets up file watching and loads active template
	 */
	async initialize(): Promise<void> {
		await this.loadToggleStates()
		await this.loadActiveTemplate()
		this.initializeWatcher()
	}

	// ============================
	// IExtendedTemplateRepository implementation
	// ============================

	async loadTemplate(name: string): Promise<Result<ExtendedTemplate, TemplateError>> {
		// Check cache first
		const cached = this.getCached(name)
		if (cached) {
			return R.ok(cached)
		}

		try {
			// Load YAML file
			const filePath = await this.findTemplateFile(name)
			if (!filePath) {
				return R.err({
					code: TemplateErrorCode.NOT_FOUND,
					message: `Template '${name}' not found`,
					context: { templateName: name },
					timestamp: Date.now(),
					name: "TemplateError",
					isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.NOT_FOUND,
					toJSON: () => ({ code: TemplateErrorCode.NOT_FOUND }),
				} as TemplateError)
			}

			const content = await fs.readFile(filePath, "utf-8")
			const parsed = this.parseYamlSafely(content, name)

			if (!parsed) {
				return R.err({
					code: TemplateErrorCode.INVALID_YAML,
					message: `Invalid YAML in template '${name}'`,
					context: { templateName: name },
					timestamp: Date.now(),
					name: "TemplateError",
					isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.INVALID_YAML,
					toJSON: () => ({ code: TemplateErrorCode.INVALID_YAML }),
				} as TemplateError)
			}

			// Validate against schema
			const validationResult = customModesSettingsSchema.safeParse(parsed)
			if (!validationResult.success) {
				const issues = validationResult.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; ")

				return R.err({
					code: TemplateErrorCode.VALIDATION_FAILED,
					message: `Template validation failed: ${issues}`,
					context: { templateName: name },
					timestamp: Date.now(),
					name: "TemplateError",
					isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.VALIDATION_FAILED,
					toJSON: () => ({ code: TemplateErrorCode.VALIDATION_FAILED }),
				} as TemplateError)
			}

			// Build template entity
			const builder = new ExtendedTemplateBuilder()
			builder.setAgents(validationResult.data.Agents || [])
			builder.setPrompts(validationResult.data.Prompts || [])
			builder.setRules(validationResult.data.Rules || [], name)
			builder.setMetadata({
				name,
				filename: path.basename(filePath),
				loadedAt: Date.now(),
			})

			const template = builder.build()

			// Apply rule toggles
			this.applyRuleToggles(template)

			// Cache and return
			this.cache.set(name, { template, timestamp: Date.now() })
			return R.ok(template)
		} catch (error) {
			return R.err({
				code: TemplateErrorCode.PARSE_FAILED,
				message: `Failed to load template '${name}': ${error instanceof Error ? error.message : String(error)}`,
				context: { templateName: name, cause: error },
				timestamp: Date.now(),
				name: "TemplateError",
				isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.PARSE_FAILED,
				toJSON: () => ({ code: TemplateErrorCode.PARSE_FAILED }),
			} as TemplateError)
		}
	}

	getActiveTemplate(): ExtendedTemplate | null {
		return this.activeTemplate
	}

	async setActiveTemplate(template: ExtendedTemplate | null): Promise<void> {
		// Clean up existing generated files first
		await this.cleanupGeneratedFiles()

		this.activeTemplate = template
		this.activeTemplateName = template?.metadata.name || null
		await this.context.globalState.update("activeExtendedTemplate", this.activeTemplateName)

		// Generate new files if template is not null
		if (template) {
			await this.generatePromptFiles(template)
			await this.generateRuleFiles(template)
			// Add a delay to ensure file system watchers detect the changes
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}

	async listTemplates(): Promise<string[]> {
		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) return []

		try {
			const exists = await fileExistsAtPath(templatesDir)
			if (!exists) return []

			const entries = await fs.readdir(templatesDir, { withFileTypes: true })
			return entries
				.filter((entry) => entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")))
				.map((entry) => path.basename(entry.name, path.extname(entry.name)))
		} catch {
			return []
		}
	}

	async templateExists(name: string): Promise<boolean> {
		const filePath = await this.findTemplateFile(name)
		return filePath !== null
	}

	watchForChanges(callback: () => void): Disposable {
		// Add to external callbacks list
		this.externalCallbacks.push(callback)

		// Return a disposable that removes the callback
		return {
			dispose: () => {
				const index = this.externalCallbacks.indexOf(callback)
				if (index >= 0) {
					this.externalCallbacks.splice(index, 1)
				}
			},
		}
	}

	async reloadTemplates(): Promise<void> {
		this.cache.clear()
		if (this.activeTemplate) {
			const result = await this.loadTemplate(this.activeTemplate.metadata.name)
			if (result.ok) {
				this.activeTemplate = result.value
			}
		}
	}

	// ============================
	// ITemplateBlockProvider implementation
	// ============================

	getPrompts(): readonly TemplatePromptBlock[] {
		return this.activeTemplate?.prompts || []
	}

	getRules(): readonly TemplateRule[] {
		if (!this.activeTemplate) return []

		// Apply current toggle states
		return this.activeTemplate.rules.map((rule) => ({
			...rule,
			enabled: this.ruleToggles.get(rule.name) ?? rule.enabled,
		}))
	}

	getPromptByName(name: string): TemplatePromptBlock | undefined {
		return this.activeTemplate?.prompts.find((p) => p.name === name)
	}

	getRuleByName(name: string): TemplateRule | undefined {
		return this.activeTemplate?.rules.find((r) => r.name === name)
	}

	isRuleEnabled(ruleName: string): boolean {
		const rule = this.getRuleByName(ruleName)
		if (!rule) return false
		return this.ruleToggles.get(ruleName) ?? rule.enabled
	}

	async toggleRule(ruleName: string, enabled: boolean): Promise<void> {
		this.ruleToggles.set(ruleName, enabled)
		await this.saveToggleStates()
	}

	getRuleToggles(): ReadonlyMap<string, boolean> {
		return this.ruleToggles
	}

	hasActiveTemplate(): boolean {
		return this.activeTemplate !== null
	}

	getActiveTemplateName(): string | null {
		return this.activeTemplateName
	}

	// ============================
	// Backward compatibility methods for UI integration
	// ============================

	/**
	 * Get available templates with metadata
	 * @description Backward compatibility method for UI
	 */
	async getAvailableTemplates(): Promise<
		Array<{
			name: string
			filename: string
			modeCount: number
			modes: Array<{ slug: string; name: string }>
		}>
	> {
		const templates = await this.listTemplates()
		const result = []

		for (const templateName of templates) {
			try {
				const loadResult = await this.loadTemplate(templateName)
				if (loadResult.ok) {
					const template = loadResult.value
					result.push({
						name: templateName,
						filename: `${templateName}.yaml`,
						modeCount: template.agents.length,
						modes: template.agents.map((agent) => ({
							slug: agent.slug,
							name: agent.name || agent.slug,
						})),
					})
				}
			} catch (error) {
				if (process.env.NODE_ENV === "development") {
					console.warn(`[ExtendedTemplateManager] Failed to load template ${templateName}:`, error)
				}
			}
		}

		return result
	}

	/**
	 * Activate a template by name
	 * @description Backward compatibility method for UI
	 */
	async activateTemplate(templateName: string): Promise<boolean> {
		try {
			const loadResult = await this.loadTemplate(templateName)
			if (!loadResult.ok) {
				throw new Error(`Failed to load template: ${loadResult.error.message}`)
			}

			// Clean up any existing generated files first
			await this.cleanupGeneratedFiles()

			// Set the active template
			await this.setActiveTemplate(loadResult.value)

			// Generate prompt and rule files from the template
			await this.generatePromptFiles(loadResult.value)
			await this.generateRuleFiles(loadResult.value)

			// Add a small delay to ensure file system watchers detect the changes
			await new Promise((resolve) => setTimeout(resolve, 500))

			// Trigger template change to reload prompts/rules in the system
			await this.onTemplateChange()

			// Force a refresh of the prompt blocks cache
			if (process.env.NODE_ENV === "development") {
				console.log("[ExtendedTemplateManager] Template activated, files generated, triggering refresh")
			}

			return true
		} catch (error) {
			if (process.env.NODE_ENV === "development") {
				console.error(`[ExtendedTemplateManager] Failed to activate template:`, error)
			}
			throw error
		}
	}

	/**
	 * Deactivate current template
	 * @description Backward compatibility method for UI
	 */
	async deactivateTemplate(): Promise<void> {
		// Clean up generated files
		await this.cleanupGeneratedFiles()

		this.activeTemplate = null
		this.activeTemplateName = null
		await this.context.globalState.update("activeExtendedTemplate", null)
		await this.context.globalState.update("templateRuleToggles", {})
		this.ruleToggles.clear()
		await this.onTemplateChange()
	}

	/**
	 * Delete a template file
	 * @description Backward compatibility method for UI
	 */
	async deleteTemplate(templateName: string): Promise<boolean> {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) {
			throw new Error("No workspace found")
		}

		const templatesDir = path.join(workspacePath, TEMPLATES_DIRECTORY)
		const filePath = path.join(templatesDir, `${templateName}.yaml`)

		try {
			// Check if file exists with .yaml extension
			let exists = await fileExistsAtPath(filePath)
			let actualPath = filePath

			// If not, try .yml extension
			if (!exists) {
				const ymlPath = path.join(templatesDir, `${templateName}.yml`)
				exists = await fileExistsAtPath(ymlPath)
				actualPath = ymlPath
			}

			if (!exists) {
				throw new Error(`Template "${templateName}" not found`)
			}

			await fs.unlink(actualPath)

			// If this was the active template, deactivate it
			const activeTemplate = await this.getActiveTemplate()
			if (activeTemplate?.metadata.name === templateName) {
				await this.deactivateTemplate()
			}

			// Clear from cache
			this.cache.delete(templateName)

			return true
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to delete template: ${errorMsg}`)
		}
	}

	/**
	 * Get modes from active template
	 * @description Backward compatibility method for UI
	 */
	async getActiveTemplateModes(): Promise<ModeConfig[]> {
		const activeTemplate = await this.getActiveTemplate()
		if (!activeTemplate) {
			return []
		}
		return [...activeTemplate.agents]
	}

	// ============================
	// File Generation Methods
	// ============================

	/**
	 * Generate prompt files from template
	 * @description Creates .yaml files for each template prompt
	 */
	private async generatePromptFiles(template: ExtendedTemplate): Promise<void> {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) return

		// Create prompts directory if it doesn't exist
		const promptsDir = path.join(workspacePath, ".oacode", "prompts")
		await fs.mkdir(promptsDir, { recursive: true })

		// Generate a .yaml file for each prompt
		for (const prompt of template.prompts) {
			const fileName = `template_${prompt.name}.yaml`
			const filePath = path.join(promptsDir, fileName)

			if (process.env.NODE_ENV === "development") {
				console.log(`[ExtendedTemplateManager] Generating prompt file: ${filePath}`)
			}

			// Create YAML content
			const yamlContent = {
				name: prompt.name,
				displayName: prompt.name, // Use name as displayName
				description: prompt.description || "",
				category: prompt.category,
				enabled: true, // Default to enabled
				pinned: false, // Default to not pinned
				priority: prompt.priority || 0,
				prompt: prompt.content, // Use 'prompt' field as expected by YamlPromptBlockParser
			}

			// Write the file
			const yamlString = yaml.stringify(yamlContent)
			await fs.writeFile(filePath, yamlString, "utf-8")
			this.generatedFiles.add(filePath)

			if (process.env.NODE_ENV === "development") {
				console.log(`[ExtendedTemplateManager] Generated prompt file: ${fileName}`)
				console.log(`[ExtendedTemplateManager] Content preview:`, yamlString.substring(0, 200))
			}
		}
	}

	/**
	 * Generate rule files from template
	 * @description Creates .md files for each template rule
	 */
	private async generateRuleFiles(template: ExtendedTemplate): Promise<void> {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) return

		// Create rules directory if it doesn't exist
		const rulesDir = path.join(workspacePath, GlobalFileNames.oaRules)
		await fs.mkdir(rulesDir, { recursive: true })

		// Generate a .md file for each rule
		for (const rule of template.rules) {
			const fileName = `template_${rule.name}.md`
			const filePath = path.join(rulesDir, fileName)

			// Write the rule content directly as markdown
			await fs.writeFile(filePath, rule.content, "utf-8")
			this.generatedFiles.add(filePath)

			if (process.env.NODE_ENV === "development") {
				console.log(`[ExtendedTemplateManager] Generated rule file: ${fileName}`)
			}
		}
	}

	/**
	 * Cleanup generated files
	 * @description Removes all template-generated files
	 */
	private async cleanupGeneratedFiles(): Promise<void> {
		for (const filePath of this.generatedFiles) {
			try {
				await fs.unlink(filePath)
				if (process.env.NODE_ENV === "development") {
					console.log(`[ExtendedTemplateManager] Deleted generated file: ${path.basename(filePath)}`)
				}
			} catch (error) {
				// File might already be deleted, that's OK
				if (process.env.NODE_ENV === "development") {
					console.warn(`[ExtendedTemplateManager] Could not delete file: ${filePath}`, error)
				}
			}
		}
		this.generatedFiles.clear()
	}

	// ============================
	// vscode.Disposable implementation
	// ============================

	dispose(): void {
		// Clean up generated files on dispose
		this.cleanupGeneratedFiles().catch((error) => {
			console.error("[ExtendedTemplateManager] Error cleaning up files on dispose:", error)
		})

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}
		this.disposables.forEach((d) => d.dispose())
		this.fileWatcher?.dispose()
	}

	// ============================
	// Private methods
	// ============================

	private getTemplatesDirectory(): string | null {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) return null
		return path.join(workspacePath, TEMPLATES_DIRECTORY)
	}

	private async findTemplateFile(name: string): Promise<string | null> {
		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) return null

		// Try .yaml first, then .yml
		for (const ext of [".yaml", ".yml"]) {
			const filePath = path.join(templatesDir, `${name}${ext}`)
			if (await fileExistsAtPath(filePath)) {
				return filePath
			}
		}

		return null
	}

	private parseYamlSafely(content: string, templateName: string): any {
		try {
			let cleanedContent = stripBom(content)
			cleanedContent = this.cleanInvisibleCharacters(cleanedContent)
			const parsed = yaml.parse(cleanedContent)
			return parsed ?? {}
		} catch (error) {
			console.error(`[ExtendedTemplateManager] Failed to parse YAML for ${templateName}:`, error)
			return null
		}
	}

	private cleanInvisibleCharacters(content: string): string {
		const PROBLEMATIC_CHARS_REGEX =
			/[\u00A0\u200B\u200C\u200D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]/g

		return content.replace(PROBLEMATIC_CHARS_REGEX, (match) => {
			switch (match) {
				case "\u00A0":
					return " "
				case "\u200B":
				case "\u200C":
				case "\u200D":
					return ""
				case "\u2018":
				case "\u2019":
					return "'"
				case "\u201C":
				case "\u201D":
					return '"'
				default:
					return "-"
			}
		})
	}

	private getCached(name: string): ExtendedTemplate | null {
		const cached = this.cache.get(name)
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.template
		}
		this.cache.delete(name)
		return null
	}

	private applyRuleToggles(template: ExtendedTemplate): void {
		// Apply saved toggle states to rules
		for (const rule of template.rules) {
			const savedState = this.ruleToggles.get(rule.name)
			if (savedState !== undefined) {
				;(rule as any).enabled = savedState // Override readonly for toggle state
			}
		}
	}

	private async loadToggleStates(): Promise<void> {
		const saved = await this.context.globalState.get<Record<string, boolean>>("templateRuleToggles")
		if (saved) {
			Object.entries(saved).forEach(([name, enabled]) => {
				this.ruleToggles.set(name, enabled)
			})
		}
	}

	private async saveToggleStates(): Promise<void> {
		const states = Object.fromEntries(this.ruleToggles)
		await this.context.globalState.update("templateRuleToggles", states)
	}

	private async loadActiveTemplate(): Promise<void> {
		const templateName = await this.context.globalState.get<string>("activeExtendedTemplate")
		if (templateName) {
			const result = await this.loadTemplate(templateName)
			if (result.ok) {
				this.activeTemplate = result.value
				this.activeTemplateName = templateName
				// Generate files for the active template on startup
				await this.generatePromptFiles(result.value)
				await this.generateRuleFiles(result.value)
				// Add a delay to ensure file system watchers detect the changes
				await new Promise((resolve) => setTimeout(resolve, 500))
			}
		}
	}

	private initializeWatcher(): void {
		const templatesDir = this.getTemplatesDirectory()
		if (!templatesDir) return

		const pattern = path.join(templatesDir, "**/*.{yaml,yml}")
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

		const handleChange = () => {
			// Debounce to avoid multiple rapid changes
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer)
			}

			this.debounceTimer = setTimeout(async () => {
				this.cache.clear()
				await this.reloadTemplates()
				await this.onTemplateChange()

				// Call external callbacks
				this.externalCallbacks.forEach((callback) => {
					try {
						callback()
					} catch (error) {
						console.error("[ExtendedTemplateManager] External callback error:", error)
					}
				})
			}, 300)
		}

		this.disposables.push(
			this.fileWatcher.onDidChange(handleChange),
			this.fileWatcher.onDidCreate(handleChange),
			this.fileWatcher.onDidDelete(handleChange),
			this.fileWatcher,
		)
	}
}
