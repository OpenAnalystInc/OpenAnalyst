/**
 * Module: FileSystemPlanBlockStorage (adapter)
 * Purpose: File system adapter implementing IPlanBlockStorage
 * Responsibilities:
 *  - Implement plan block storage using YAML files in .oacode/blocks/plans/
 *  - Handle file I/O operations with proper error handling
 *  - Provide search and matching capabilities for plan blocks
 * Invariants:
 *  - Plan blocks are stored as YAML files with .yaml extension
 *  - File names must be valid and unique within directory
 *  - All operations are atomic (complete or fail)
 * Dependencies: fs/promises, yaml, path utilities
 * Security: Validates file paths to prevent directory traversal
 * Performance: Caches plan block metadata for faster searches
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { getWorkspacePath } from "../../utils/path"
import {
	IPlanBlockStorage,
	PlanBlock,
	PlanBlockMetadata,
	PlanBlockSearchCriteria,
	PlanBlockVariable,
	PlanBlockStorageError
} from "../../core/planmode/ports/IPlanBlockStorage"

/**
 * Directory structure for plan blocks
 */
const PLAN_BLOCKS_DIR = ".oacode/blocks/plans"
const PLAN_BLOCK_EXTENSION = ".yaml"

/**
 * Cache for plan block metadata to improve search performance
 */
interface CachedMetadata {
	metadata: PlanBlockMetadata[]
	lastUpdated: number
	cacheKey: string
}

/**
 * File system adapter for plan block storage
 *
 * Implements IPlanBlockStorage using YAML files in the workspace.
 * Provides caching and search capabilities for better performance.
 */
export class FileSystemPlanBlockStorage implements IPlanBlockStorage {
	private metadataCache: CachedMetadata | null = null
	private readonly cacheValidityMs = 30000 // 30 seconds

	/**
	 * Get the plan blocks directory path
	 *
	 * @returns Absolute path to plan blocks directory or null if no workspace
	 * @throws PlanBlockStorageError if workspace path is invalid
	 */
	private getPlanBlocksDirectory(): string {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) {
			throw new PlanBlockStorageError(
				"No workspace available for plan block storage",
				"getPlanBlocksDirectory"
			)
		}

