/**
 * Module: TemplateError (domain/error)
 * Purpose: Domain-specific error types for template operations
 * Responsibilities:
 *  - Provide typed errors with context
 *  - Support error codes for pattern matching
 *  - Maintain error cause chain
 * Invariants: Error codes must be unique and descriptive
 * Dependencies: None (pure domain)
 * Security: Never include file paths or sensitive data in error messages
 */

/**
 * Template error codes for precise error handling
 */
export enum TemplateErrorCode {
	// Validation errors
	INVALID_NAME = "TEMPLATE_INVALID_NAME",
	INVALID_YAML = "TEMPLATE_INVALID_YAML",
	PARSE_FAILED = "TEMPLATE_PARSE_FAILED",
	VALIDATION_FAILED = "TEMPLATE_VALIDATION_FAILED",

	// File system errors
	NOT_FOUND = "TEMPLATE_NOT_FOUND",
	READ_FAILED = "TEMPLATE_READ_FAILED",
	WRITE_FAILED = "TEMPLATE_WRITE_FAILED",

	// Runtime errors
	ALREADY_ACTIVE = "TEMPLATE_ALREADY_ACTIVE",
	NOT_ACTIVE = "TEMPLATE_NOT_ACTIVE",
	INJECTION_FAILED = "TEMPLATE_INJECTION_FAILED",
}

/**
 * Template error context for debugging
 */
export interface TemplateErrorContext {
	readonly templateName?: string
	readonly filename?: string
	readonly section?: "agents" | "prompts" | "rules"
	readonly field?: string
	readonly index?: number
	readonly cause?: unknown
}

/**
 * Template-specific error class
 * @description Provides structured error information for template operations
 * @example
 * throw new TemplateError(
 *   TemplateErrorCode.PARSE_FAILED,
 *   'Failed to parse template YAML',
 *   { templateName: 'data-analysis', cause: originalError }
 * )
 */
export class TemplateError extends Error {
	public readonly code: TemplateErrorCode
	public readonly context: TemplateErrorContext
	public readonly timestamp: number

	constructor(code: TemplateErrorCode, message?: string, context: TemplateErrorContext = {}) {
		// Generate message if not provided
		const errorMessage = message || TemplateError.getDefaultMessage(code, context)
		super(errorMessage)

		this.name = "TemplateError"
		this.code = code
		this.context = Object.freeze(context)
		this.timestamp = Date.now()

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TemplateError)
		}

		// Attach cause if provided
		if (context.cause instanceof Error) {
			this.cause = context.cause
		}
	}

	/**
	 * Get default message for error code
	 */
	private static getDefaultMessage(code: TemplateErrorCode, context: TemplateErrorContext): string {
		const templateName = context.templateName ? ` '${context.templateName}'` : ""

		switch (code) {
			case TemplateErrorCode.INVALID_NAME:
				return `Invalid template name${templateName}`
			case TemplateErrorCode.INVALID_YAML:
				return `Invalid YAML in template${templateName}`
			case TemplateErrorCode.PARSE_FAILED:
				return `Failed to parse template${templateName}`
			case TemplateErrorCode.VALIDATION_FAILED:
				return `Template validation failed${templateName}`
			case TemplateErrorCode.NOT_FOUND:
				return `Template not found${templateName}`
			case TemplateErrorCode.READ_FAILED:
				return `Failed to read template${templateName}`
			case TemplateErrorCode.WRITE_FAILED:
				return `Failed to write template${templateName}`
			case TemplateErrorCode.ALREADY_ACTIVE:
				return `Template already active${templateName}`
			case TemplateErrorCode.NOT_ACTIVE:
				return `No active template`
			case TemplateErrorCode.INJECTION_FAILED:
				return `Failed to inject template blocks${templateName}`
			default:
				return `Template error${templateName}`
		}
	}

	/**
	 * Check if error is of specific code
	 */
	isCode(code: TemplateErrorCode): boolean {
		return this.code === code
	}

	/**
	 * Convert to plain object for logging
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			context: this.context,
			timestamp: this.timestamp,
			stack: this.stack,
		}
	}

	/**
	 * Create validation error with details
	 */
	static validation(
		templateName: string,
		section: "agents" | "prompts" | "rules",
		message: string,
		field?: string,
		index?: number,
	): TemplateError {
		return new TemplateError(TemplateErrorCode.VALIDATION_FAILED, message, { templateName, section, field, index })
	}

	/**
	 * Create parse error with cause
	 */
	static parse(templateName: string, cause: unknown): TemplateError {
		const message = cause instanceof Error ? cause.message : "Parse failed"
		return new TemplateError(
			TemplateErrorCode.PARSE_FAILED,
			`Failed to parse template '${templateName}': ${message}`,
			{ templateName, cause },
		)
	}

	/**
	 * Create not found error
	 */
	static notFound(templateName: string): TemplateError {
		return new TemplateError(TemplateErrorCode.NOT_FOUND, undefined, { templateName })
	}
}
