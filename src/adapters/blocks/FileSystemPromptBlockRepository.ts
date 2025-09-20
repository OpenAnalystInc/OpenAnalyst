import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { PromptBlock, PromptBlockValidationError } from "../../core/blocks/domain/PromptBlock"
import { PromptCategory } from "../../core/blocks/domain/PromptCategory"
import { IPromptBlockRepository, BlockLoadResult } from "../../core/blocks/ports/IPromptBlockRepository"
import { YamlPromptBlockParser } from "./YamlPromptBlockParser"
import { fileExistsAtPath, isDirectory } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"

/**
 * File system-based repository for prompt blocks
 * 
 * Implements priority-based block resolution:
 * 1. Workspace blocks (.oacode/prompts/)
 * 2. Global blocks (~/.oacode/prompts/) 
 * 3. Default blocks (extension defaults/blocks/prompts/)
 * 
 * Follows Clean Architecture with external dependency isolation.
 */
export class FileSystemPromptBlockRepository implements IPromptBlockRepository {
	private cache = new Map<string, { block: PromptBlock; timestamp: number; source: string }>()
	private readonly cacheTimeout = 5 * 60 * 1000 // 5 minutes
	private fileWatcher?: vscode.FileSystemWatcher
	private parser = new YamlPromptBlockParser()

	constructor(
		private readonly workspacePath?: string,
		private readonly globalPath?: string,
		private readonly defaultsPath?: string
	) {}

	/**
	 * Load all available prompt blocks with priority resolution
	 */
	async loadAll(): Promise<PromptBlock[]> {
		const blocks = new Map<string, PromptBlock>()
		const searchPaths = this.getSearchPaths()

		// Load from all sources, with later sources overriding earlier ones
		for (const { path: searchPath, source } of searchPaths.reverse()) {
			try {
				const sourceBlocks = await this.loadBlocksFromDirectory(searchPath, source)
				
				for (const block of sourceBlocks) {
					blocks.set(block.name, block)
				}
			} catch (error) {
				console.warn(`Failed to load blocks from ${searchPath}:`, error)
			}
		}

		return Array.from(blocks.values())
	}

	/**
	 * Load a specific prompt block by name
	 */
	async loadByName(name: string): Promise<BlockLoadResult> {
		// Validate name format to prevent path traversal
		if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
			return {
				success: false,
				error: "Invalid block name format",
				source: "workspace"
			}
		}

		// Check cache first
		const cacheKey = `name:${name}`
		const cached = this.getCachedBlock(cacheKey)
		if (cached) {
			return {
				success: true,
				block: cached.block,
				source: cached.source as any,
				filePath: cached.source
			}
		}

		// Search in priority order
		const searchPaths = this.getSearchPaths()
		for (const { path: searchPath, source } of searchPaths) {
			try {
				const filePath = path.join(searchPath, `${name}.yaml`)
				
				if (!(await fileExistsAtPath(filePath))) {
					// Try .yml extension as fallback
					const ymlPath = path.join(searchPath, `${name}.yml`)
					if (!(await fileExistsAtPath(ymlPath))) {
						continue
					}
					// Use .yml path if .yaml doesn't exist
					const result = await this.loadBlockFromFile(ymlPath, source)
					if (result.success && result.block) {
						this.cacheBlock(cacheKey, result.block, ymlPath)
					}
					return result
				}

				const result = await this.loadBlockFromFile(filePath, source)
				if (result.success && result.block) {
					this.cacheBlock(cacheKey, result.block, filePath)
				}
				return result
			} catch (error) {
				console.warn(`Error loading block ${name} from ${searchPath}:`, error)
			}
		}

