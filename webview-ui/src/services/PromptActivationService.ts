/**
 * Unified Prompt Activation Service
 *
 * PHASE 4.2 ENHANCEMENT: Enhanced category conflict resolution
 *
 * This service extracts the shared prompt activation logic used by:
 * 1. Slash commands (/chart-visualization)
 * 2. Toolbar prompt selection (implemented in Phase 3)
 *
 * Key responsibilities:
 * - Validate prompt blocks exist
 * - Handle category conflict resolution (only one prompt per category)
 * - Send messages to extension backend
 * - Update local UI state
 * - Provide detailed conflict information for UI feedback
 *
 * Created during Phase 1: Foundation & Analysis
 * Enhanced during Phase 4.2: Category Conflict Resolution
 */

import { PromptBlockInfo, ActivePromptBlockInfo } from "@/utils/prompt-blocks"
import { vscode } from "@/utils/vscode"

// PHASE 4.2 NEW: Enhanced conflict resolution types
export interface CategoryConflictInfo {
	/** The category where conflict occurs */
	category: string
	/** Currently active block in this category */
	existingBlock: ActivePromptBlockInfo
	/** Block being activated that causes conflict */
	incomingBlock: PromptBlockInfo
	/** Resolution strategy used */
	resolution: "replace" | "skip"
}

export interface ActivationResult {
	/** Whether activation was successful */
	success: boolean
	/** The activated block (if successful) */
	activatedBlock?: ActivePromptBlockInfo
	/** Information about category conflicts that occurred */
	categoryConflict?: CategoryConflictInfo
	/** Error message (if failed) */
	error?: string
}

export interface PromptActivationService {
	/**
	 * PHASE 4.2 ENHANCED: Activate a prompt block by name with detailed conflict resolution
	 *
	 * This is the core shared logic that both slash commands and toolbar use
	 */
	activatePromptBlock: (
		blockName: string,
		availableBlocks: PromptBlockInfo[],
		activeBlocks: ActivePromptBlockInfo[],
		setActiveBlocks: React.Dispatch<React.SetStateAction<ActivePromptBlockInfo[]>>,
		variables?: Record<string, string>,
	) => ActivationResult

	/**
	 * Deactivate a prompt block by name
	 */
	deactivatePromptBlock: (
		blockName: string,
		setActiveBlocks: React.Dispatch<React.SetStateAction<ActivePromptBlockInfo[]>>,
	) => void

	/**
	 * Check if a prompt block is currently active
	 */
	isPromptActive: (blockName: string, activeBlocks: ActivePromptBlockInfo[]) => boolean

	/**
	 * Get active blocks for a specific category
	 */
	getActiveBlockByCategory: (
		category: string,
		activeBlocks: ActivePromptBlockInfo[],
	) => ActivePromptBlockInfo | undefined

	// PHASE 4.2 NEW: Enhanced conflict resolution methods

	/**
	 * Check if activating a block would cause a category conflict
	 */
	checkCategoryConflict: (
		blockName: string,
		availableBlocks: PromptBlockInfo[],
		activeBlocks: ActivePromptBlockInfo[],
	) => CategoryConflictInfo | null

	/**
	 * Get all available categories from prompt blocks
	 */
	getAvailableCategories: (availableBlocks: PromptBlockInfo[]) => string[]

	/**
	 * Get blocks grouped by category
	 */
	getBlocksByCategory: (blocks: PromptBlockInfo[]) => Record<string, PromptBlockInfo[]>
}

/**
 * Implementation of the unified prompt activation service
 */
