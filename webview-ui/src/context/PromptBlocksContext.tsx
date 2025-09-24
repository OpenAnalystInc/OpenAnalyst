import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import {
	PromptBlockInfo,
	ActivePromptBlockInfo,
	loadAvailablePromptBlocks,
	getActivePromptBlocks,
} from "@/utils/prompt-blocks"
import { promptActivationService, CategoryConflictInfo } from "@/services/PromptActivationService"

/**
 * Context interface for managing prompt blocks in the application
 *
 * PHASE 4.1 ENHANCEMENT: Added toolbar-specific state management
 *
 * This context manages two types of prompt block data:
 * 1. Available blocks: All prompt blocks loaded from YAML files (defaults + custom)
 * 2. Active blocks: Currently selected blocks that enhance the system prompt
 *
 * Key behaviors:
 * - Only one block per category can be active at a time (category conflict resolution)
 * - Active blocks automatically enhance the AI's system prompt
 * - State is synchronized with the VS Code extension backend
 * - Both slash commands and toolbar use the same activation logic
 * - UI state persists across component re-renders and updates
 */
interface PromptBlocksContextType {
	// Available prompt blocks loaded from YAML files
	availableBlocks: PromptBlockInfo[]
	loadingBlocks: boolean

	// Active prompt blocks for current conversation (enhances system prompt)
	activeBlocks: ActivePromptBlockInfo[]

	// PHASE 4.1 NEW: Enhanced activation state tracking
	activationStates: Record<string, "idle" | "activating" | "deactivating">

	// PHASE 4.1 NEW: Categorized prompt blocks for UI organization
	defaultBlocks: PromptBlockInfo[] // From defaults/blocks/prompts/
	customBlocks: PromptBlockInfo[] // User-defined prompts

	// Actions for managing prompt block state
	refreshAvailableBlocks: () => Promise<void>
	addActiveBlock: (blockName: string, variables?: Record<string, string>) => Promise<void>
	removeActiveBlock: (blockName: string) => Promise<void>
	clearActiveBlocks: () => void
	refreshActiveBlocks: () => Promise<void>

	// PHASE 4.1 NEW: Enhanced toolbar support methods
	toggleActiveBlock: (blockName: string, variables?: Record<string, string>) => Promise<void>
	isBlockActive: (blockName: string) => boolean
	getActiveBlockByCategory: (category: string) => ActivePromptBlockInfo | undefined
	getActivationState: (blockName: string) => "idle" | "activating" | "deactivating"

	// PHASE 4.3 NEW: Additional activation/deactivation methods
	activateBlocksInCategory: (category: string, blockName: string, variables?: Record<string, string>) => Promise<void>
	deactivateCategory: (category: string) => Promise<void>
	replaceActiveBlock: (
		currentBlockName: string,
		newBlockName: string,
		variables?: Record<string, string>,
	) => Promise<void>
	getConflictInfo: (blockName: string) => CategoryConflictInfo | null
	canActivateBlock: (blockName: string) => boolean
}

const PromptBlocksContext = createContext<PromptBlocksContextType | undefined>(undefined)

interface PromptBlocksProviderProps {
	children: ReactNode
}

