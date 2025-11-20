import { PromptBlock } from "../domain/PromptBlock"
import { PromptCategory, getCategoryDisplayName } from "../domain/PromptCategory"

/**
 * Active prompt configuration for system prompt enhancement
 */
export interface ActivePromptConfig {
	readonly block: PromptBlock
	readonly variables?: Record<string, string>
	readonly priority?: number
}

/**
 * System prompt enhancement result
 */
export interface SystemPromptResult {
	readonly originalPrompt: string
	readonly enhancedPrompt: string
	readonly appliedPrompts: ActivePromptConfig[]
	readonly conflictResolution: ConflictResolution[]
	readonly totalLength: number
	readonly addedLength: number
}

/**
 * Conflict resolution information
 */
export interface ConflictResolution {
	readonly category: PromptCategory
	readonly previousBlock?: string
	readonly selectedBlock: string
	readonly reason: string
}

/**
 * Use case for enhancing system prompts with prompt blocks
 * 
 * Implements category-based conflict resolution and direct prompt concatenation.
 * Follows the user's requirement for no meta-guidelines, just direct integration.
 */
export class EnhanceSystemPrompt {
	/**
	 * Enhance a system prompt with selected prompt blocks
	 */
	execute(
		originalPrompt: string,
		activePrompts: ActivePromptConfig[]
	): SystemPromptResult {
		const startLength = originalPrompt.length
		
		// Resolve conflicts (max 1 prompt per category)
		const { resolvedPrompts, conflicts } = this.resolveConflicts(activePrompts)
		
		// Sort by priority (higher priority first)
		const sortedPrompts = this.sortByPriority(resolvedPrompts)
		
		// Generate enhanced prompt with direct concatenation
		const enhancedPrompt = this.concatenatePrompts(originalPrompt, sortedPrompts)
		
		return {
			originalPrompt,
			enhancedPrompt,
			appliedPrompts: sortedPrompts,
			conflictResolution: conflicts,
			totalLength: enhancedPrompt.length,
			addedLength: enhancedPrompt.length - startLength,
		}
	}

	/**
	 * Create active prompt config from a block with optional variables
	 */
	createActivePrompt(
		block: PromptBlock,
		variables?: Record<string, string>,
		priority?: number
	): ActivePromptConfig {
		return {
			block,
			variables,
			priority: priority ?? block.priority,
		}
	}

	/**
	 * Resolve conflicts by category (max 1 prompt per category)
	 */
	private resolveConflicts(
		activePrompts: ActivePromptConfig[]
	): { resolvedPrompts: ActivePromptConfig[]; conflicts: ConflictResolution[] } {
		const categoryMap = new Map<PromptCategory, ActivePromptConfig[]>()
		const conflicts: ConflictResolution[] = []

		// Group by category
		for (const prompt of activePrompts) {
			const category = prompt.block.category
			if (!categoryMap.has(category)) {
				categoryMap.set(category, [])
			}
			categoryMap.get(category)!.push(prompt)
		}

		// Resolve conflicts in each category
		const resolvedPrompts: ActivePromptConfig[] = []
		
		for (const [category, prompts] of categoryMap) {
			if (prompts.length === 1) {
				resolvedPrompts.push(prompts[0])
			} else {
				// Multiple prompts in same category - select highest priority
				const sortedByPriority = prompts.sort((a, b) => b.priority! - a.priority!)
				const selected = sortedByPriority[0]
				resolvedPrompts.push(selected)
				
				// Record conflict resolution
				const conflicted = sortedByPriority.slice(1)
				for (const conflictPrompt of conflicted) {
					conflicts.push({
						category,
						previousBlock: conflictPrompt.block.name,
						selectedBlock: selected.block.name,
						reason: `Higher priority (${selected.priority} vs ${conflictPrompt.priority})`,
					})
				}
			}
		}

		return { resolvedPrompts, conflicts }
	}

	/**
	 * Sort prompts by priority (higher first)
	 */
	private sortByPriority(prompts: ActivePromptConfig[]): ActivePromptConfig[] {
		return [...prompts].sort((a, b) => b.priority! - a.priority!)
	}

	/**
	 * Concatenate original prompt with resolved prompts
	 * Direct concatenation approach as per user requirements
	 */
	private concatenatePrompts(
		originalPrompt: string,
		sortedPrompts: ActivePromptConfig[]
	): string {
		if (sortedPrompts.length === 0) {
			return originalPrompt
		}

		let enhanced = originalPrompt.trim()
		
		// Add each prompt directly with clear separation
		for (const promptConfig of sortedPrompts) {
			const resolvedPrompt = promptConfig.block.resolvePrompt(promptConfig.variables)
			
			// Add double newline separation for clarity
			enhanced += "\n\n" + resolvedPrompt.trim()
		}

		return enhanced
	}

	/**
	 * Generate a summary of active prompts for UI display
	 */
	generatePromptSummary(activePrompts: ActivePromptConfig[]): string {
		if (activePrompts.length === 0) {
			return "No active prompt blocks"
		}

		const { resolvedPrompts } = this.resolveConflicts(activePrompts)
		const categoryGroups = new Map<PromptCategory, string[]>()

		for (const prompt of resolvedPrompts) {
			const category = prompt.block.category
			if (!categoryGroups.has(category)) {
				categoryGroups.set(category, [])
			}
			categoryGroups.get(category)!.push(prompt.block.name)
		}

		const parts: string[] = []
		for (const [category, names] of categoryGroups) {
			const categoryName = getCategoryDisplayName(category)
			parts.push(`${categoryName}: ${names.join(", ")}`)
		}

		return parts.join(" | ")
	}

	/**
	 * Validate that prompt blocks don't create circular dependencies
	 */
	validateNoDependencyCycles(prompts: ActivePromptConfig[]): boolean {
		// For now, prompt blocks don't have dependencies, so no cycles possible
		// This method is here for future extensibility
		return true
	}
}