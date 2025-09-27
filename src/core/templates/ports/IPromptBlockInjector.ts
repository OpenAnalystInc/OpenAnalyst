/**
 * Module: IPromptBlockInjector (port)
 * Purpose: Contract for injecting template prompts into existing systems
 * Responsibilities:
 *  - Define injection interface for prompt blocks
 *  - Specify validation requirements
 *  - Handle injection failures
 * Invariants: Injected prompts must maintain source tracking
 * Dependencies: Domain types only
 * Security: Validate all content before injection
 */

import type { TemplatePromptBlock } from "../domain/ExtendedTemplate"
import type { Result } from "../domain/Result"
import type { TemplateError } from "../domain/TemplateError"

/**
 * Prompt injection result
 */
export interface PromptInjectionResult {
	readonly injected: number // Count of successfully injected prompts
	readonly failed: number // Count of failed injections
	readonly errors: readonly string[] // Error messages for failures
}

/**
 * Prompt block injector port
 * @description Injects template prompts into the prompt block system
 * @remarks Implementations must preserve source tracking
 */
export interface IPromptBlockInjector {
	/**
	 * Inject prompts into the system
	 * @param prompts Array of prompts to inject
	 * @returns Result with injection summary
	 */
	inject(prompts: readonly TemplatePromptBlock[]): Promise<Result<PromptInjectionResult, TemplateError>>

	/**
	 * Clear all template-sourced prompts
	 * @returns Number of prompts cleared
	 */
	clearTemplatePrompts(): Promise<number>

	/**
	 * Check if a prompt is already injected
	 * @param name Prompt name to check
	 */
	isInjected(name: string): boolean

	/**
	 * Get all injected prompt names
	 */
	getInjectedNames(): readonly string[]
}
