import * as yaml from "yaml"
import { PromptBlockData, PromptBlockValidationError } from "../../core/blocks/domain/PromptBlock"
import { isValidCategory } from "../../core/blocks/domain/PromptCategory"
import { 
	IPromptBlockValidator, 
	ValidationResult, 
	ValidationError, 
	ValidationWarning,
	ValidationOptions 
} from "../../core/blocks/ports/IPromptBlockValidator"

/**
 * Strip BOM and problematic characters from YAML content
 * Based on the existing pattern in BlockResolver.ts from experimental codebase
 */
function cleanYamlContent(content: string): string {
	// Remove BOM if present
	if (content.charCodeAt(0) === 0xfeff) {
		content = content.slice(1)
	}

	// Remove problematic Unicode characters that can cause YAML parsing issues
	const PROBLEMATIC_CHARS_REGEX =
		/[\u00A0\u200B\u200C\u200D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]/g

	content = content.replace(PROBLEMATIC_CHARS_REGEX, (match) => {
		switch (match) {
			case "\u00A0": // Non-breaking space
				return " "
			case "\u200B": // Zero-width space
			case "\u200C": // Zero-width non-joiner
			case "\u200D": // Zero-width joiner
				return ""
			case "\u2018": // Left single quotation mark
			case "\u2019": // Right single quotation mark
				return "'"
			case "\u201C": // Left double quotation mark
			case "\u201D": // Right double quotation mark
				return '"'
			default: // Various dash characters
				return "-"
		}
	})

	return content.trim()
}

/**
 * YAML parser and validator for prompt blocks
 * 
 * Handles parsing, cleaning, and validation of YAML prompt block files.
 * Implements the IPromptBlockValidator interface.
 */
export class YamlPromptBlockParser implements IPromptBlockValidator {
	/**
	 * Parse YAML content into PromptBlockData
	 */
	async parseFromContent(content: string, filePath?: string): Promise<PromptBlockData> {
		try {
			const cleanedContent = cleanYamlContent(content)
			const parsed = yaml.parse(cleanedContent)

			if (!parsed || typeof parsed !== "object") {
				throw new PromptBlockValidationError(
					"YAML file must contain a valid object"
				)
			}

			// Validate schema first
			const schemaValidation = this.validateSchema(parsed)
			if (!schemaValidation.isValid) {
				const errorMessages = schemaValidation.errors.map(e => e.message).join("; ")
				throw new PromptBlockValidationError(
					`Schema validation failed: ${errorMessages}`
				)
			}

			// Type assertion after validation
			const data = parsed as PromptBlockData

			// Additional validation
			const dataValidation = this.validate(data)
			if (!dataValidation.isValid) {
				const errorMessages = dataValidation.errors.map(e => e.message).join("; ")
				throw new PromptBlockValidationError(
					`Data validation failed: ${errorMessages}`
				)
			}

			return data
		} catch (error) {
			if (error instanceof PromptBlockValidationError) {
				throw error
			}
			
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new PromptBlockValidationError(
				`YAML parsing failed${filePath ? ` in ${filePath}` : ""}: ${errorMessage}`
			)
		}
	}