export const PromptBlocksProvider: React.FC<PromptBlocksProviderProps> = ({ children }) => {
	const [availableBlocks, setAvailableBlocks] = useState<PromptBlockInfo[]>([])
	const [loadingBlocks, setLoadingBlocks] = useState(false)
	const [activeBlocks, setActiveBlocks] = useState<ActivePromptBlockInfo[]>([])

	// PHASE 4.1 NEW: Enhanced state management for toolbar integration
	const [activationStates, setActivationStates] = useState<Record<string, "idle" | "activating" | "deactivating">>({})
	const [defaultBlocks, setDefaultBlocks] = useState<PromptBlockInfo[]>([])
	const [customBlocks, setCustomBlocks] = useState<PromptBlockInfo[]>([])

	// PHASE 4.1 ENHANCED: Clean up activation states when blocks change
	// NOTE: Categorization is now handled by backend-provided defaultBlocks/customBlocks
	useEffect(() => {
		// PHASE 4.5 NEW: Clean up activation states for blocks that no longer exist
		setActivationStates((prev) => {
			const existingBlockNames = new Set(availableBlocks.map((b) => b.name))
			const cleanedStates: typeof prev = {}

			Object.entries(prev).forEach(([blockName, state]) => {
				if (existingBlockNames.has(blockName)) {
					cleanedStates[blockName] = state
				}
			})

			return cleanedStates
		})
	}, [availableBlocks])

	// Load available blocks on mount
	useEffect(() => {
		if (__DEV__) {
			console.log("[PromptBlocksContext] Initializing - requesting blocks from extension")
		}
		refreshAvailableBlocks()
		refreshActiveBlocks()
	}, [])

	// PHASE 4.5 NEW: Cleanup activation states for blocks that are no longer active
	useEffect(() => {
		const activeBlockNames = new Set(activeBlocks.map((ab) => ab.block.name))

		setActivationStates((prev) => {
			const cleanedStates: typeof prev = {}
			let hasChanges = false

			Object.entries(prev).forEach(([blockName, state]) => {
				// If block is active, keep its state as 'idle' unless it's currently processing
				if (activeBlockNames.has(blockName)) {
					cleanedStates[blockName] = state === "deactivating" ? "idle" : state
				} else {
					// If block is not active, keep state as 'idle' unless it's currently processing
					cleanedStates[blockName] = state === "activating" ? "idle" : state
				}

				if (cleanedStates[blockName] !== prev[blockName]) {
					hasChanges = true
				}
			})

			return hasChanges ? cleanedStates : prev
		})
	}, [activeBlocks])

	// PHASE 4.1 ENHANCED: Listen for prompt block updates from extension with activation state tracking
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			switch (message.type) {
				case "promptBlocksLoaded":
				case "promptBlocksUpdated":
					if (__DEV__) {
						console.log(
							"[PromptBlocksContext] Received blocks from extension:",
							message.blocks?.length || 0,
							"blocks",
						)
						console.log("[PromptBlocksContext] Default blocks:", message.defaultBlocks?.length || 0)
						console.log("[PromptBlocksContext] Custom blocks:", message.customBlocks?.length || 0)
					}
					setAvailableBlocks(message.blocks || [])

					// NEW: Use backend-provided categorization instead of manual categorization
					setDefaultBlocks(message.defaultBlocks || [])
					setCustomBlocks(message.customBlocks || [])

					// PHASE 4.1 NEW: Reset activation states when blocks are reloaded
					setActivationStates({})
					break

				case "activePromptBlocksUpdated":
					if (__DEV__) {
						console.log(
							"[PromptBlocksContext] Active blocks updated:",
							message.activeBlocks?.length || 0,
							"active",
						)
					}
					setActiveBlocks(message.activeBlocks || [])

					// PHASE 4.1 NEW: Clear activation states for blocks that are now active/inactive
					const updatedActiveBlocks = message.activeBlocks || []
					setActivationStates((prev) => {
						const newStates = { ...prev }
						// Clear states for blocks that finished activation/deactivation
						Object.keys(newStates).forEach((blockName) => {
							if (
								newStates[blockName] === "activating" &&
								updatedActiveBlocks.some((ab: ActivePromptBlockInfo) => ab.block.name === blockName)
							) {
								newStates[blockName] = "idle"
							} else if (
								newStates[blockName] === "deactivating" &&
								!updatedActiveBlocks.some((ab: ActivePromptBlockInfo) => ab.block.name === blockName)
							) {
								newStates[blockName] = "idle"
							}
						})
						return newStates
					})
					break

				case "promptBlockAdded":
					// PHASE 4.1 NEW: Update activation state and refresh
					if (message.blockName) {
						setActivationStates((prev) => ({ ...prev, [message.blockName]: "idle" }))
					}
					refreshActiveBlocks()
					break

				case "promptBlockRemoved":
					// PHASE 4.1 NEW: Update activation state and refresh
					if (message.blockName) {
						setActivationStates((prev) => ({ ...prev, [message.blockName]: "idle" }))
					}
					refreshActiveBlocks()
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const refreshAvailableBlocks = async () => {
		setLoadingBlocks(true)
		try {
			const blocks = await loadAvailablePromptBlocks()
			setAvailableBlocks(blocks)
		} catch (error) {
			console.error("Failed to load prompt blocks:", error)
			setAvailableBlocks([])
		} finally {
			setLoadingBlocks(false)
		}
	}

	const refreshActiveBlocks = async () => {
		try {
			const active = await getActivePromptBlocks()
			setActiveBlocks(active)
		} catch (error) {
			console.error("Failed to load active prompt blocks:", error)
			setActiveBlocks([])
		}
	}

	/**
	 * PHASE 4.1 ENHANCED: Add a prompt block to active state with activation tracking
	 *
	 * This delegates to the shared PromptActivationService which contains
	 * the unified logic used by both slash commands and toolbar.
	 *
	 * IMPORTANT: This maintains 100% backward compatibility with slash commands
	 * Flow: UI → Context → PromptActivationService → Extension → System Prompt Enhancement
	 */
	const addActiveBlock = async (blockName: string, variables?: Record<string, string>) => {
		// PHASE 4.1 NEW: Set activation state to indicate loading
		setActivationStates((prev) => ({ ...prev, [blockName]: "activating" }))

		try {
			// PHASE 4.2 ENHANCED: Use the shared activation service with enhanced conflict resolution
			const result = promptActivationService.activatePromptBlock(
				blockName,
				availableBlocks,
				activeBlocks,
				setActiveBlocks,
				variables,
			)

			// Handle activation result
			if (!result.success) {
				console.error(`[PromptBlocksContext] Failed to activate block ${blockName}:`, result.error)
				setActivationStates((prev) => ({ ...prev, [blockName]: "idle" }))
				throw new Error(result.error || "Unknown activation error")
			}

			// PHASE 4.2 NEW: Log category conflict information for debugging
			if (result.categoryConflict) {
				console.log(`[PromptBlocksContext] Category conflict resolved:`, {
					category: result.categoryConflict.category,
					replaced: result.categoryConflict.existingBlock.block.name,
					with: result.categoryConflict.incomingBlock.name,
					resolution: result.categoryConflict.resolution,
				})
			}
		} catch (error) {
			// PHASE 4.1 NEW: Reset activation state on error
			console.error(`[PromptBlocksContext] Failed to activate block ${blockName}:`, error)
			setActivationStates((prev) => ({ ...prev, [blockName]: "idle" }))
			throw error
		}
	}

	/**
	 * PHASE 4.1 ENHANCED: Remove a prompt block from active state with deactivation tracking
	 */
	const removeActiveBlock = async (blockName: string) => {
		// PHASE 4.1 NEW: Set deactivation state to indicate loading
		setActivationStates((prev) => ({ ...prev, [blockName]: "deactivating" }))

		try {
			// Use the shared service for consistent behavior
			promptActivationService.deactivatePromptBlock(blockName, setActiveBlocks)
		} catch (error) {
			// PHASE 4.1 NEW: Reset activation state on error
			console.error(`[PromptBlocksContext] Failed to deactivate block ${blockName}:`, error)
			setActivationStates((prev) => ({ ...prev, [blockName]: "idle" }))
			throw error
		}
	}

	const clearActiveBlocks = () => {
		// Remove all active blocks
		const currentBlocks = [...activeBlocks]
		setActiveBlocks([])

		// PHASE 4.1 NEW: Set all blocks to deactivating state
		const deactivatingStates: Record<string, "deactivating"> = {}
		currentBlocks.forEach((ab) => {
			deactivatingStates[ab.block.name] = "deactivating"
		})
		setActivationStates((prev) => ({ ...prev, ...deactivatingStates }))

		// Notify extension for each block
		import("@/utils/prompt-blocks").then(({ removeActivePromptBlock }) => {
			currentBlocks.forEach((ab) => removeActivePromptBlock(ab.block.name))
		})
	}

	// PHASE 4.1 NEW: Enhanced toolbar support methods

	/**
	 * Toggle a prompt block between active and inactive states
	 */
	const toggleActiveBlock = async (blockName: string, variables?: Record<string, string>) => {
		const isCurrentlyActive = activeBlocks.some((ab) => ab.block.name === blockName)

		if (isCurrentlyActive) {
			await removeActiveBlock(blockName)
		} else {
			await addActiveBlock(blockName, variables)
		}
	}

	/**
	 * Check if a prompt block is currently active
	 */
	const isBlockActive = (blockName: string): boolean => {
		return activeBlocks.some((ab) => ab.block.name === blockName)
	}

	/**
	 * Get the active block for a specific category (category conflict resolution)
	 */
	const getActiveBlockByCategory = (category: string): ActivePromptBlockInfo | undefined => {
		return activeBlocks.find((ab) => ab.block.category === category)
	}

	/**
	 * Get the current activation state of a block (for UI loading indicators)
	 */
	const getActivationState = (blockName: string): "idle" | "activating" | "deactivating" => {
		return activationStates[blockName] || "idle"
	}

	// PHASE 4.3 NEW: Additional activation/deactivation methods implementation

	/**
	 * Activate a specific block in a category (handles category conflicts automatically)
	 */
	const activateBlocksInCategory = async (
		category: string,
		blockName: string,
		variables?: Record<string, string>,
	) => {
		// Find blocks in the specified category
		const blocksInCategory = availableBlocks.filter((block) => block.category === category)
		const targetBlock = blocksInCategory.find((block) => block.name === blockName)

		if (!targetBlock) {
			throw new Error(`Block '${blockName}' not found in category '${category}'`)
		}

		// Use the standard activation method (handles conflicts automatically)
		await addActiveBlock(blockName, variables)
	}

	/**
	 * Deactivate all active blocks in a specific category
	 */
	const deactivateCategory = async (category: string) => {
		const activeInCategory = activeBlocks.filter((ab) => ab.block.category === category)

		// Deactivate all blocks in the category
		const deactivationPromises = activeInCategory.map((ab) => removeActiveBlock(ab.block.name))
		await Promise.all(deactivationPromises)
	}

	/**
	 * Replace one active block with another (atomic operation)
	 */
	const replaceActiveBlock = async (
		currentBlockName: string,
		newBlockName: string,
		variables?: Record<string, string>,
	) => {
		// Check if current block is actually active
		if (!isBlockActive(currentBlockName)) {
			console.warn(`[PromptBlocksContext] Cannot replace ${currentBlockName} - not currently active`)
			// Just activate the new block
			await addActiveBlock(newBlockName, variables)
			return
		}

		// Check if new block exists
		const newBlock = availableBlocks.find((b) => b.name === newBlockName)
		if (!newBlock) {
			throw new Error(`Cannot replace with '${newBlockName}' - block not found`)
		}

		const currentBlock = activeBlocks.find((ab) => ab.block.name === currentBlockName)
		if (!currentBlock) {
			throw new Error(`Current block '${currentBlockName}' not found in active blocks`)
		}

		// If blocks are in same category, activation will automatically replace
		if (currentBlock.block.category === newBlock.category) {
			await addActiveBlock(newBlockName, variables)
		} else {
			// Different categories - deactivate current, then activate new
			await removeActiveBlock(currentBlockName)
			await addActiveBlock(newBlockName, variables)
		}
	}

	/**
	 * Get conflict information for a block without activating it
	 */
	const getConflictInfo = (blockName: string) => {
		return promptActivationService.checkCategoryConflict(blockName, availableBlocks, activeBlocks)
	}

	/**
	 * Check if a block can be activated (exists and not already active)
	 */
	const canActivateBlock = (blockName: string): boolean => {
		// Block must exist in available blocks
		const blockExists = availableBlocks.some((b) => b.name === blockName)
		if (!blockExists) return false

		// Block must not already be active
		const isAlreadyActive = isBlockActive(blockName)
		if (isAlreadyActive) return false

		// Block must not be in the middle of activation/deactivation
		const state = getActivationState(blockName)
		if (state !== "idle") return false

		return true
	}

	const value: PromptBlocksContextType = {
		availableBlocks,
		loadingBlocks,
		activeBlocks,

		// PHASE 4.1 NEW: Enhanced state properties
		activationStates,
		defaultBlocks,
		customBlocks,

		// Existing methods (enhanced)
		refreshAvailableBlocks,
		addActiveBlock,
		removeActiveBlock,
		clearActiveBlocks,
		refreshActiveBlocks,

		// PHASE 4.1 NEW: Enhanced toolbar support methods
		toggleActiveBlock,
		isBlockActive,
		getActiveBlockByCategory,
		getActivationState,

		// PHASE 4.3 NEW: Additional activation/deactivation methods
		activateBlocksInCategory,
		deactivateCategory,
		replaceActiveBlock,
		getConflictInfo,
		canActivateBlock,
	}

	return <PromptBlocksContext.Provider value={value}>{children}</PromptBlocksContext.Provider>
}

export const usePromptBlocks = (): PromptBlocksContextType => {
	const context = useContext(PromptBlocksContext)
	if (context === undefined) {
		throw new Error("usePromptBlocks must be used within a PromptBlocksProvider")
	}
	return context
}
