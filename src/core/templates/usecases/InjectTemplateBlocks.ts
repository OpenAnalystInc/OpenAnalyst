/**
 * Module: InjectTemplateBlocks (usecase)
 * Purpose: Inject template blocks into existing systems
 * Responsibilities:
 *  - Orchestrate injection of prompts and rules
 *  - Handle injection failures gracefully
 *  - Clear previous template blocks
 * Invariants: All blocks must maintain source tracking
 * Dependencies: Injector ports
 * Security: Validate all content before injection
 */

import type { ExtendedTemplate } from "../domain/ExtendedTemplate"
import type { TemplateError } from "../domain/TemplateError"
import { TemplateErrorCode } from "../domain/TemplateError"
import type { Result } from "../domain/Result"
import { Result as R } from "../domain/Result"
import type { IPromptBlockInjector } from "../ports/IPromptBlockInjector"
import type { IRuleInjector } from "../ports/IRuleInjector"

/**
 * Injection result summary
 */
export interface InjectionResult {
	readonly promptsInjected: number
	readonly promptsFailed: number
	readonly rulesInjected: number
	readonly rulesFailed: number
	readonly errors: readonly string[]
}

/**
 * Inject template blocks use case
 * @description Injects prompts and rules from template into existing systems
 * @example
 * const useCase = new InjectTemplateBlocks(promptInjector, ruleInjector)
 * const result = await useCase.execute(template)
 * if (result.ok) {
 *   console.log(`Injected ${result.value.promptsInjected} prompts`)
 * }
 */
export class InjectTemplateBlocks {
	constructor(
		private readonly promptInjector: IPromptBlockInjector,
		private readonly ruleInjector: IRuleInjector,
	) {}

	/**
	 * Execute the use case
	 * @param template Template with blocks to inject
	 * @returns Injection summary or error
	 * @precondition Template must be valid
	 * @postcondition Blocks are injected with source tracking
	 */
	async execute(template: ExtendedTemplate): Promise<Result<InjectionResult, TemplateError>> {
		const errors: string[] = []

		// Clear previous template blocks first
		await this.clearPreviousBlocks()

		// Inject prompts
		const promptResult = await this.promptInjector.inject(template.prompts)
		const promptsInjected = promptResult.ok ? promptResult.value.injected : 0
		const promptsFailed = promptResult.ok ? promptResult.value.failed : template.prompts.length

		if (!promptResult.ok) {
			errors.push(`Prompt injection failed: ${promptResult.error.message}`)
		} else if (promptResult.value.errors.length > 0) {
			errors.push(...promptResult.value.errors)
		}

		// Inject rules
		const ruleResult = await this.ruleInjector.inject(template.rules)
		const rulesInjected = ruleResult.ok ? ruleResult.value.injected : 0
		const rulesFailed = ruleResult.ok ? ruleResult.value.failed : template.rules.length

		if (!ruleResult.ok) {
			errors.push(`Rule injection failed: ${ruleResult.error.message}`)
		} else if (ruleResult.value.errors.length > 0) {
			errors.push(...ruleResult.value.errors)
		}

		// Check for complete failure
		if (
			promptsInjected === 0 &&
			rulesInjected === 0 &&
			(template.prompts.length > 0 || template.rules.length > 0)
		) {
			return R.err({
				code: TemplateErrorCode.INJECTION_FAILED,
				message: "Failed to inject any template blocks",
				context: {
					templateName: template.metadata.name,
					cause: errors.join("; "),
				},
				timestamp: Date.now(),
				name: "TemplateError",
				isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.INJECTION_FAILED,
				toJSON: () => ({ code: TemplateErrorCode.INJECTION_FAILED }),
			} as TemplateError)
		}

		return R.ok({
			promptsInjected,
			promptsFailed,
			rulesInjected,
			rulesFailed,
			errors: Object.freeze(errors),
		})
	}

	/**
	 * Clear blocks from previous template
	 * @returns Summary of cleared blocks
	 */
	async clearPreviousBlocks(): Promise<{ promptsCleared: number; rulesCleared: number }> {
		const [promptsCleared, rulesCleared] = await Promise.all([
			this.promptInjector.clearTemplatePrompts(),
			this.ruleInjector.clearTemplateRules(),
		])

		return { promptsCleared, rulesCleared }
	}

	/**
	 * Get injection status
	 * @returns Current injection state
	 */
	getStatus(): {
		injectedPrompts: readonly string[]
		injectedRules: readonly string[]
	} {
		return {
			injectedPrompts: this.promptInjector.getInjectedNames(),
			injectedRules: this.ruleInjector.getInjectedNames(),
		}
	}
}