		return path.join(workspacePath, PLAN_BLOCKS_DIR)
	}

	/**
	 * Validate and sanitize plan block name
	 *
	 * @param name - Plan block name to validate
	 * @returns Sanitized name
	 * @throws PlanBlockStorageError if name is invalid
	 */
	private validatePlanBlockName(name: string): string {
		if (!name?.trim()) {
			throw new PlanBlockStorageError(
				"Plan block name cannot be empty",
				"validatePlanBlockName",
				name
			)
		}

		const sanitized = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-')

		if (sanitized !== name) {
			if (process.env.NODE_ENV === 'development') {
				console.warn('[FileSystemPlanBlockStorage] Plan block name sanitized', {
					original: name,
					sanitized
				})
			}
		}

		return sanitized
	}

	/**
	 * Get file path for a plan block
	 *
	 * @param name - Plan block name
	 * @returns Full file path
	 */
	private getPlanBlockFilePath(name: string): string {
		const sanitizedName = this.validatePlanBlockName(name)
		const blocksDir = this.getPlanBlocksDirectory()
		return path.join(blocksDir, `${sanitizedName}${PLAN_BLOCK_EXTENSION}`)
	}

	/**
	 * Ensure plan blocks directory exists
	 *
	 * @throws PlanBlockStorageError if directory creation fails
	 */
	private async ensureDirectoryExists(): Promise<void> {
		try {
			const blocksDir = this.getPlanBlocksDirectory()
			await fs.mkdir(blocksDir, { recursive: true })
		} catch (error) {
			throw new PlanBlockStorageError(
				"Failed to create plan blocks directory",
				"ensureDirectoryExists",
				undefined,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Parse YAML content safely with error handling
	 *
	 * @param content - YAML content to parse
	 * @param filePath - File path for error context
	 * @returns Parsed object
	 */
	private parseYamlSafely(content: string, filePath: string): any {
		try {
			return yaml.parse(content) || {}
		} catch (error) {
			throw new PlanBlockStorageError(
				`Invalid YAML in plan block: ${error instanceof Error ? error.message : 'Parse error'}`,
				"parseYamlSafely",
				path.basename(filePath),
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Invalidate metadata cache
	 */
	private invalidateCache(): void {
		this.metadataCache = null
	}

	/**
	 * Check if metadata cache is valid
	 */
	private isCacheValid(): boolean {
		if (!this.metadataCache) return false
		return Date.now() - this.metadataCache.lastUpdated < this.cacheValidityMs
	}

	/**
	 * Save a plan block to storage
	 *
	 * @param planBlock - Plan block to save
	 * @throws PlanBlockStorageError if save fails or block already exists
	 */
	async savePlanBlock(planBlock: PlanBlock): Promise<void> {
		try {
			await this.ensureDirectoryExists()

			const filePath = this.getPlanBlockFilePath(planBlock.name)

			// Check if file already exists
			try {
				await fs.access(filePath)
				throw new PlanBlockStorageError(
					`Plan block '${planBlock.name}' already exists`,
					"savePlanBlock",
					planBlock.name
				)
			} catch (error) {
				// File doesn't exist, which is what we want
				if (error instanceof PlanBlockStorageError) {
					throw error // Re-throw our own error
				}
			}

			// Validate plan block
			const validation = await this.validatePlanBlock(planBlock)
			if (!validation.isValid) {
				throw new PlanBlockStorageError(
					`Plan block validation failed: ${validation.errors.join(', ')}`,
					"savePlanBlock",
					planBlock.name
				)
			}

			// Convert to YAML and save
			const yamlContent = yaml.stringify(planBlock, {
				indent: 2,
				lineWidth: 120
			})

			await fs.writeFile(filePath, yamlContent, 'utf-8')

			// Invalidate cache
			this.invalidateCache()

			if (process.env.NODE_ENV === 'development') {
				console.debug('[FileSystemPlanBlockStorage] Plan block saved', {
					name: planBlock.name,
					category: planBlock.category,
					filePath,
					timestamp: new Date().toISOString()
				})
			}

		} catch (error) {
			if (error instanceof PlanBlockStorageError) {
				throw error
			}

			throw new PlanBlockStorageError(
				`Failed to save plan block '${planBlock.name}'`,
				"savePlanBlock",
				planBlock.name,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Load a plan block by name
	 *
	 * @param name - Name of the plan block to load
	 * @returns Promise resolving to plan block or null if not found
	 * @throws PlanBlockStorageError if load fails
	 */
	async loadPlanBlock(name: string): Promise<PlanBlock | null> {
		try {
			const filePath = this.getPlanBlockFilePath(name)

			// Check if file exists
			try {
				await fs.access(filePath)
			} catch {
				return null // File doesn't exist
			}

			// Read and parse file
			const content = await fs.readFile(filePath, 'utf-8')
			const planBlockData = this.parseYamlSafely(content, filePath)

			// Validate required fields
			if (!planBlockData.name || !planBlockData.template) {
				throw new PlanBlockStorageError(
					`Invalid plan block structure in '${name}': missing required fields`,
					"loadPlanBlock",
					name
				)
			}

			return planBlockData as PlanBlock

		} catch (error) {
			if (error instanceof PlanBlockStorageError) {
				throw error
			}

			throw new PlanBlockStorageError(
				`Failed to load plan block '${name}'`,
				"loadPlanBlock",
				name,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * List all available plan blocks
	 *
	 * @returns Promise resolving to array of plan block metadata
	 * @throws PlanBlockStorageError if listing fails
	 */
	async listPlanBlocks(): Promise<PlanBlockMetadata[]> {
		try {
			// Check cache first
			if (this.isCacheValid()) {
				return this.metadataCache!.metadata
			}

			const blocksDir = this.getPlanBlocksDirectory()

			// Check if directory exists
			try {
				await fs.access(blocksDir)
			} catch {
				return [] // Directory doesn't exist, return empty list
			}

			// Read directory
			const entries = await fs.readdir(blocksDir, { withFileTypes: true })
			const yamlFiles = entries.filter(entry =>
				entry.isFile() && entry.name.endsWith(PLAN_BLOCK_EXTENSION)
			)

			const metadata: PlanBlockMetadata[] = []

			for (const file of yamlFiles) {
				try {
					const filePath = path.join(blocksDir, file.name)
					const content = await fs.readFile(filePath, 'utf-8')
					const planBlock = this.parseYamlSafely(content, filePath)

					// Extract metadata (exclude template content for performance)
					const {
						name,
						category,
						description,
						generated,
						createdAt,
						usageCount,
						lastUsed,
						estimatedHours,
						complexity,
						tags
					} = planBlock

					if (name && category && description) {
						metadata.push({
							name,
							category,
							description,
							generated: generated || false,
							createdAt: createdAt || new Date().toISOString(),
							usageCount: usageCount || 0,
							lastUsed,
							estimatedHours,
							complexity,
							tags
						})
					}
				} catch (error) {
					// Log but don't fail the entire operation for one bad file
					if (process.env.NODE_ENV === 'development') {
						console.warn('[FileSystemPlanBlockStorage] Failed to read plan block', {
							file: file.name,
							error: error instanceof Error ? error.message : 'Unknown error'
						})
					}
				}
			}

			// Update cache
			this.metadataCache = {
				metadata,
				lastUpdated: Date.now(),
				cacheKey: blocksDir
			}

			return metadata

		} catch (error) {
			throw new PlanBlockStorageError(
				"Failed to list plan blocks",
				"listPlanBlocks",
				undefined,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Search plan blocks by criteria
	 *
	 * @param criteria - Search criteria to filter plan blocks
	 * @returns Promise resolving to matching plan blocks
	 * @throws PlanBlockStorageError if search fails
	 */
	async searchPlanBlocks(criteria: PlanBlockSearchCriteria): Promise<PlanBlock[]> {
		try {
			const allMetadata = await this.listPlanBlocks()
			const matchingBlocks: PlanBlock[] = []

			for (const metadata of allMetadata) {
				// Apply filters
				if (criteria.category && metadata.category !== criteria.category) {
					continue
				}

				if (criteria.complexity && metadata.complexity !== criteria.complexity) {
					continue
				}

				if (criteria.minUsageCount && metadata.usageCount < criteria.minUsageCount) {
					continue
				}

				if (criteria.createdAfter && metadata.createdAt < criteria.createdAfter) {
					continue
				}

				// Text search in name and description
				if (criteria.query) {
					const queryLower = criteria.query.toLowerCase()
					const nameMatch = metadata.name.toLowerCase().includes(queryLower)
					const descMatch = metadata.description.toLowerCase().includes(queryLower)

					if (!nameMatch && !descMatch) {
						continue
					}
				}

				// Tag filtering
				if (criteria.tags && criteria.tags.length > 0) {
					const hasMatchingTag = criteria.tags.some(tag =>
						metadata.tags?.includes(tag)
					)
					if (!hasMatchingTag) {
						continue
					}
				}

				// Load full plan block
				const planBlock = await this.loadPlanBlock(metadata.name)
				if (planBlock) {
					matchingBlocks.push(planBlock)
				}

				// Apply limit
				if (criteria.limit && matchingBlocks.length >= criteria.limit) {
					break
				}
			}

			return matchingBlocks

		} catch (error) {
			throw new PlanBlockStorageError(
				"Failed to search plan blocks",
				"searchPlanBlocks",
				undefined,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Delete a plan block from storage
	 *
	 * @param name - Name of the plan block to delete
	 * @returns Promise resolving to true if deleted, false if not found
	 * @throws PlanBlockStorageError if delete fails
	 */
	async deletePlanBlock(name: string): Promise<boolean> {
		try {
			const filePath = this.getPlanBlockFilePath(name)

			try {
				await fs.unlink(filePath)
				this.invalidateCache()

				if (process.env.NODE_ENV === 'development') {
					console.debug('[FileSystemPlanBlockStorage] Plan block deleted', {
						name,
						filePath,
						timestamp: new Date().toISOString()
					})
				}

				return true
			} catch (error) {
				// Check if file doesn't exist
				if ((error as any)?.code === 'ENOENT') {
					return false
				}
				throw error
			}

		} catch (error) {
			throw new PlanBlockStorageError(
				`Failed to delete plan block '${name}'`,
				"deletePlanBlock",
				name,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Check if a plan block exists
	 *
	 * @param name - Name of the plan block to check
	 * @returns Promise resolving to true if block exists
	 * @throws PlanBlockStorageError if check fails
	 */
	async existsPlanBlock(name: string): Promise<boolean> {
		try {
			const filePath = this.getPlanBlockFilePath(name)

			try {
				await fs.access(filePath)
				return true
			} catch {
				return false
			}

		} catch (error) {
			throw new PlanBlockStorageError(
				`Failed to check if plan block '${name}' exists`,
				"existsPlanBlock",
				name,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Update plan block usage statistics
	 *
	 * @param name - Name of the plan block that was used
	 * @throws PlanBlockStorageError if update fails or block not found
	 */
	async recordPlanBlockUsage(name: string): Promise<void> {
		try {
			const planBlock = await this.loadPlanBlock(name)
			if (!planBlock) {
				throw new PlanBlockStorageError(
					`Plan block '${name}' not found`,
					"recordPlanBlockUsage",
					name
				)
			}

			// Update usage statistics
			const updatedBlock: PlanBlock = {
				...planBlock,
				usageCount: (planBlock.usageCount || 0) + 1,
				lastUsed: new Date().toISOString()
			}

			// Save back to file (overwrite existing)
			const filePath = this.getPlanBlockFilePath(name)
			const yamlContent = yaml.stringify(updatedBlock, {
				indent: 2,
				lineWidth: 120
			})

			await fs.writeFile(filePath, yamlContent, 'utf-8')
			this.invalidateCache()

		} catch (error) {
			if (error instanceof PlanBlockStorageError) {
				throw error
			}

			throw new PlanBlockStorageError(
				`Failed to record usage for plan block '${name}'`,
				"recordPlanBlockUsage",
				name,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Find plan blocks that match a user request with high similarity
	 *
	 * @param userRequest - The user's request text
	 * @param threshold - Similarity threshold (0.0 to 1.0, default 0.98)
	 * @returns Promise resolving to matching plan blocks sorted by relevance
	 * @throws PlanBlockStorageError if matching fails
	 */
	async findMatchingPlanBlocks(userRequest: string, threshold: number = 0.98): Promise<PlanBlock[]> {
		try {
			const allBlocks = await this.searchPlanBlocks({})
			const matches: Array<{ block: PlanBlock; score: number }> = []

			const requestTerms = userRequest.toLowerCase().split(/\s+/)

			for (const block of allBlocks) {
				let score = 0
				const blockTerms = [
					...block.name.toLowerCase().split(/[-_\s]+/),
					...block.description.toLowerCase().split(/\s+/),
					...(block.matchKeywords || [])
				]

				// Calculate similarity score
				const matchCount = requestTerms.filter(term =>
					blockTerms.some(blockTerm =>
						blockTerm.includes(term) || term.includes(blockTerm)
					)
				).length

				score = matchCount / requestTerms.length

				if (score >= threshold) {
					matches.push({ block, score })
				}
			}

			// Sort by score descending
			matches.sort((a, b) => b.score - a.score)

			return matches.map(match => match.block)

		} catch (error) {
			throw new PlanBlockStorageError(
				"Failed to find matching plan blocks",
				"findMatchingPlanBlocks",
				undefined,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Get storage statistics for diagnostics
	 *
	 * @returns Promise resolving to storage information
	 */
	async getStorageInfo(): Promise<{
		totalBlocks: number
		categoryCounts: Record<string, number>
		totalSizeBytes?: number
		lastModified?: string
	}> {
		try {
			const metadata = await this.listPlanBlocks()
			const categoryCounts: Record<string, number> = {}

			metadata.forEach(block => {
				categoryCounts[block.category] = (categoryCounts[block.category] || 0) + 1
			})

			// Calculate total size (rough estimate)
			let totalSizeBytes: number | undefined = undefined
			const blocksDir = this.getPlanBlocksDirectory()

			try {
				totalSizeBytes = 0
				const entries = await fs.readdir(blocksDir, { withFileTypes: true })
				for (const entry of entries) {
					if (entry.isFile() && entry.name.endsWith(PLAN_BLOCK_EXTENSION)) {
						const filePath = path.join(blocksDir, entry.name)
						const stats = await fs.stat(filePath)
						totalSizeBytes += stats.size
					}
				}
			} catch {
				// If we can't calculate size, that's okay
				totalSizeBytes = undefined
			}

			return {
				totalBlocks: metadata.length,
				categoryCounts,
				totalSizeBytes,
				lastModified: metadata.length > 0 ?
					Math.max(...metadata.map(m => new Date(m.createdAt).getTime())).toString() :
					undefined
			}

		} catch (error) {
			throw new PlanBlockStorageError(
				"Failed to get storage information",
				"getStorageInfo",
				undefined,
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Validate plan block structure and content
	 *
	 * @param planBlock - Plan block to validate
	 * @returns Promise resolving to validation result
	 */
	async validatePlanBlock(planBlock: PlanBlock): Promise<{
		isValid: boolean
		errors: string[]
		warnings: string[]
	}> {
		const errors: string[] = []
		const warnings: string[] = []

		// Required fields
		if (!planBlock.name?.trim()) {
			errors.push("Name is required")
		}

		if (!planBlock.category?.trim()) {
			errors.push("Category is required")
		}

		if (!planBlock.description?.trim()) {
			errors.push("Description is required")
		}

		if (!planBlock.template?.trim()) {
			errors.push("Template content is required")
		}

		// Name validation
		if (planBlock.name && !planBlock.name.match(/^[a-zA-Z0-9_-]+$/)) {
			errors.push("Name must contain only letters, numbers, underscores, and hyphens")
		}

		// Template structure validation
		if (planBlock.template) {
			if (!planBlock.template.match(/^#\s+Plan:/m)) {
				warnings.push("Template should start with '# Plan: [Title]' for consistency")
			}

			if (!planBlock.template.match(/^#{2,3}\s+Phase/m)) {
				warnings.push("Template should include phases for better structure")
			}
		}

		// Variables validation
		if (planBlock.variables) {
			planBlock.variables.forEach((variable, index) => {
				if (!variable.name?.trim()) {
					errors.push(`Variable ${index + 1} missing name`)
				}
				if (!variable.description?.trim()) {
					warnings.push(`Variable ${index + 1} missing description`)
				}
			})
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		}
	}
}