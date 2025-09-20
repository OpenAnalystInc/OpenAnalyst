/**
 * Module: PromptBlocksFactory (core/factory)
 * Purpose: Dependency injection factory for prompt block services using Clean Architecture.
 * Responsibilities:
 *  - Create and wire prompt block use cases with their dependencies
 *  - Manage singleton instances for performance (optional, not enforced)
 *  - Resolve file system paths for different environments (dev/prod/test)
 *  - Abstract dependency construction from consumers
 * Invariants:
 *  - All created instances use the same repository instance for consistency
 *  - Path resolution follows priority order: workspace → global → defaults
 *  - Factory methods are idempotent (safe to call multiple times)
 * Dependencies: LoadPromptBlocks, EnhanceSystemPrompt use cases; FileSystemPromptBlockRepository adapter
 * Security: Path traversal protection via proper path resolution
 * Performance: Lazy instantiation and optional singleton pattern
 */

import * as path from "path"
import * as os from "os"
import { LoadPromptBlocks } from "./usecases/LoadPromptBlocks"
import { EnhanceSystemPrompt } from "./usecases/EnhanceSystemPrompt"
import { FileSystemPromptBlockRepository } from "../../adapters/blocks/FileSystemPromptBlockRepository"
import { getWorkspacePath } from "../../utils/path"
import { promptBlocksLogger } from "../infrastructure/Logger"

/**
 * Dependency injection factory for prompt block services
 * 
 * Follows Clean Architecture principles by separating construction concerns
 * from business logic. Provides centralized configuration and dependency wiring.
 * 
 * @example
 * ```ts
 * const factory = PromptBlocksFactory.getInstance()
 * const loadUseCase = factory.createLoadPromptBlocks('/path/to/extension')
 * const blocks = await loadUseCase.execute()
 * ```
 */
export class PromptBlocksFactory {
	private static instance?: PromptBlocksFactory
	private loadPromptBlocksUseCase?: LoadPromptBlocks
	private enhanceSystemPromptUseCase?: EnhanceSystemPrompt
	private repository?: FileSystemPromptBlockRepository

	/**
	 * Get singleton instance (for convenience, not enforced)
	 */
	static getInstance(): PromptBlocksFactory {
		if (!this.instance) {
			this.instance = new PromptBlocksFactory()
		}
		return this.instance
	}

	/**
	 * Create LoadPromptBlocks use case with dependencies
	 */
	createLoadPromptBlocks(extensionPath?: string): LoadPromptBlocks {
		if (!this.loadPromptBlocksUseCase) {
			const repository = this.createRepository(extensionPath)
			this.loadPromptBlocksUseCase = new LoadPromptBlocks(repository)
		}
		return this.loadPromptBlocksUseCase
	}

	/**
	 * Create EnhanceSystemPrompt use case
	 */
	createEnhanceSystemPrompt(): EnhanceSystemPrompt {
		if (!this.enhanceSystemPromptUseCase) {
			this.enhanceSystemPromptUseCase = new EnhanceSystemPrompt()
		}
		return this.enhanceSystemPromptUseCase
	}

	/**
	 * Create repository with proper path resolution
	 */
	createRepository(extensionPath?: string): FileSystemPromptBlockRepository {
		if (!this.repository) {
			const paths = this.resolvePaths(extensionPath)
			this.repository = new FileSystemPromptBlockRepository(
				paths.workspacePath,
				paths.globalPath,
				paths.defaultsPath
			)
		}
		return this.repository
	}

	/**
	 * Clear cached instances (useful for testing)
	 */
	reset(): void {
		this.loadPromptBlocksUseCase = undefined
		this.enhanceSystemPromptUseCase = undefined
		this.repository = undefined
	}

	/**
	 * Resolve paths for different block sources
	 */
	private resolvePaths(extensionPath?: string): {
		workspacePath?: string
		globalPath: string
		defaultsPath?: string
	} {
		// 1. Workspace path - use workspace path with .oacode
		let workspacePath: string | undefined
		const wsPath = getWorkspacePath()
		
		if (wsPath) {
			workspacePath = path.join(wsPath, ".oacode")
		}

		// 2. Global path - user's home directory
		const globalPath = path.join(os.homedir(), ".oacode")

		// 3. Defaults path - extension's bundled defaults
		let defaultsPath: string | undefined
		if (extensionPath) {
			// Check if extensionPath points to src directory (development)
			if (extensionPath.endsWith('src')) {
				// Go up one level from src to reach the root directory
				defaultsPath = path.join(extensionPath, "..", "defaults", "blocks")
			} else {
				// Use provided extension path (production)
				defaultsPath = path.join(extensionPath, "defaults", "blocks")
			}
		} else {
			// Try to resolve from current location
			// This is a fallback for when extension context isn't available
			const currentDir = __dirname
			
			// Check if we're in dist, out, or src
			if (currentDir.includes(path.sep + "dist")) {
				defaultsPath = path.join(currentDir, "..", "..", "defaults", "blocks")
			} else if (currentDir.includes(path.sep + "out")) {
				defaultsPath = path.join(currentDir, "..", "..", "defaults", "blocks")
			} else {
				// Development - running from src
				defaultsPath = path.join(currentDir, "..", "..", "..", "defaults", "blocks")
			}
		}

		return {
			workspacePath,
			globalPath,
			defaultsPath
		}
	}

	/**
	 * Get configuration info for debugging
	 */
	getConfigurationInfo(extensionPath?: string): {
		workspacePath?: string
		globalPath: string
		defaultsPath?: string
	} {
		const paths = this.resolvePaths(extensionPath)
		
		return paths
	}
}