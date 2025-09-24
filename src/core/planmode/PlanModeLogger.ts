/**
 * Module: PlanModeLogger (core/planmode)
 * Purpose: Specialized logger for Plan Mode operations and telemetry
 * Responsibilities: Track tool usage, validation failures, and mode transitions
 * Invariants: Production-safe logging, no PII exposure, structured format
 * Dependencies: Core Logger infrastructure, no external dependencies
 * Security: Safe string conversion, no secret logging, respects __DEV__ flag
 * Performance: Debug logs eliminated in production builds
 */

import { Logger, type LogContext } from '../infrastructure/Logger'

/**
 * Specialized logger for Plan Mode operations with structured telemetry
 *
 * Provides production-grade logging for Plan Mode workflow events including:
 * - Tool validation and interception
 * - Mode transitions
 * - Plan presentation methods
 * - Validation failures
 *
 * @example
 * ```ts
 * const logger = new PlanModeLogger()
 * logger.logToolValidation('attempt_completion', false, 'plan')
 * logger.logModeTransition('chat', 'plan')
 * logger.logPlanPresentation('exit_plan_mode')
 * ```
 */
export class PlanModeLogger extends Logger {
	constructor() {
		super('PlanMode')
	}

	/**
	 * Logs tool validation results in Plan Mode
	 * @param tool - Tool name being validated
	 * @param isValid - Whether the tool is valid for Plan Mode
	 * @param mode - Current workflow mode
	 */
	logToolValidation(tool: string, isValid: boolean, mode: string): void {
		const context: LogContext = {
			tool,
			isValid,
			mode,
			timestamp: new Date().toISOString()
		}

		// Debug logging for development (eliminated in production)
		if (process.env.NODE_ENV === 'development') {
			this.debug('Tool validation', context)
		}

		// Warn about invalid tool usage in production
		if (!isValid && mode === 'plan') {
			this.warn('Invalid tool usage in Plan Mode', {
				...context,
				expectedTool: 'exit_plan_mode',
				action: 'tool_blocked'
			})
		}
	}

	/**
	 * Logs mode transitions for Plan Mode workflow tracking
	 * @param from - Previous mode
	 * @param to - New mode being switched to
	 */
	logModeTransition(from: string, to: string): void {
		const context: LogContext = {
			from,
			to,
			timestamp: new Date().toISOString(),
			action: 'mode_transition'
		}

		this.info('Mode transition', context)

		// Additional debug info for development
		if (process.env.NODE_ENV === 'development') {
			this.debug('Mode transition details', {
				...context,
				planModeActive: to === 'plan',
				planModeExited: from === 'plan'
			})
		}
	}

	/**
	 * Logs how plans are being presented to track compliance
	 * @param method - Method used to present plan ('exit_plan_mode' | 'attempt_completion' | 'text')
	 */
	logPlanPresentation(method: string): void {
		const isCorrect = method === 'exit_plan_mode'
		const context: LogContext = {
			method,
			correct: isCorrect,
			timestamp: new Date().toISOString(),
			action: 'plan_presentation'
		}

		if (isCorrect) {
			this.info('Plan presentation', context)
		} else {
			this.warn('Incorrect plan presentation method', {
				...context,
				expectedMethod: 'exit_plan_mode',
				severity: 'high'
			})
		}
	}

	/**
	 * Logs tool interception events for telemetry and debugging
	 * @param originalTool - Original tool the AI tried to use
	 * @param interceptedTool - Tool it was redirected to
	 * @param reason - Reason for interception
	 */
	logToolInterception(originalTool: string, interceptedTool: string, reason: string): void {
		const context: LogContext = {
			originalTool,
			interceptedTool,
			reason,
			timestamp: new Date().toISOString(),
			action: 'tool_intercepted'
		}

		this.warn('Tool usage intercepted', context)

		// Additional debug details for development
		if (process.env.NODE_ENV === 'development') {
			this.debug('Interception details', {
				...context,
				interceptorActive: true,
				complianceFailure: true
			})
		}
	}

	/**
	 * Logs Plan Mode state validation failures
	 * @param validation - Type of validation that failed
	 * @param details - Additional failure context
	 */
	logValidationFailure(validation: string, details: LogContext): void {
		const context: LogContext = {
			validation,
			timestamp: new Date().toISOString(),
			action: 'validation_failure',
			...details
		}

		this.error('Plan Mode validation failed', context)
	}

	/**
	 * Logs Plan Mode workflow events (approve/modify/reject)
	 * @param event - Workflow event type
	 * @param planTitle - Title or identifier of the plan
	 * @param details - Additional event context
	 */
	logWorkflowEvent(event: 'presented' | 'approved' | 'modified' | 'rejected', planTitle?: string, details?: LogContext): void {
		const context: LogContext = {
			event,
			planTitle: planTitle || 'untitled',
			timestamp: new Date().toISOString(),
			action: 'workflow_event',
			...details
		}

		this.info('Plan workflow event', context)
	}
}