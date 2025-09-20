import { PromptBlockData } from "../domain/PromptBlock"

/**
 * Validation result for prompt blocks
 */
export interface ValidationResult {
	readonly isValid: boolean
	readonly errors: ValidationError[]
	readonly warnings: ValidationWarning[]
}

/**
 * Validation error with context
 */
export interface ValidationError {
	readonly field: string
	readonly message: string
	readonly code: string
}

/**
 * Validation warning (non-blocking)
 */
export interface ValidationWarning {
	readonly field: string
	readonly message: string
	readonly suggestion?: string
}

/**
 * Schema validation options
 */
export interface ValidationOptions {
	readonly strict?: boolean
	readonly requireDescription?: boolean
	readonly requireTags?: boolean
	readonly maxPromptLength?: number
}

/**
 * Validator interface for prompt block validation
 * 
 * This port defines the contract for validating prompt block data
 * before creating domain objects.
 */
export interface IPromptBlockValidator {
	/**
	 * Validate prompt block data structure and content
	 */
	validate(data: PromptBlockData, options?: ValidationOptions): ValidationResult

	/**
	 * Validate YAML schema structure
	 */
	validateSchema(rawData: unknown): ValidationResult

	/**
	 * Validate prompt block name format
	 */
	validateName(name: string): ValidationResult

	/**
	 * Validate category value
	 */
	validateCategory(category: string): ValidationResult

	/**
	 * Validate prompt content
	 */
	validatePrompt(prompt: string, options?: ValidationOptions): ValidationResult

	/**
	 * Validate variables array
	 */
	validateVariables(variables?: unknown[]): ValidationResult

	/**
	 * Get default validation options
	 */
	getDefaultOptions(): ValidationOptions
}