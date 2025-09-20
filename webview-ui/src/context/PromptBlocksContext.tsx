import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { PromptBlockInfo, ActivePromptBlockInfo, loadAvailablePromptBlocks, getActivePromptBlocks } from "@/utils/prompt-blocks"

interface PromptBlocksContextType {
	// Available prompt blocks
	availableBlocks: PromptBlockInfo[]
	loadingBlocks: boolean
	
	// Active prompt blocks for current conversation
	activeBlocks: ActivePromptBlockInfo[]
	
	// Actions
	refreshAvailableBlocks: () => Promise<void>
	addActiveBlock: (blockName: string, variables?: Record<string, string>) => void
	removeActiveBlock: (blockName: string) => void
	clearActiveBlocks: () => void
	refreshActiveBlocks: () => Promise<void>
}

const PromptBlocksContext = createContext<PromptBlocksContextType | undefined>(undefined)

interface PromptBlocksProviderProps {
	children: ReactNode
}

export const PromptBlocksProvider: React.FC<PromptBlocksProviderProps> = ({ children }) => {
	const [availableBlocks, setAvailableBlocks] = useState<PromptBlockInfo[]>([])
	const [loadingBlocks, setLoadingBlocks] = useState(false)
	const [activeBlocks, setActiveBlocks] = useState<ActivePromptBlockInfo[]>([])

	// Load available blocks on mount
	useEffect(() => {
		if (__DEV__) {
			console.log("[PromptBlocksContext] Initializing - requesting blocks from extension")
		}
		refreshAvailableBlocks()
		refreshActiveBlocks()
	}, [])

	// Listen for prompt block updates from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			
			switch (message.type) {
				case "promptBlocksLoaded":
				case "promptBlocksUpdated":
					if (__DEV__) {
						console.log("[PromptBlocksContext] Received blocks from extension:", message.blocks?.length || 0, "blocks")
					}
					setAvailableBlocks(message.blocks || [])
					break
					
				case "activePromptBlocksUpdated":
					setActiveBlocks(message.activeBlocks || [])
					break
					
				case "promptBlockAdded":
					// Refresh active blocks when one is added
					refreshActiveBlocks()
					break
					
				case "promptBlockRemoved":
					// Refresh active blocks when one is removed
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

	const addActiveBlock = (blockName: string, variables?: Record<string, string>) => {
		// Find the block in available blocks
		const block = availableBlocks.find(b => b.name === blockName)
		if (!block) {
			console.warn(`Prompt block not found: ${blockName}`)
			return
		}

		// Check if block is already active in same category
		const existingInCategory = activeBlocks.find(ab => ab.block.category === block.category)
		if (existingInCategory) {
			// Replace existing block in same category
			setActiveBlocks(prev => prev.map(ab => 
				ab.block.category === block.category 
					? { block, variables, priority: block.priority }
					: ab
			))
		} else {
			// Add new block
			setActiveBlocks(prev => [...prev, { block, variables, priority: block.priority }])
		}

		// Notify extension
		import("@/utils/prompt-blocks").then(({ addActivePromptBlock }) => {
			addActivePromptBlock(blockName, variables)
		})
	}

	const removeActiveBlock = (blockName: string) => {
		setActiveBlocks(prev => prev.filter(ab => ab.block.name !== blockName))
		
		// Notify extension
		import("@/utils/prompt-blocks").then(({ removeActivePromptBlock }) => {
			removeActivePromptBlock(blockName)
		})
	}

	const clearActiveBlocks = () => {
		// Remove all active blocks
		const currentBlocks = [...activeBlocks]
		setActiveBlocks([])
		
		// Notify extension for each block
		import("@/utils/prompt-blocks").then(({ removeActivePromptBlock }) => {
			currentBlocks.forEach(ab => removeActivePromptBlock(ab.block.name))
		})
	}

	const value: PromptBlocksContextType = {
		availableBlocks,
		loadingBlocks,
		activeBlocks,
		refreshAvailableBlocks,
		addActiveBlock,
		removeActiveBlock,
		clearActiveBlocks,
		refreshActiveBlocks,
	}

	return (
		<PromptBlocksContext.Provider value={value}>
			{children}
		</PromptBlocksContext.Provider>
	)
}

export const usePromptBlocks = (): PromptBlocksContextType => {
	const context = useContext(PromptBlocksContext)
	if (context === undefined) {
		throw new Error("usePromptBlocks must be used within a PromptBlocksProvider")
	}
	return context
}