	/**
	 * Validate prompt block data structure and content
	 */
	validate(data: PromptBlockData, options?: ValidationOptions): ValidationResult {
		const opts = { ...this.getDefaultOptions(), ...options }
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []

		// Required fields validation
		if (!data.name?.trim()) {
			errors.push({
				field: "name",
				message: "Name is required",
				code: "REQUIRED_FIELD_MISSING"
			})
		}

		if (!data.prompt?.trim()) {
			errors.push({
				field: "prompt",
				message: "Prompt is required",
				code: "REQUIRED_FIELD_MISSING"
			})
		}

		if (!data.category?.trim()) {
			errors.push({
				field: "category",
				message: "Category is required",
				code: "REQUIRED_FIELD_MISSING"
			})
		}

		// Name format validation
		if (data.name && !data.name.match(/^[a-zA-Z0-9_-]+$/)) {
			errors.push({
				field: "name",
				message: "Name must contain only letters, numbers, underscores, and hyphens",
				code: "INVALID_NAME_FORMAT"
			})
		}

		// Category validation
		if (data.category && !isValidCategory(data.category)) {
			errors.push({
				field: "category",
				message: `Invalid category: ${data.category}. Must be one of: analysis, visualization, reporting, methodology`,
				code: "INVALID_CATEGORY"
			})
		}

		// Priority validation
		if (data.priority !== undefined) {
			if (typeof data.priority !== "number" || data.priority < 0 || data.priority > 100) {
				errors.push({
					field: "priority",
					message: "Priority must be a number between 0 and 100",
					code: "INVALID_PRIORITY_RANGE"
				})
			}
		}

		// Optional field warnings
		if (opts.requireDescription && !data.description?.trim()) {
			warnings.push({
				field: "description",
				message: "Description is recommended for better documentation",
				suggestion: "Add a brief description of what this prompt block does"
			})
		}

		if (opts.requireTags && (!data.tags || data.tags.length === 0)) {
			warnings.push({
				field: "tags",
				message: "Tags help with organization and searchability",
				suggestion: "Add relevant tags like ['analysis', 'visualization', 'reporting']"
			})
		}

		// Prompt length validation
		if (data.prompt && opts.maxPromptLength && data.prompt.length > opts.maxPromptLength) {
			if (opts.strict) {
				errors.push({
					field: "prompt",
					message: `Prompt exceeds maximum length of ${opts.maxPromptLength} characters`,
					code: "PROMPT_TOO_LONG"
				})
			} else {
				warnings.push({
					field: "prompt",
					message: `Prompt is quite long (${data.prompt.length} characters)`,
					suggestion: "Consider breaking into smaller, more focused prompts"
				})
			}
		}

		// Variables validation
		if (data.variables) {
			const variableValidation = this.validateVariables(data.variables)
			errors.push(...variableValidation.errors)
			warnings.push(...variableValidation.warnings)
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		}
	}

	/**
	 * Validate YAML schema structure
	 */
	validateSchema(rawData: unknown): ValidationResult {
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []

		if (!rawData || typeof rawData !== "object") {
			errors.push({
				field: "root",
				message: "YAML must contain an object",
				code: "INVALID_ROOT_TYPE"
			})
			return { isValid: false, errors, warnings }
		}

		const data = rawData as Record<string, unknown>

		// Check required string fields
		const requiredStringFields = ["name", "prompt", "category"]
		for (const field of requiredStringFields) {
			if (field in data && typeof data[field] !== "string") {
				errors.push({
					field,
					message: `${field} must be a string`,
					code: "INVALID_FIELD_TYPE"
				})
			}
		}

		// Check optional string fields
		const optionalStringFields = ["description"]
		for (const field of optionalStringFields) {
			if (field in data && data[field] !== undefined && typeof data[field] !== "string") {
				errors.push({
					field,
					message: `${field} must be a string if provided`,
					code: "INVALID_FIELD_TYPE"
				})
			}
		}

		// Check tags array
		if ("tags" in data && data.tags !== undefined) {
			if (!Array.isArray(data.tags)) {
				errors.push({
					field: "tags",
					message: "tags must be an array if provided",
					code: "INVALID_FIELD_TYPE"
				})
			} else {
				for (const [index, tag] of data.tags.entries()) {
					if (typeof tag !== "string") {
						errors.push({
							field: `tags[${index}]`,
							message: "All tags must be strings",
							code: "INVALID_ARRAY_ITEM_TYPE"
						})
					}
				}
			}
		}

		// Check boolean fields
		const booleanFields = ["enabled"]
		for (const field of booleanFields) {
			if (field in data && data[field] !== undefined && typeof data[field] !== "boolean") {
				errors.push({
					field,
					message: `${field} must be a boolean if provided`,
					code: "INVALID_FIELD_TYPE"
				})
			}
		}

		// Check number fields
		const numberFields = ["priority"]
		for (const field of numberFields) {
			if (field in data && data[field] !== undefined && typeof data[field] !== "number") {
				errors.push({
					field,
					message: `${field} must be a number if provided`,
					code: "INVALID_FIELD_TYPE"
				})
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		}
	}

	/**
	 * Validate prompt block name format
	 */
	validateName(name: string): ValidationResult {
		const errors: ValidationError[] = []
		
		if (!name?.trim()) {
			errors.push({
				field: "name",
				message: "Name is required",
				code: "REQUIRED_FIELD_MISSING"
			})
		} else if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
			errors.push({
				field: "name",
				message: "Name must contain only letters, numbers, underscores, and hyphens",
				code: "INVALID_NAME_FORMAT"
			})
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings: []
		}
	}

