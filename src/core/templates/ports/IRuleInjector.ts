/**
 * Module: IRuleInjector (port)
 * Purpose: Contract for injecting template rules into existing systems
 * Responsibilities:
 *  - Define injection interface for rules
 *  - Manage rule toggle states
 *  - Handle injection failures
 * Invariants: Injected rules must maintain toggle states
 * Dependencies: Domain types only
 * Security: Validate rule content before injection
 */

import type { TemplateRule } from "../domain/ExtendedTemplate"
import type { Result } from "../domain/Result"
import type { TemplateError } from "../domain/TemplateError"

/**
 * Rule injection result
 */
export interface RuleInjectionResult {
	readonly injected: number // Count of successfully injected rules
	readonly failed: number // Count of failed injections
	readonly errors: readonly string[] // Error messages for failures
}

/**
 * Rule toggle state
 */
export interface RuleToggleState {
	readonly ruleName: string
	readonly enabled: boolean
	readonly path: string // Virtual path for tracking
}

/**
 * Rule injector port
 * @description Injects template rules into the rule system
 * @remarks Implementations must preserve toggle states across sessions
 */
export interface IRuleInjector {
	/**
	 * Inject rules into the system
	 * @param rules Array of rules to inject
	 * @returns Result with injection summary
	 */
	inject(rules: readonly TemplateRule[]): Promise<Result<RuleInjectionResult, TemplateError>>

	/**
	 * Clear all template-sourced rules
	 * @returns Number of rules cleared
	 */
	clearTemplateRules(): Promise<number>

	/**
	 * Get toggle state for a rule
	 * @param ruleName Name of the rule
	 * @returns Toggle state or undefined if not found
	 */
	getToggleState(ruleName: string): RuleToggleState | undefined

	/**
	 * Set toggle state for a rule
	 * @param ruleName Name of the rule
	 * @param enabled New enabled state
	 */
	setToggleState(ruleName: string, enabled: boolean): Promise<void>

	/**
	 * Get all toggle states
	 */
	getAllToggleStates(): ReadonlyMap<string, RuleToggleState>

	/**
	 * Check if a rule is already injected
	 * @param name Rule name to check
	 */
	isInjected(name: string): boolean

	/**
	 * Get all injected rule names
	 */
	getInjectedNames(): readonly string[]
}
