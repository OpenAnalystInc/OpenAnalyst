/**
 * Prompt block categories for conflict resolution and organization
 * 
 * Only one prompt per category can be active at a time to prevent
 * conflicting instructions in the system prompt.
 */
export enum PromptCategory {
	ANALYSIS = "analysis",
	VISUALIZATION = "visualization", 
	REPORTING = "reporting",
	METHODOLOGY = "methodology",
}

/**
 * Human-readable category names for UI display
 */
export const CATEGORY_DISPLAY_NAMES: Record<PromptCategory, string> = {
	[PromptCategory.ANALYSIS]: "Analysis",
	[PromptCategory.VISUALIZATION]: "Visualization",
	[PromptCategory.REPORTING]: "Reporting", 
	[PromptCategory.METHODOLOGY]: "Methodology",
}

/**
 * Category descriptions for user guidance
 */
export const CATEGORY_DESCRIPTIONS: Record<PromptCategory, string> = {
	[PromptCategory.ANALYSIS]: "Instructions for data analysis and exploration",
	[PromptCategory.VISUALIZATION]: "Chart creation and visualization guidelines",
	[PromptCategory.REPORTING]: "Report generation and formatting instructions",
	[PromptCategory.METHODOLOGY]: "Analysis methodology and best practices",
}

/**
 * Get all valid prompt categories
 */
export function getAllCategories(): PromptCategory[] {
	return Object.values(PromptCategory)
}

/**
 * Validate if a string is a valid prompt category
 */
export function isValidCategory(category: string): category is PromptCategory {
	return Object.values(PromptCategory).includes(category as PromptCategory)
}

/**
 * Get display name for a category
 */
export function getCategoryDisplayName(category: PromptCategory): string {
	return CATEGORY_DISPLAY_NAMES[category]
}

/**
 * Get description for a category
 */
export function getCategoryDescription(category: PromptCategory): string {
	return CATEGORY_DESCRIPTIONS[category]
}