/**
 * Module: ExtendedTemplate (domain/entity)
 * Purpose: Domain entity representing a template with agents, prompts, and rules
 * Responsibilities:
 *  - Encapsulate template configuration data
 *  - Provide type-safe access to all template sections
 *  - Track template metadata for caching and validation
 * Invariants:
 *  - Template must have at least one section (agents/prompts/rules)
 *  - All block names must be unique within their section
 *  - Source tracking preserved for all blocks
 * Dependencies: Domain types from @roo-code/types
 * Security: No direct file access; data must be validated before construction
 */

import type { ModeConfig, TemplatePromptBlock as SchemaPromptBlock, TemplateRule as SchemaRule } from "@roo-code/types"

/**
 * Domain entity for template prompt blocks
 * @description Extends schema type with runtime source tracking
 */
export interface TemplatePromptBlock extends SchemaPromptBlock {
	readonly source: "template" // Always 'template' for source tracking
}

/**
 * Domain entity for template rules
 * @description Extends schema type with runtime metadata
 */
export interface TemplateRule extends SchemaRule {
	readonly source: "template" // Always 'template' for source tracking
	readonly path?: string // Virtual path for toggle state tracking
}

/**
 * Template metadata for caching and validation
 */
export interface TemplateMetadata {
	readonly name: string
	readonly filename: string
	readonly loadedAt: number // Unix timestamp
	readonly version?: string // Optional version tracking
}

/**
 * Extended template domain entity
 * @description Complete template configuration with all supported sections
 * @example
 * const template: ExtendedTemplate = {
 *   agents: [...],
 *   prompts: [...],
 *   rules: [...],
 *   metadata: { name: 'data-analysis', ... }
 * }
 */
export interface ExtendedTemplate {
	readonly agents: readonly ModeConfig[]
	readonly prompts: readonly TemplatePromptBlock[]
	readonly rules: readonly TemplateRule[]
	readonly metadata: TemplateMetadata
}

/**
 * Template validation result
 * @description Result of template validation with detailed errors
 */
export interface TemplateValidationResult {
	readonly isValid: boolean
	readonly errors: readonly TemplateValidationError[]
}

/**
 * Template validation error
 * @description Detailed error information for template validation failures
 */
export interface TemplateValidationError {
	readonly section: "agents" | "prompts" | "rules"
	readonly field?: string
	readonly message: string
	readonly index?: number // For array items
}

/**
 * Template builder for creating valid templates
 * @description Ensures all invariants are maintained during construction
 */
export class ExtendedTemplateBuilder {
	private agents: ModeConfig[] = []
	private prompts: TemplatePromptBlock[] = []
	private rules: TemplateRule[] = []
	private metadata: TemplateMetadata | null = null

	/**
	 * Set template agents
	 * @throws {Error} If agents array contains duplicates
	 */
	setAgents(agents: readonly ModeConfig[]): this {
		const slugs = new Set<string>()
		for (const agent of agents) {
			if (slugs.has(agent.slug)) {
				throw new Error(`Duplicate agent slug: ${agent.slug}`)
			}
			slugs.add(agent.slug)
		}
		this.agents = [...agents]
		return this
	}

	/**
	 * Set template prompts with source tracking
	 * @throws {Error} If prompts array contains duplicate names
	 */
	setPrompts(prompts: readonly SchemaPromptBlock[]): this {
		const names = new Set<string>()
		this.prompts = prompts.map((p) => {
			if (names.has(p.name)) {
				throw new Error(`Duplicate prompt name: ${p.name}`)
			}
			names.add(p.name)
			return { ...p, source: "template" as const }
		})
		return this
	}

	/**
	 * Set template rules with source tracking
	 * @throws {Error} If rules array contains duplicate names
	 */
	setRules(rules: readonly SchemaRule[], templateName: string): this {
		const names = new Set<string>()
		this.rules = rules.map((r, index) => {
			if (names.has(r.name)) {
				throw new Error(`Duplicate rule name: ${r.name}`)
			}
			names.add(r.name)
			return {
				...r,
				source: "template" as const,
				path: `template:${templateName}:${index}`, // Virtual path for toggle tracking
			}
		})
		return this
	}

	/**
	 * Set template metadata
	 */
	setMetadata(metadata: TemplateMetadata): this {
		this.metadata = metadata
		return this
	}

	/**
	 * Build the template
	 * @throws {Error} If template is empty or metadata is missing
	 */
	build(): ExtendedTemplate {
		if (!this.metadata) {
			throw new Error("Template metadata is required")
		}

		// Ensure at least one section has content
		if (this.agents.length === 0 && this.prompts.length === 0 && this.rules.length === 0) {
			throw new Error("Template must have at least one section with content")
		}

		return {
			agents: Object.freeze(this.agents),
			prompts: Object.freeze(this.prompts),
			rules: Object.freeze(this.rules),
			metadata: Object.freeze(this.metadata),
		}
	}
}

/**
 * Template validator
 * @description Validates template structure and content
 */
export class ExtendedTemplateValidator {
	/**
	 * Validate a template
	 * @returns Validation result with detailed errors
	 */
	validate(template: ExtendedTemplate): TemplateValidationResult {
		const errors: TemplateValidationError[] = []

		// Validate agents
		const agentSlugs = new Set<string>()
		template.agents.forEach((agent, index) => {
			if (agentSlugs.has(agent.slug)) {
				errors.push({
					section: "agents",
					field: "slug",
					message: `Duplicate agent slug: ${agent.slug}`,
					index,
				})
			}
			agentSlugs.add(agent.slug)
		})

		// Validate prompts
		const promptNames = new Set<string>()
		template.prompts.forEach((prompt, index) => {
			if (promptNames.has(prompt.name)) {
				errors.push({
					section: "prompts",
					field: "name",
					message: `Duplicate prompt name: ${prompt.name}`,
					index,
				})
			}
			promptNames.add(prompt.name)

			// Validate source tracking
			if (prompt.source !== "template") {
				errors.push({
					section: "prompts",
					field: "source",
					message: `Invalid source for template prompt: ${prompt.source}`,
					index,
				})
			}
		})

		// Validate rules
		const ruleNames = new Set<string>()
		template.rules.forEach((rule, index) => {
			if (ruleNames.has(rule.name)) {
				errors.push({
					section: "rules",
					field: "name",
					message: `Duplicate rule name: ${rule.name}`,
					index,
				})
			}
			ruleNames.add(rule.name)

			// Validate source tracking
			if (rule.source !== "template") {
				errors.push({
					section: "rules",
					field: "source",
					message: `Invalid source for template rule: ${rule.source}`,
					index,
				})
			}
		})

		// Check for at least one section
		if (template.agents.length === 0 && template.prompts.length === 0 && template.rules.length === 0) {
			errors.push({
				section: "agents",
				message: "Template must have at least one section with content",
			})
		}

		return {
			isValid: errors.length === 0,
			errors: Object.freeze(errors),
		}
	}
}
