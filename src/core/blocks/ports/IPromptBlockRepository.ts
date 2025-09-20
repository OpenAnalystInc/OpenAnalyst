import { PromptBlock } from "../domain/PromptBlock"
import { PromptCategory } from "../domain/PromptCategory"

/**
 * Result of a block loading operation
 */
export interface BlockLoadResult {
	readonly success: boolean
	readonly block?: PromptBlock
	readonly error?: string
	readonly source: "workspace" | "defaults" | "global"
	readonly filePath?: string
}

/**
 * Repository interface for prompt block data access
 * 
 * This port defines the contract for loading prompt blocks from various sources
 * following the Repository pattern for Clean Architecture.
 */
export interface IPromptBlockRepository {
	/**
	 * Load all available prompt blocks with priority resolution
	 * workspace → defaults → global
	 */
	loadAll(): Promise<PromptBlock[]>

	/**
	 * Load a specific prompt block by name
	 */
	loadByName(name: string): Promise<BlockLoadResult>

	/**
	 * Load all prompt blocks of a specific category
	 */
	loadByCategory(category: PromptCategory): Promise<PromptBlock[]>

	/**
	 * Check if a prompt block exists
	 */
	exists(name: string): Promise<boolean>

	/**
	 * Get all available prompt block names
	 */
	getAvailableNames(): Promise<string[]>

	/**
	 * Clear any cached data
	 */
	clearCache(): void

	/**
	 * Watch for file changes and invalidate cache
	 * Returns a dispose function to stop watching
	 */
	watchForChanges(): () => void
}