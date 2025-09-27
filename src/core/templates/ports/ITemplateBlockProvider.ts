/**
 * Module: ITemplateBlockProvider (port)
 * Purpose: Provides template blocks to existing systems
 * Responsibilities:
 *  - Supply prompts and rules from active template
 *  - Manage rule toggle states
 *  - Track block sources
 * Invariants: Source must always be 'template' for all returned blocks
 * Dependencies: Domain types only
 * Security: Content must be sanitized before injection
 */

import type { TemplatePromptBlock, TemplateRule } from "../domain/ExtendedTemplate"

/**
 * Template block provider port
 * @description Provides access to blocks from the active template
 * @remarks Used by adapters to inject blocks into existing systems
 */
export interface ITemplateBlockProvider {
	/**
	 * Get all prompts from active template
	 * @returns Array of template prompts (empty if no active template)
	 */
	getPrompts(): readonly TemplatePromptBlock[]

	/**
	 * Get all rules from active template
	 * @returns Array of template rules (empty if no active template)
	 */
	getRules(): readonly TemplateRule[]

	/**
	 * Get prompt by name
	 * @param name Prompt name to find
	 * @returns Prompt or undefined if not found
	 */
	getPromptByName(name: string): TemplatePromptBlock | undefined

	/**
	 * Get rule by name
	 * @param name Rule name to find
	 * @returns Rule or undefined if not found
	 */
	getRuleByName(name: string): TemplateRule | undefined

	/**
	 * Check if a rule is enabled
	 * @param ruleName Name of the rule to check
	 * @returns True if enabled, false otherwise
	 */
	isRuleEnabled(ruleName: string): boolean

	/**
	 * Toggle a rule's enabled state
	 * @param ruleName Name of the rule to toggle
	 * @param enabled New enabled state
	 */
	toggleRule(ruleName: string, enabled: boolean): Promise<void>

	/**
	 * Get all rule toggle states
	 * @returns Map of rule name to enabled state
	 */
	getRuleToggles(): ReadonlyMap<string, boolean>

	/**
	 * Check if there's an active template
	 */
	hasActiveTemplate(): boolean

	/**
	 * Get active template name
	 * @returns Template name or null if none active
	 */
	getActiveTemplateName(): string | null
}
