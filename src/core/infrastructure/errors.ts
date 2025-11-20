/**
 * Module: Typed Errors (infrastructure)
 * Purpose: Provide structured, typed error classes for consistent error handling across the extension.
 * Responsibilities: Define error types, context preservation, and user-friendly messaging.
 * Invariants:
 *  - All errors extend BaseError with required code and context
 *  - Error messages are actionable for users
 *  - Stack traces and technical details are preserved for debugging
 *  - No sensitive information in error messages
 * Dependencies: None (pure TypeScript)
 * Security: No secret or PII exposure in error messages or context
 */

/**
 * Context information for errors
 * Used to provide additional debugging information without exposing secrets
 */
export interface ErrorContext {
	readonly [key: string]: unknown
}

/**
 * Base error class for all extension errors
 * 
 * Provides consistent structure and ensures all errors have:
 * - A specific error code for programmatic handling
 * - Structured context for debugging
 * - Preserved stack trace information
 * - User-friendly messaging capability
 */
export class BaseError extends Error {
	/**
	 * Create a new typed error
	 * 
	 * @param code - Specific error code for this error type
	 * @param message - Human-readable error message
	 * @param context - Additional context information for debugging
	 * @param cause - Optional underlying cause (nested error)
	 */
	constructor(
		public readonly code: string,
		message: string,
		public readonly context: ErrorContext = {},
		public override readonly cause?: Error
	) {
		super(message)
		this.name = this.constructor.name
		
		// Preserve stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}

	/**
	 * Convert error to structured object for logging
	 * 
	 * @returns Structured representation suitable for logging
	 */
	toLogObject(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			context: this.context,
			stack: this.stack,
			...(this.cause && { cause: this.cause.message })
		}
	}
}

/**
 * Configuration-related errors
 * 
 * Used when extension configuration is invalid, missing, or incompatible
 * 
 * @example
 * ```ts
 * throw new ConfigError('INVALID_YAML', 'Invalid YAML syntax in block definition', {
 *   file: 'eda-analysis.yaml',
 *   line: 15
 * })
 * ```
 */
export class ConfigError extends BaseError {
	constructor(code: string, message: string, context?: ErrorContext, cause?: Error) {
		super(code, message, context, cause)
	}
}

/**
 * File system and I/O related errors
 * 
 * Used when file operations fail (read, write, parse, etc.)
 * 
 * @example
 * ```ts
 * throw new IOError('READ_FAILED', 'Cannot read prompt block file', {
 *   path: '/workspace/.oacode/prompts/custom.yaml',
 *   operation: 'read'
 * }, originalError)
 * ```
 */
export class IOError extends BaseError {
	constructor(code: string, message: string, context?: ErrorContext, cause?: Error) {
		super(code, message, context, cause)
	}
}

/**
 * Validation errors for user input or data
 * 
 * Used when data doesn't meet expected format or constraints
 * 
 * @example
 * ```ts
 * throw new ValidationError('MISSING_REQUIRED_FIELD', 'Prompt block missing required name field', {
 *   field: 'name',
 *   providedFields: ['description', 'category']
 * })
 * ```
 */
export class ValidationError extends BaseError {
	constructor(code: string, message: string, context?: ErrorContext, cause?: Error) {
		super(code, message, context, cause)
	}
}

/**
 * Operation cancelled by user or system
 * 
 * Used when operations are cancelled via CancellationToken or user action
 * 
 * @example
 * ```ts
 * if (cancellationToken.isCancellationRequested) {
 *   throw new OperationCancelledError('USER_CANCELLED', 'Prompt block loading cancelled by user')
 * }
 * ```
 */
export class OperationCancelledError extends BaseError {
	constructor(code: string, message: string, context?: ErrorContext, cause?: Error) {
		super(code, message, context, cause)
	}
}

/**
 * Network and external service errors
 * 
 * Used when external API calls or network operations fail
 */
export class NetworkError extends BaseError {
	constructor(code: string, message: string, context?: ErrorContext, cause?: Error) {
		super(code, message, context, cause)
	}
}

/**
 * Convert unknown error to typed error for consistent handling
 * 
 * This function ensures all errors in the system follow the same structure,
 * even when dealing with third-party errors or unexpected error types.
 * 
 * @param error - Unknown error from catch block
 * @param defaultCode - Default error code if none can be determined
 * @param context - Additional context to add
 * @returns Typed error instance
 * 
 * @example
 * ```ts
 * try {
 *   await someOperation()
 * } catch (error: unknown) {
 *   throw normalizeError(error, 'OPERATION_FAILED', { operation: 'loadBlocks' })
 * }
 * ```
 */
export function normalizeError(
	error: unknown, 
	defaultCode: string, 
	context?: ErrorContext
): BaseError {
	// If it's already our typed error, preserve it
	if (error instanceof BaseError) {
		return error
	}
	
	// If it's a standard Error, wrap it
	if (error instanceof Error) {
		return new BaseError(defaultCode, error.message, context, error)
	}
	
	// Handle string errors (discouraged but possible)
	if (typeof error === 'string') {
		return new BaseError(defaultCode, error, context)
	}
	
	// Handle other unknown types
	return new BaseError(
		defaultCode, 
		`Unknown error: ${String(error)}`, 
		context
	)
}

/**
 * Type guard to check if an error is a specific typed error
 * 
 * @param error - Error to check
 * @param errorClass - Error class to check against
 * @returns True if error is instance of specified class
 * 
 * @example
 * ```ts
 * if (isErrorOfType(error, ValidationError)) {
 *   console.log('Validation failed:', error.code)
 * }
 * ```
 */
export function isErrorOfType<T extends BaseError>(
	error: unknown, 
	errorClass: new (...args: any[]) => T
): error is T {
	return error instanceof errorClass
}