export const createPromptActivationService = (): PromptActivationService => {
	const activatePromptBlock = (
		blockName: string,
		availableBlocks: PromptBlockInfo[],
		activeBlocks: ActivePromptBlockInfo[],
		setActiveBlocks: React.Dispatch<React.SetStateAction<ActivePromptBlockInfo[]>>,
		variables?: Record<string, string>,
	): ActivationResult => {
		// STEP 1: Find the block in available blocks
		const block = availableBlocks.find((b) => b.name === blockName)
		if (!block) {
			const errorMsg = `[PromptActivationService] Prompt block not found: ${blockName}`
			console.warn(errorMsg)
			return {
				success: false,
				error: `Prompt block '${blockName}' not found`,
			}
		}

		// STEP 2: PHASE 4.2 ENHANCED: Category conflict resolution with detailed tracking
		const existingInCategory = activeBlocks.find((ab) => ab.block.category === block.category)
		const newActiveBlock: ActivePromptBlockInfo = { block, variables, priority: block.priority }

		let categoryConflict: CategoryConflictInfo | undefined = undefined

		if (existingInCategory) {
			// CONFLICT DETECTED: Replace existing block in same category (maintain category constraint)
			console.log(
				`[PromptActivationService] CATEGORY CONFLICT: Replacing ${existingInCategory.block.name} with ${blockName} in category ${block.category}`,
			)

			categoryConflict = {
				category: block.category,
				existingBlock: existingInCategory,
				incomingBlock: block,
				resolution: "replace",
			}

			setActiveBlocks((prev) => prev.map((ab) => (ab.block.category === block.category ? newActiveBlock : ab)))
		} else {
			// No conflict: Add new block
			console.log(`[PromptActivationService] Adding new block ${blockName} in category ${block.category}`)
			setActiveBlocks((prev) => [...prev, newActiveBlock])
		}

		// STEP 3: Notify extension backend to enhance system prompt
		try {
			vscode.postMessage({
				type: "addActivePromptBlock",
				blockName,
				variables,
			})
		} catch (error) {
			console.error(`[PromptActivationService] Failed to notify extension:`, error)
			return {
				success: false,
				error: "Failed to communicate with extension backend",
			}
		}

		// STEP 4: Return detailed activation result
		return {
			success: true,
			activatedBlock: newActiveBlock,
			categoryConflict,
		}
	}

	const deactivatePromptBlock = (
		blockName: string,
		setActiveBlocks: React.Dispatch<React.SetStateAction<ActivePromptBlockInfo[]>>,
	) => {
		console.log(`[PromptActivationService] Deactivating block ${blockName}`)
		setActiveBlocks((prev) => prev.filter((ab) => ab.block.name !== blockName))

		// Notify extension
		vscode.postMessage({
			type: "removeActivePromptBlock",
			blockName,
		})
	}

	const isPromptActive = (blockName: string, activeBlocks: ActivePromptBlockInfo[]): boolean => {
		return activeBlocks.some((ab) => ab.block.name === blockName)
	}

	const getActiveBlockByCategory = (
		category: string,
		activeBlocks: ActivePromptBlockInfo[],
	): ActivePromptBlockInfo | undefined => {
		return activeBlocks.find((ab) => ab.block.category === category)
	}

	// PHASE 4.2 NEW: Enhanced conflict resolution methods implementation

	/**
	 * Check if activating a block would cause a category conflict
	 */
	const checkCategoryConflict = (
		blockName: string,
		availableBlocks: PromptBlockInfo[],
		activeBlocks: ActivePromptBlockInfo[],
	): CategoryConflictInfo | null => {
		const block = availableBlocks.find((b) => b.name === blockName)
		if (!block) {
			return null // Block doesn't exist, no conflict to check
		}

		const existingInCategory = activeBlocks.find((ab) => ab.block.category === block.category)
		if (!existingInCategory) {
			return null // No existing block in category, no conflict
		}

		// Conflict detected
		return {
			category: block.category,
			existingBlock: existingInCategory,
			incomingBlock: block,
			resolution: "replace", // Our strategy is always to replace
		}
	}

	/**
	 * Get all available categories from prompt blocks
	 */
	const getAvailableCategories = (availableBlocks: PromptBlockInfo[]): string[] => {
		const categories = new Set(availableBlocks.map((block) => block.category))
		return Array.from(categories).sort()
	}

	/**
	 * Get blocks grouped by category
	 */
	const getBlocksByCategory = (blocks: PromptBlockInfo[]): Record<string, PromptBlockInfo[]> => {
		return blocks.reduce(
			(grouped, block) => {
				if (!grouped[block.category]) {
					grouped[block.category] = []
				}
				grouped[block.category].push(block)
				return grouped
			},
			{} as Record<string, PromptBlockInfo[]>,
		)
	}

	return {
		activatePromptBlock,
		deactivatePromptBlock,
		isPromptActive,
		getActiveBlockByCategory,
		// PHASE 4.2 NEW: Enhanced conflict resolution methods
		checkCategoryConflict,
		getAvailableCategories,
		getBlocksByCategory,
	}
}

/**
 * Shared instance of the prompt activation service
 */
export const promptActivationService = createPromptActivationService()
