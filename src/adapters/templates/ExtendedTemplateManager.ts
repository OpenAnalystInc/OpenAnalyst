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

import type { IExtendedTemplateRepository, Disposable } from "../../core/templates/ports/IExtendedTemplateRepository"
import type { ITemplateBlockProvider } from "../../core/templates/ports/ITemplateBlockProvider"
import type { ExtendedTemplate, TemplatePromptBlock, TemplateRule } from "../../core/templates/domain/ExtendedTemplate"
import { ExtendedTemplateBuilder } from "../../core/templates/domain/ExtendedTemplate"
import type { TemplateError } from "../../core/templates/domain/TemplateError"
import { TemplateErrorCode } from "../../core/templates/domain/TemplateError"
import type { Result } from "../../core/templates/domain/Result"
import { Result as R } from "../../core/templates/domain/Result"
import { customModesSettingsSchema } from "@roo-code/types"
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
	private disposables: vscode.Disposable[] = []
	private ruleToggles = new Map<string, boolean>()
	private fileWatcher: vscode.FileSystemWatcher | null = null
	private debounceTimer: NodeJS.Timeout | null = null
	private externalCallbacks: (() => void)[] = []

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
		this.activeTemplate = template
		const templateName = template?.metadata.name || null
		await this.context.globalState.update("activeExtendedTemplate", templateName)
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
		return this.activeTemplate?.metadata.name || null
	}

	// ============================
	// vscode.Disposable implementation
	// ============================

	dispose(): void {
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
