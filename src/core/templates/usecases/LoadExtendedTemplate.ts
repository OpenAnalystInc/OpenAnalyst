/**
 * Module: LoadExtendedTemplate (usecase)
 * Purpose: Load and validate extended templates
 * Responsibilities:
 *  - Orchestrate template loading
 *  - Validate template structure
 *  - Handle caching logic
 * Invariants: Templates must be validated before returning
 * Dependencies: Repository and validator ports
 * Performance: Uses repository caching when available
 */

import type { ExtendedTemplate } from "../domain/ExtendedTemplate"
import { ExtendedTemplateValidator } from "../domain/ExtendedTemplate"
import type { TemplateError } from "../domain/TemplateError"
import { TemplateErrorCode } from "../domain/TemplateError"
import type { Result } from "../domain/Result"
import { Result as R } from "../domain/Result"
import type { IExtendedTemplateRepository } from "../ports/IExtendedTemplateRepository"

/**
 * Load extended template use case
 * @description Loads and validates templates from repository
 * @example
 * const useCase = new LoadExtendedTemplate(repository)
 * const result = await useCase.execute('data-analysis')
 * if (result.ok) {
 *   // Use template
 * }
 */
export class LoadExtendedTemplate {
	private readonly validator: ExtendedTemplateValidator

	constructor(private readonly repository: IExtendedTemplateRepository) {
		this.validator = new ExtendedTemplateValidator()
	}

	/**
	 * Execute the use case
	 * @param templateName Name of template to load (without extension)
	 * @returns Loaded and validated template or error
	 * @precondition Template name must be non-empty
	 * @postcondition Returns valid template or descriptive error
	 */
	async execute(templateName: string): Promise<Result<ExtendedTemplate, TemplateError>> {
		// Input validation
		if (!templateName || typeof templateName !== "string") {
			return R.err({
				code: TemplateErrorCode.INVALID_NAME,
				message: "Template name is required",
				context: { templateName },
				timestamp: Date.now(),
				name: "TemplateError",
				isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.INVALID_NAME,
				toJSON: () => ({ code: TemplateErrorCode.INVALID_NAME }),
			} as TemplateError)
		}

		const trimmedName = templateName.trim()
		if (trimmedName.length === 0) {
			return R.err({
				code: TemplateErrorCode.INVALID_NAME,
				message: "Template name cannot be empty",
				context: { templateName },
				timestamp: Date.now(),
				name: "TemplateError",
				isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.INVALID_NAME,
				toJSON: () => ({ code: TemplateErrorCode.INVALID_NAME }),
			} as TemplateError)
		}

		// Check if template exists
		const exists = await this.repository.templateExists(trimmedName)
		if (!exists) {
			return R.err({
				code: TemplateErrorCode.NOT_FOUND,
				message: `Template '${trimmedName}' not found`,
				context: { templateName: trimmedName },
				timestamp: Date.now(),
				name: "TemplateError",
				isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.NOT_FOUND,
				toJSON: () => ({ code: TemplateErrorCode.NOT_FOUND }),
			} as TemplateError)
		}

		// Load from repository
		const loadResult = await this.repository.loadTemplate(trimmedName)
		if (!loadResult.ok) {
			return loadResult
		}

		// Validate structure
		const validationResult = this.validator.validate(loadResult.value)
		if (!validationResult.isValid) {
			// Convert validation errors to TemplateError
			const errorMessages = validationResult.errors
				.map((e) => `${e.section}${e.field ? `.${e.field}` : ""}: ${e.message}`)
				.join("; ")

			return R.err({
				code: TemplateErrorCode.VALIDATION_FAILED,
				message: `Template validation failed: ${errorMessages}`,
				context: {
					templateName: trimmedName,
					section: validationResult.errors[0]?.section,
					field: validationResult.errors[0]?.field,
				},
				timestamp: Date.now(),
				name: "TemplateError",
				isCode: (code: TemplateErrorCode) => code === TemplateErrorCode.VALIDATION_FAILED,
				toJSON: () => ({ code: TemplateErrorCode.VALIDATION_FAILED }),
			} as TemplateError)
		}

		return R.ok(loadResult.value)
	}

	/**
	 * Load active template
	 * @returns Currently active template or null
	 */
	async loadActive(): Promise<ExtendedTemplate | null> {
		return this.repository.getActiveTemplate()
	}

	/**
	 * List available templates
	 * @returns Array of template names
	 */
	async listAvailable(): Promise<string[]> {
		return this.repository.listTemplates()
	}
}
