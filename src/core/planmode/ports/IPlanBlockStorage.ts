/**
 * Module: IPlanBlockStorage (port/interface)
 * Purpose: Storage interface for reusable plan blocks
 * Responsibilities:
 *  - Abstract plan block file storage operations
 *  - Provide CRUD operations for plan templates
 *  - Enable plan reusability and sharing
 * Invariants:
 *  - Plan blocks are immutable once saved (versioning for changes)
 *  - All operations are async to support file I/O
 *  - Plan blocks must have unique names within their category
 * Dependencies: None (operates on plain data objects)
 * Security: Storage implementations must validate file paths
 * Performance: Interface allows for caching and indexing
 */

/**
 * Plan block metadata for listing and searching
 */
export interface PlanBlockMetadata {
	readonly name: string
	readonly category: string
	readonly description: string
	readonly generated: boolean
	readonly createdAt: string
	readonly usageCount: number
	readonly lastUsed?: string
	readonly estimatedHours?: number
	readonly complexity?: 'low' | 'medium' | 'high'
	readonly tags?: readonly string[]
}

/**
 * Complete plan block with content and metadata
 */
export interface PlanBlock extends PlanBlockMetadata {
	readonly template: string
	readonly variables?: readonly PlanBlockVariable[]
	readonly matchKeywords?: readonly string[]
}

/**
 * Variable definition for plan block templates
 */
export interface PlanBlockVariable {
	readonly name: string
	readonly description: string
	readonly required: boolean
	readonly defaultValue?: string
	readonly type?: 'string' | 'number' | 'boolean' | 'select'
	readonly options?: readonly string[]
}

/**
 * Search criteria for finding plan blocks
 */
export interface PlanBlockSearchCriteria {
	readonly query?: string
	readonly category?: string
	readonly tags?: readonly string[]
	readonly complexity?: 'low' | 'medium' | 'high'
	readonly minUsageCount?: number
	readonly createdAfter?: string
	readonly limit?: number
}

/**
 * Storage error for plan block operations
 */
export class PlanBlockStorageError extends Error {
	/**
	 * Create a new plan block storage error
	 *
	 * @param message - Human-readable error message
	 * @param operation - The operation that failed
	 * @param blockName - Name of the plan block (if applicable)
	 * @param cause - Original error that caused this error
	 */
	constructor(
		message: string,
		public readonly operation: string,
		public readonly blockName?: string,
		public override readonly cause?: Error
	) {
		super(message)
		this.name = "PlanBlockStorageError"
	}
}

/**
 * Storage interface for reusable plan blocks
 *
 * Abstracts the file system operations for plan block templates.
 * Implementations handle .oacode/blocks/plans/ directory structure.
 */
export interface IPlanBlockStorage {
	/**
	 * Save a plan block to storage
	 *
	 * @param planBlock - Plan block to save
	 * @throws PlanBlockStorageError if save fails or block already exists
	 */
	savePlanBlock(planBlock: PlanBlock): Promise<void>

	/**
	 * Load a plan block by name
	 *
	 * @param name - Name of the plan block to load
	 * @returns Promise resolving to plan block or null if not found
	 * @throws PlanBlockStorageError if load fails
	 */
	loadPlanBlock(name: string): Promise<PlanBlock | null>

	/**
	 * List all available plan blocks
	 *
	 * @returns Promise resolving to array of plan block metadata
	 * @throws PlanBlockStorageError if listing fails
	 */
	listPlanBlocks(): Promise<PlanBlockMetadata[]>

	/**
	 * Search plan blocks by criteria
	 *
	 * @param criteria - Search criteria to filter plan blocks
	 * @returns Promise resolving to matching plan blocks
	 * @throws PlanBlockStorageError if search fails
	 */
	searchPlanBlocks(criteria: PlanBlockSearchCriteria): Promise<PlanBlock[]>

	/**
	 * Delete a plan block from storage
	 *
	 * @param name - Name of the plan block to delete
	 * @returns Promise resolving to true if deleted, false if not found
	 * @throws PlanBlockStorageError if delete fails
	 */
	deletePlanBlock(name: string): Promise<boolean>

	/**
	 * Check if a plan block exists
	 *
	 * @param name - Name of the plan block to check
	 * @returns Promise resolving to true if block exists
	 * @throws PlanBlockStorageError if check fails
	 */
	existsPlanBlock(name: string): Promise<boolean>

	/**
	 * Update plan block usage statistics
	 *
	 * @param name - Name of the plan block that was used
	 * @throws PlanBlockStorageError if update fails or block not found
	 */
	recordPlanBlockUsage(name: string): Promise<void>

	/**
	 * Find plan blocks that match a user request with high similarity
	 *
	 * @param userRequest - The user's request text
	 * @param threshold - Similarity threshold (0.0 to 1.0, default 0.98)
	 * @returns Promise resolving to matching plan blocks sorted by relevance
	 * @throws PlanBlockStorageError if matching fails
	 */
	findMatchingPlanBlocks(userRequest: string, threshold?: number): Promise<PlanBlock[]>

	/**
	 * Get storage statistics for diagnostics
	 *
	 * @returns Promise resolving to storage information
	 */
	getStorageInfo(): Promise<{
		totalBlocks: number
		categoryCounts: Record<string, number>
		totalSizeBytes?: number
		lastModified?: string
	}>

	/**
	 * Validate plan block structure and content
	 *
	 * @param planBlock - Plan block to validate
	 * @returns Promise resolving to validation result
	 */
	validatePlanBlock(planBlock: PlanBlock): Promise<{
		isValid: boolean
		errors: string[]
		warnings: string[]
	}>
}