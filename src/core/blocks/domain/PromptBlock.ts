/**
 * Module: PromptBlock (domain/entity)
 * Purpose: Core domain entity representing a prompt block with validation and template resolution.
 * Responsibilities: 
 *  - Encapsulate prompt block data and business rules
 *  - Validate prompt block structure and content
 *  - Provide template variable resolution
 *  - Ensure immutability and data integrity
 * Invariants:
 *  - PromptBlock instances are immutable after creation
 *  - Name must be valid identifier (alphanumeric, dashes, underscores)
 *  - Category must be from valid PromptCategory enum
 *  - Prompt content must be non-empty string
 *  - Tags array is readonly to prevent mutation
 *  - Priority must be positive integer (0-100)
 * Dependencies: PromptCategory domain value object
 * Security: No secret or PII storage; template variables are sanitized
 * Performance: Immutable design enables safe caching and sharing
 */

import { PromptCategory, isValidCategory } from "./PromptCategory"

/**
 * Template variable definition for prompt blocks
 * 
 * Used to define dynamic parameters that can be substituted in prompt templates.
 * Supports validation, default values, and user guidance.
 * 
 * @example
 * ```yaml
 * variables:
 *   - name: "dataset_name"
 *     description: "Name of the dataset to analyze" 
 *     required: true
 *   - name: "analysis_depth"
 *     description: "Depth of analysis (basic|detailed|comprehensive)"
 *     required: false
 *     defaultValue: "detailed"
 * ```
 */
export interface PromptVariable {
	readonly name: string
	readonly description: string
	readonly required: boolean
	readonly defaultValue?: string
}

/**
 * Expected output specification for prompt blocks
 * 
 * Defines the expected format and structure of output generated
 * when the prompt block is used. Helps users understand what
 * kind of response to expect.
 * 
 * @example
 * ```yaml
 * expectedOutput:
 *   type: "markdown"
 *   description: "Statistical analysis report with visualizations"
 *   format: "## Analysis Results\n### Summary\n### Detailed Findings"
 * ```
 */
export interface PromptOutput {
	/** Output format type */
	readonly type: "text" | "code" | "chart" | "markdown"
	/** Human-readable description of expected output */
	readonly description: string
	/** Optional format template or example */
	readonly format?: string
}

/**
 * Domain validation error for prompt blocks
 * 
 * Thrown when prompt block data violates domain rules or constraints.
 * Includes field-specific information for precise error reporting.
 * 
 * @example
 * ```ts
 * throw new PromptBlockValidationError(
 *   "Name must be alphanumeric with dashes and underscores only",
 *   "name"
 * )
 * ```
 */
export class PromptBlockValidationError extends Error {
	/**
	 * Create a new validation error
	 * 
	 * @param message - Human-readable error message
	 * @param field - Optional field name that caused the validation error
	 */
	constructor(message: string, public readonly field?: string) {
		super(message)
		this.name = "PromptBlockValidationError"
	}
}

/**
 * Raw prompt block data as loaded from YAML files
 * 
 * Represents unvalidated data structure before domain validation.
 * Used as input to PromptBlock.create() factory method.
 * 
 * @example
 * ```yaml
 * name: "eda-analysis"
 * description: "Comprehensive exploratory data analysis"
 * category: "analysis"
 * tags: ["data", "exploration", "statistics"]
 * priority: 80
 * enabled: true
 * prompt: |
 *   When performing EDA, follow this approach:
 *   1. Display dataset shape and info
 *   2. Check for missing values
 * ```
 */
export interface PromptBlockData {
	name: string
	description?: string
	category: string
	tags?: string[]
	prompt: string
	variables?: PromptVariable[]
	outputs?: PromptOutput[]
	priority?: number
	enabled?: boolean
}

/**
 * Immutable prompt block domain model
 * 
 * Represents a reusable prompt instruction that can be added to the system prompt.
 * Follows Clean Architecture principles with pure domain logic and validation.
 */