	/**
	 * Validate category value
	 */
	validateCategory(category: string): ValidationResult {
		const errors: ValidationError[] = []
		
		if (!category?.trim()) {
			errors.push({
				field: "category",
				message: "Category is required",
				code: "REQUIRED_FIELD_MISSING"
			})
		} else if (!isValidCategory(category)) {
			errors.push({
				field: "category",
				message: `Invalid category: ${category}. Must be one of: analysis, visualization, reporting, methodology`,
				code: "INVALID_CATEGORY"
			})
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings: []
		}
	}

	/**
	 * Validate prompt content
	 */
	validatePrompt(prompt: string, options?: ValidationOptions): ValidationResult {
		const opts = { ...this.getDefaultOptions(), ...options }
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []
		
		if (!prompt?.trim()) {
			errors.push({
				field: "prompt",
				message: "Prompt is required",
				code: "REQUIRED_FIELD_MISSING"
			})
		} else {
			// Check length
			if (opts.maxPromptLength && prompt.length > opts.maxPromptLength) {
				if (opts.strict) {
					errors.push({
						field: "prompt",
						message: `Prompt exceeds maximum length of ${opts.maxPromptLength} characters`,
						code: "PROMPT_TOO_LONG"
					})
				} else {
					warnings.push({
						field: "prompt",
						message: `Prompt is quite long (${prompt.length} characters)`,
						suggestion: "Consider breaking into smaller, more focused prompts"
					})
				}
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		}
	}

	/**
	 * Validate variables array
	 */
	validateVariables(variables?: unknown[]): ValidationResult {
		const errors: ValidationError[] = []
		const warnings: ValidationWarning[] = []

		if (!Array.isArray(variables)) {
			errors.push({
				field: "variables",
				message: "variables must be an array if provided",
				code: "INVALID_FIELD_TYPE"
			})
			return { isValid: false, errors, warnings }
		}

		for (const [index, variable] of variables.entries()) {
			if (!variable || typeof variable !== "object") {
				errors.push({
					field: `variables[${index}]`,
					message: "Each variable must be an object",
					code: "INVALID_ARRAY_ITEM_TYPE"
				})
				continue
			}

			const varObj = variable as Record<string, unknown>
			
			// Check required fields
			if (!varObj.name || typeof varObj.name !== "string") {
				errors.push({
					field: `variables[${index}].name`,
					message: "Variable name is required and must be a string",
					code: "INVALID_VARIABLE_NAME"
				})
			}

			// Check optional fields
			if (varObj.description !== undefined && typeof varObj.description !== "string") {
				errors.push({
					field: `variables[${index}].description`,
					message: "Variable description must be a string if provided",
					code: "INVALID_FIELD_TYPE"
				})
			}

			if (varObj.required !== undefined && typeof varObj.required !== "boolean") {
				errors.push({
					field: `variables[${index}].required`,
					message: "Variable required field must be a boolean if provided",
					code: "INVALID_FIELD_TYPE"
				})
			}

			if (varObj.defaultValue !== undefined && typeof varObj.defaultValue !== "string") {
				errors.push({
					field: `variables[${index}].defaultValue`,
					message: "Variable defaultValue must be a string if provided",
					code: "INVALID_FIELD_TYPE"
				})
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		}
	}

	/**
	 * Get default validation options
	 */
	getDefaultOptions(): ValidationOptions {
		return {
			strict: false,
			requireDescription: false,
			requireTags: false,
			maxPromptLength: 10000
		}
	}
}