		return {
			success: false,
			error: `Block '${name}' not found`,
			source: "workspace"
		}
	}

	/**
	 * Load all prompt blocks of a specific category
	 */
	async loadByCategory(category: PromptCategory): Promise<PromptBlock[]> {
		const allBlocks = await this.loadAll()
		return allBlocks.filter(block => block.category === category)
	}

	/**
	 * Check if a prompt block exists
	 */
	async exists(name: string): Promise<boolean> {
		const result = await this.loadByName(name)
		return result.success
	}

	/**
	 * Get all available prompt block names
	 */
	async getAvailableNames(): Promise<string[]> {
		const names = new Set<string>()
		const searchPaths = this.getSearchPaths()

		for (const { path: searchPath } of searchPaths) {
			try {
				if (!(await isDirectory(searchPath))) {
					continue
				}

				const files = await fs.readdir(searchPath)
				for (const file of files) {
					if (file.endsWith('.yaml') || file.endsWith('.yml')) {
						const name = path.basename(file, path.extname(file))
						names.add(name)
					}
				}
			} catch (error) {
				// Directory might not exist, that's OK
			}
		}

		return Array.from(names).sort()
	}

	/**
	 * Clear any cached data
	 */
	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Watch for file changes and invalidate cache
	 */
	watchForChanges(): () => void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose()
		}

		const watchPaths: string[] = []
		const searchPaths = this.getSearchPaths()

		for (const { path: searchPath } of searchPaths) {
			watchPaths.push(searchPath)
		}

		// Create file system watcher for all paths
		const patterns = watchPaths.map(p => path.join(p, "*.{yaml,yml}"))
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(
			`{${patterns.join(',')}}`
		)

		// Clear cache on any file change
		const clearCacheHandler = () => {
			console.log("[PromptBlocks] File change detected, clearing cache")
			this.clearCache()
		}

		this.fileWatcher.onDidChange(clearCacheHandler)
		this.fileWatcher.onDidCreate(clearCacheHandler)
		this.fileWatcher.onDidDelete(clearCacheHandler)

		return () => {
			if (this.fileWatcher) {
				this.fileWatcher.dispose()
				this.fileWatcher = undefined
			}
		}
	}

	/**
	 * Get search paths in priority order (workspace → global → defaults)
	 */
	private getSearchPaths(): Array<{ path: string; source: "workspace" | "defaults" | "global" }> {
		const paths: Array<{ path: string; source: "workspace" | "defaults" | "global" }> = []

		// 1. Workspace blocks (highest priority)
		if (this.workspacePath) {
			paths.push({
				path: path.join(this.workspacePath, "prompts"),
				source: "workspace"
			})
		}

		// Also check workspace folders directly
		const workspaceFolders = vscode.workspace.workspaceFolders || []
		for (const folder of workspaceFolders) {
			const workspacePromptsPath = path.join(folder.uri.fsPath, ".oacode", "prompts")
			// Only add if not already included
			if (!paths.some(p => p.path === workspacePromptsPath)) {
				paths.push({
					path: workspacePromptsPath,
					source: "workspace"
				})
			}
		}

		// 2. Global blocks (medium priority)
		if (this.globalPath) {
			paths.push({
				path: path.join(this.globalPath, "prompts"),
				source: "global"
			})
		}

		// 3. Default blocks (lowest priority)
		if (this.defaultsPath) {
			paths.push({
				path: path.join(this.defaultsPath, "prompts"),
				source: "defaults"
			})
		}

		return paths
	}

	/**
	 * Load blocks from a specific directory
	 */
	private async loadBlocksFromDirectory(
		directoryPath: string,
		source: string
	): Promise<PromptBlock[]> {
		if (!(await isDirectory(directoryPath))) {
			return []
		}

		const blocks: PromptBlock[] = []
		
		try {
			const files = await fs.readdir(directoryPath)
			const yamlFiles = files.filter(file => 
				file.endsWith('.yaml') || file.endsWith('.yml')
			)

			for (const filename of yamlFiles) {
				const filePath = path.join(directoryPath, filename)
				
				try {
					const result = await this.loadBlockFromFile(filePath, source)
					if (result.success && result.block) {
						blocks.push(result.block)
					}
				} catch (error) {
					console.warn(`Failed to load prompt block from ${filePath}:`, error)
				}
			}
		} catch (error) {
			throw new Error(`Failed to read directory ${directoryPath}: ${error}`)
		}

		return blocks
	}

	/**
	 * Load a single block from file
	 */
	private async loadBlockFromFile(
		filePath: string,
		source: string
	): Promise<BlockLoadResult> {
		try {
			const content = await fs.readFile(filePath, 'utf-8')
			const data = await this.parser.parseFromContent(content, filePath)
			const block = PromptBlock.create(data)

			return {
				success: true,
				block,
				source: source as any,
				filePath
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			
			return {
				success: false,
				error: errorMessage,
				source: source as any,
				filePath
			}
		}
	}

	/**
	 * Cache management
	 */
	private getCachedBlock(cacheKey: string): { block: PromptBlock; source: string } | null {
		const cached = this.cache.get(cacheKey)
		
		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			return {
				block: cached.block,
				source: cached.source
			}
		}

		// Remove expired cache entry
		this.cache.delete(cacheKey)
		return null
	}

	private cacheBlock(cacheKey: string, block: PromptBlock, source: string): void {
		this.cache.set(cacheKey, {
			block,
			timestamp: Date.now(),
			source
		})
	}
}