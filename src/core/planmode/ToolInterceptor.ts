/**
 * Module: ToolInterceptor (core/planmode)
 * Purpose: Intercepts and redirects incorrect tool usage in Plan Mode
 * Responsibilities: Convert attempt_completion to exit_plan_mode when in Plan Mode
 * Invariants: No content modification beyond tool redirection, preserves original intent
 * Dependencies: PlanModeLogger, TelemetryService for tracking
 * Security: No content manipulation, only tool name/parameter redirection
 * Performance: Minimal overhead, only activates in Plan Mode
 */

import { PlanModeLogger } from './PlanModeLogger'
import { TelemetryService } from '@roo-code/telemetry'
import { TelemetryEventName } from '@roo-code/types'

/**
 * Result of tool interception operation
 */
interface InterceptionResult {
	/** The tool name (potentially redirected) */
	readonly toolName: string
	/** The tool parameters (potentially modified) */
	readonly params: any
	/** Whether the tool was intercepted and redirected */
	readonly wasIntercepted: boolean
	/** Original tool name if intercepted */
	readonly originalTool?: string
	/** Reason for interception */
	readonly reason?: string
}

/**
 * Intercepts tool usage in Plan Mode and redirects incorrect tools
 *
 * The primary purpose is to catch AI attempts to use attempt_completion or other
 * modification tools in Plan Mode and redirect them to the correct exit_plan_mode tool.
 * This serves as a safety net when the system reminder fails to prevent incorrect usage.
 *
 * @example
 * ```ts
 * const interceptor = new ToolInterceptor()
 * const result = interceptor.interceptTool(
 *   'attempt_completion',
 *   'plan',
 *   { result: 'My implementation plan...' }
 * )
 * // result.toolName === 'exit_plan_mode'
 * // result.wasIntercepted === true
 * ```
 */
export class ToolInterceptor {
	private readonly logger = new PlanModeLogger()

	/**
	 * List of tools that should be blocked in Plan Mode
	 * These are tools that modify the system or complete tasks
	 */
	private readonly blockedToolsInPlanMode = [
		'write_to_file',
		'execute_command',
		'apply_diff',
		'edit_file',
		'insert_content',
		'search_and_replace'
	] as const

	/**
	 * Intercepts tool usage and redirects if necessary
	 *
	 * Analyzes the requested tool usage and determines if redirection is needed
	 * based on the current workflow mode. Provides fallback behavior when the
	 * AI fails to follow Plan Mode instructions.
	 *
	 * @param toolName - Original tool name from AI response
	 * @param workflowMode - Current workflow mode ('plan' | 'chat' | 'agent' | undefined)
	 * @param blockParams - Original tool parameters
	 * @returns Interception result with potentially modified tool and params
	 */
	interceptTool(
		toolName: string,
		workflowMode: string | undefined,
		blockParams: any
	): InterceptionResult {
		// Only intercept in Plan Mode
		if (workflowMode !== 'plan') {
			return {
				toolName,
				params: blockParams,
				wasIntercepted: false
			}
		}

		// Handle attempt_completion redirection - most common case
		if (toolName === 'attempt_completion') {
			return this.redirectAttemptCompletion(blockParams)
		}

		// Block modification tools in Plan Mode
		if (this.blockedToolsInPlanMode.includes(toolName as any)) {
			return this.blockModificationTool(toolName)
		}

		// Allow tool to proceed normally
		return {
			toolName,
			params: blockParams,
			wasIntercepted: false
		}
	}

	/**
	 * Redirects attempt_completion to exit_plan_mode in Plan Mode
	 * @param blockParams - Original attempt_completion parameters
	 * @returns Interception result with exit_plan_mode tool
	 * @private
	 */
	private redirectAttemptCompletion(blockParams: any): InterceptionResult {
		const reason = 'attempt_completion not allowed in Plan Mode'

		this.logger.logToolInterception('attempt_completion', 'exit_plan_mode', reason)

		// Track telemetry for AI compliance failure
		// Note: taskId would need to be passed in for proper telemetry tracking
		// For now, using generic event - this should be enhanced when integrating with Task context
		TelemetryService.instance.captureEvent(TelemetryEventName.PLAN_MODE_TOOL_INTERCEPTED, {
			originalTool: 'attempt_completion',
			correctedTool: 'exit_plan_mode',
			workflowMode: 'plan',
			timestamp: new Date().toISOString()
		})

		// Extract plan content from attempt_completion parameters
		const planContent = this.extractPlanContent(blockParams)

		return {
			toolName: 'exit_plan_mode',
			params: { plan: planContent },
			wasIntercepted: true,
			originalTool: 'attempt_completion',
			reason
		}
	}

	/**
	 * Blocks modification tools in Plan Mode with error
	 * @param toolName - Name of the blocked tool
	 * @returns Never returns - throws error
	 * @private
	 */
	private blockModificationTool(toolName: string): never {
		const reason = `${toolName} is not allowed in Plan Mode`

		this.logger.logToolInterception(toolName, 'BLOCKED', reason)

		// Track blocked tool usage
		// Note: taskId would need to be passed in for proper telemetry tracking
		// For now, using generic event - this should be enhanced when integrating with Task context
		TelemetryService.instance.captureEvent(TelemetryEventName.PLAN_MODE_TOOL_BLOCKED, {
			blockedTool: toolName,
			workflowMode: 'plan',
			timestamp: new Date().toISOString()
		})

		throw new Error(`Tool ${toolName} is not allowed in Plan Mode. Use exit_plan_mode to present your plan.`)
	}

	/**
	 * Extracts plan content from attempt_completion parameters
	 * @param params - attempt_completion parameters
	 * @returns Extracted plan content string
	 * @private
	 */
	private extractPlanContent(params: any): string {
		// Common parameter names that might contain the plan
		const contentFields = ['result', 'message', 'content', 'text', 'plan']

		// Try to find content in common parameter fields
		for (const field of contentFields) {
			if (params[field] && typeof params[field] === 'string') {
				return params[field]
			}
		}

		// Fallback: stringify the entire params if no specific field found
		if (typeof params === 'object' && params !== null) {
			try {
				return JSON.stringify(params, null, 2)
			} catch {
				return String(params)
			}
		}

		// Final fallback
		return 'Plan content intercepted from attempt_completion (content extraction failed)'
	}

	/**
	 * Checks if a tool should be allowed in Plan Mode
	 * @param toolName - Tool name to check
	 * @returns true if tool is allowed, false if should be blocked
	 */
	isToolAllowedInPlanMode(toolName: string): boolean {
		// Read-only tools are always allowed
		const allowedTools = [
			'read_file',
			'search_files',
			'list_files',
			'list_code_definition_names',
			'ask_followup_question',
			'exit_plan_mode', // Required for Plan Mode
			'switch_mode',
			'new_task'
		]

		return allowedTools.includes(toolName) || !this.blockedToolsInPlanMode.includes(toolName as any)
	}

	/**
	 * Gets a user-friendly message about tool interception
	 * @param result - Interception result
	 * @returns Human-readable message explaining the interception
	 */
	getInterceptionMessage(result: InterceptionResult): string {
		if (!result.wasIntercepted) {
			return ''
		}

		if (result.originalTool === 'attempt_completion') {
			return '[System: Redirected attempt_completion to exit_plan_mode for Plan Mode compliance]'
		}

		return `[System: Blocked ${result.originalTool} - not allowed in Plan Mode]`
	}
}