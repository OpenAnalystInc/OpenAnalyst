import { PromptBlock } from "../domain/PromptBlock"
import { PromptCategory } from "../domain/PromptCategory"
import { IPromptBlockRepository } from "../ports/IPromptBlockRepository"

/**
 * Cache entry for loaded prompt blocks
 */
interface CacheEntry {
	blocks: PromptBlock[]
	timestamp: number
	version: number
}

/**
 * Load result with metadata
 */
export interface LoadPromptBlocksResult {
	readonly blocks: PromptBlock[]
	readonly loadedCount: number
	readonly errorCount: number
	readonly fromCache: boolean
	readonly loadTime: number
}

/**
 * Use case for loading prompt blocks with caching
 * 
 * Implements business logic for loading, caching, and filtering prompt blocks.
 * Follows Clean Architecture with dependency injection.
 */
export class LoadPromptBlocks {
	private cache = new Map<string, CacheEntry>()
	private readonly cacheTimeout = 5 * 60 * 1000 // 5 minutes
	private cacheVersion = 0

	constructor(
		private readonly repository: IPromptBlockRepository
	) {}

	/**
	 * Load all available prompt blocks
	 */
	async execute(): Promise<LoadPromptBlocksResult> {
		const startTime = Date.now()
		const cacheKey = "all"
		
		// Check cache first
		const cached = this.getCachedBlocks(cacheKey)
		if (cached) {
			return {
				blocks: cached.blocks,
				loadedCount: cached.blocks.length,
				errorCount: 0,
				fromCache: true,
				loadTime: Date.now() - startTime,
			}
		}

		// Load from repository
		const blocks = await this.repository.loadAll()
		const enabledBlocks = blocks.filter(block => block.isEnabled())
		
		// Cache the results
		this.cacheBlocks(cacheKey, enabledBlocks)

		return {
			blocks: enabledBlocks,
			loadedCount: enabledBlocks.length,
			errorCount: blocks.length - enabledBlocks.length,
			fromCache: false,
			loadTime: Date.now() - startTime,
		}
	}

	/**
	 * Load prompt blocks filtered by category
	 */
	async executeByCategory(category: PromptCategory): Promise<LoadPromptBlocksResult> {
		const startTime = Date.now()
		const cacheKey = `category:${category}`
		
		// Check cache first
		const cached = this.getCachedBlocks(cacheKey)
		if (cached) {
			return {
				blocks: cached.blocks,
				loadedCount: cached.blocks.length,
				errorCount: 0,
				fromCache: true,
				loadTime: Date.now() - startTime,
			}
		}

		// Load from repository
		const blocks = await this.repository.loadByCategory(category)
		const enabledBlocks = blocks.filter(block => block.isEnabled())
		
		// Cache the results
		this.cacheBlocks(cacheKey, enabledBlocks)

		return {
			blocks: enabledBlocks,
			loadedCount: enabledBlocks.length,
			errorCount: blocks.length - enabledBlocks.length,
			fromCache: false,
			loadTime: Date.now() - startTime,
		}
	}

	/**
	 * Load a specific prompt block by name
	 */
	async executeByName(name: string): Promise<PromptBlock | null> {
		const result = await this.repository.loadByName(name)
		
		if (result.success && result.block?.isEnabled()) {
			return result.block
		}
		
		return null
	}

	/**
	 * Get available prompt block names for autocomplete/UI
	 */
	async getAvailableNames(): Promise<string[]> {
		return this.repository.getAvailableNames()
	}

	/**
	 * Clear cache and force reload
	 */
	invalidateCache(): void {
		this.cache.clear()
		this.cacheVersion++
		this.repository.clearCache()
	}

	/**
	 * Start watching for file changes (hot reload)
	 */
	enableHotReload(): () => void {
		const stopWatching = this.repository.watchForChanges()
		
		// Invalidate cache when files change
		const originalStopWatching = stopWatching
		return () => {
			this.invalidateCache()
			originalStopWatching()
		}
	}

	/**
	 * Get cache statistics for debugging
	 */
	getCacheStats(): { size: number; keys: string[]; version: number } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()),
			version: this.cacheVersion,
		}
	}

	/**
	 * Get cached blocks if available and not expired
	 */
	private getCachedBlocks(cacheKey: string): CacheEntry | null {
		const cached = this.cache.get(cacheKey)
		
		if (cached && 
			Date.now() - cached.timestamp < this.cacheTimeout &&
			cached.version === this.cacheVersion) {
			return cached
		}

		// Remove expired cache entry
		this.cache.delete(cacheKey)
		return null
	}

	/**
	 * Cache blocks with current timestamp and version
	 */
	private cacheBlocks(cacheKey: string, blocks: PromptBlock[]): void {
		this.cache.set(cacheKey, {
			blocks: [...blocks], // Create copy to prevent mutations
			timestamp: Date.now(),
			version: this.cacheVersion,
		})
	}
}