export class PromptBlock {
	private constructor(
		public readonly name: string,
		public readonly description: string,
		public readonly category: PromptCategory,
		public readonly tags: readonly string[],
		public readonly prompt: string,
		public readonly variables: readonly PromptVariable[],
		public readonly outputs: readonly PromptOutput[],
		public readonly priority: number,
		public readonly enabled: boolean,
	) {}

	/**
	 * Factory method to create a PromptBlock with validation
	 */
	static create(data: PromptBlockData): PromptBlock {
		// Validate required fields
		if (!data.name?.trim()) {
			throw new PromptBlockValidationError("Name is required", "name")
		}

		if (!data.prompt?.trim()) {
			throw new PromptBlockValidationError("Prompt is required", "prompt")
		}

		if (!data.category?.trim()) {
			throw new PromptBlockValidationError("Category is required", "category")
		}

		// Validate category
		if (!isValidCategory(data.category)) {
			throw new PromptBlockValidationError(
				`Invalid category: ${data.category}. Must be one of: analysis, visualization, reporting, methodology`,
				"category"
			)
		}

		// Validate name format
		if (!data.name.match(/^[a-zA-Z0-9_-]+$/)) {
			throw new PromptBlockValidationError(
				"Name must contain only letters, numbers, underscores, and hyphens",
				"name"
			)
		}

		// Validate variables if provided
		if (data.variables) {
			for (const variable of data.variables) {
				if (!variable.name?.trim()) {
					throw new PromptBlockValidationError("Variable name is required", "variables")
				}
			}
		}

		// Validate priority range
		const priority = data.priority ?? 50
		if (priority < 0 || priority > 100) {
			throw new PromptBlockValidationError(
				"Priority must be between 0 and 100",
				"priority"
			)
		}

		return new PromptBlock(
			data.name.trim(),
			data.description?.trim() || "",
			data.category as PromptCategory,
			data.tags ? [...data.tags] : [],
			data.prompt.trim(),
			data.variables ? [...data.variables] : [],
			data.outputs ? [...data.outputs] : [],
			priority,
			data.enabled ?? true
		)
	}

	/**
	 * Check if this prompt block has variables
	 */
	hasVariables(): boolean {
		return this.variables.length > 0
	}

	/**
	 * Check if this prompt block is enabled
	 */
	isEnabled(): boolean {
		return this.enabled
	}

	/**
	 * Get required variables
	 */
	getRequiredVariables(): PromptVariable[] {
		return this.variables.filter(v => v.required)
	}

	/**
	 * Get the prompt with variables replaced
	 */
	resolvePrompt(variableValues?: Record<string, string>): string {
		if (!this.hasVariables()) {
			return this.prompt
		}

		let resolvedPrompt = this.prompt
		
		for (const variable of this.variables) {
			const value = variableValues?.[variable.name] || variable.defaultValue || ""
			const placeholder = `{{${variable.name}}}`
			resolvedPrompt = resolvedPrompt.replace(new RegExp(placeholder, "g"), value)
		}

		return resolvedPrompt
	}

	/**
	 * Check if this block has a specific tag
	 */
	hasTag(tag: string): boolean {
		return this.tags.includes(tag)
	}

	/**
	 * Get a unique identifier for this prompt block
	 */
	getId(): string {
		return `${this.category}:${this.name}`
	}

	/**
	 * Convert to plain object for serialization
	 */
	toData(): PromptBlockData {
		return {
			name: this.name,
			description: this.description,
			category: this.category,
			tags: [...this.tags],
			prompt: this.prompt,
			variables: [...this.variables],
			outputs: [...this.outputs],
			priority: this.priority,
			enabled: this.enabled,
		}
	}

	/**
	 * Create a copy with updated enabled status
	 */
	withEnabled(enabled: boolean): PromptBlock {
		return new PromptBlock(
			this.name,
			this.description,
			this.category,
			this.tags,
			this.prompt,
			this.variables,
			this.outputs,
			this.priority,
			enabled
		)
	}
}