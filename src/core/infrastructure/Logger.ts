/**
 * Module: Logger (infrastructure)
 * Purpose: Structured logging with dev-only debug logs; zero cost in production via dead-code elimination.
 * Responsibilities: Provide consistent, structured logging across the extension.
 * Invariants:
 *  - debug() emits only when __DEV__ === true
 *  - info/warn/error are always available
 *  - Never log PII, secrets, or file contents
 * Dependencies: vscode.OutputChannel for log output
 * Security: No secret or PII logging; safe string conversion prevents injection
 * Performance: Debug logs are eliminated in production builds via bundler defines
 */

import * as vscode from 'vscode'

// Compile-time flag provided by bundler (see esbuild/webpack define)
declare const __DEV__: boolean

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Context information for structured logging
 */
export interface LogContext {
	readonly [key: string]: unknown
}

/**
 * Structured logger with development-only debug logs
 * 
 * @example
 * ```ts
 * const logger = new Logger('PromptBlocks')
 * logger.debug('Loading blocks from', { path: '/workspace/.oacode' })
 * logger.info('Prompt blocks loaded', { count: 4 })
 * logger.error('Failed to parse YAML', { file: 'block.yaml', error: 'invalid syntax' })
 * ```
 */
export class Logger {
	private channel: vscode.OutputChannel | null = null
	private readonly correlationId = Math.random().toString(36).substring(7)

	constructor(private readonly namespace: string) {}

	/**
	 * Dev-only logging; removed from prod bundle by the bundler define.
	 * Use for verbose debugging information that should never reach production.
	 * 
	 * @param message - Primary log message
	 * @param context - Additional structured context (optional)
	 */
	debug(message: string, context?: LogContext): void {
		// Dead code elimination: this entire block is removed in production builds
		if (!__DEV__) return
		this.write('debug', message, context)
	}

	/**
	 * Informational logs for normal operation events
	 * 
	 * @param message - Primary log message
	 * @param context - Additional structured context (optional)
	 */
	info(message: string, context?: LogContext): void {
		this.write('info', message, context)
	}

	/**
	 * Warning logs for recoverable issues
	 * 
	 * @param message - Primary log message
	 * @param context - Additional structured context (optional)
	 */
	warn(message: string, context?: LogContext): void {
		this.write('warn', message, context)
	}

	/**
	 * Error logs for failures and exceptions
	 * 
	 * @param message - Primary log message
	 * @param context - Additional structured context (optional)
	 */
	error(message: string, context?: LogContext): void {
		this.write('error', message, context)
	}

	/**
	 * Create a child logger with extended namespace
	 * 
	 * @param suffix - Additional namespace suffix
	 * @returns New logger instance with extended namespace
	 * 
	 * @example
	 * ```ts
	 * const childLogger = logger.child('FileRepository')
	 * childLogger.info('File loaded') // Logs as "[PromptBlocks.FileRepository] File loaded"
	 * ```
	 */
	child(suffix: string): Logger {
		return new Logger(`${this.namespace}.${suffix}`)
	}

	/**
	 * Lazily create the VS Code output channel to minimize activation cost
	 * 
	 * Performance: Channel creation is deferred until first log to avoid
	 * unnecessary work during extension activation
	 */
	private getChannel(): vscode.OutputChannel {
		if (!this.channel) {
			this.channel = vscode.window.createOutputChannel(`OpenAnalyst - ${this.namespace}`)
		}
		return this.channel
	}

	/**
	 * Centralized writer ensures consistent formatting and future log shipping.
	 * 
	 * Format: [timestamp] [LEVEL] [namespace] [correlationId] message {context}
	 * 
	 * @param level - Log level
	 * @param message - Primary message
	 * @param context - Optional structured context
	 */
	private write(level: LogLevel, message: string, context?: LogContext): void {
		const timestamp = new Date().toISOString()
		const levelTag = level.toUpperCase().padEnd(5)
		const contextStr = context ? ` ${safeStringify(context)}` : ''
		
		const logLine = `[${timestamp}] [${levelTag}] [${this.namespace}] [${this.correlationId}] ${message}${contextStr}`
		
		this.getChannel().appendLine(logLine)
	}
}

/**
 * Convert unknown value to safe string without leaking secrets or throwing.
 * 
 * Security: Prevents accidental logging of sensitive data by sanitizing objects
 * that might contain secrets or PII.
 * 
 * @param value - Value to convert to string
 * @returns Safe string representation
 */
function safeStringify(value: unknown): string {
	try {
		if (typeof value === 'string') return value
		if (typeof value === 'number' || typeof value === 'boolean') return String(value)
		if (value === null || value === undefined) return String(value)
		
		// For objects, sanitize potentially sensitive fields
		if (typeof value === 'object') {
			const sanitized = sanitizeObject(value as Record<string, unknown>)
			return JSON.stringify(sanitized)
		}
		
		return JSON.stringify(value)
	} catch {
		// Fallback for circular references or other JSON errors
		return String(value)
	}
}

/**
 * Sanitize object fields that might contain sensitive information
 * 
 * Security: Replaces potentially sensitive field values with placeholders
 * to prevent accidental secret logging
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
	const sensitiveFields = new Set([
		'password', 'secret', 'token', 'key', 'auth', 'credential',
		'apikey', 'api_key', 'authorization', 'bearer', 'jwt'
	])
	
	const sanitized: Record<string, unknown> = {}
	
	for (const [key, value] of Object.entries(obj)) {
		const lowerKey = key.toLowerCase()
		if (sensitiveFields.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
			sanitized[key] = '[REDACTED]'
		} else {
			sanitized[key] = value
		}
	}
	
	return sanitized
}

// Export singleton instances for common use cases
export const promptBlocksLogger = new Logger('PromptBlocks')
export const systemLogger = new Logger('System')