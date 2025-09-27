/**
 * PromptsPopover
 *
 * This component now displays YAML prompt blocks from the extension backend
 * instead of mock data. It maintains the same interface as before to ensure
 * compatibility with existing toolbar integration.
 *
 * NEW Features:
 * - Displays real YAML prompts from defaults/blocks/prompts/
 * - Default/Custom tabs for source-based categorization
 * - Category grouping within each tab (analysis, visualization, etc.)
 * - Integration with PromptBlocksContext for state management
 * - Active prompt indicators
 * - Loading and empty states
 *
 * PRESERVED Features:
 * - Same PromptsPopover interface for toolbar compatibility
 * - Search functionality across prompts
 * - Responsive design and accessibility
 */

import React, { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Search, X, MessageSquare, Loader2, FolderOpen, Plus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"

// NEW: Import YAML prompt block types and context
import { PromptBlockInfo } from "@/utils/prompt-blocks"
import { usePromptBlocks } from "@/context/PromptBlocksContext"
import { PromptBlockCard } from "./PromptBlockCard"
import { vscode } from "@/utils/vscode"

// Import CreatePromptPopover component
import CreatePromptPopover from "./CreatePromptPopover"

/**
 * Props for the PromptsPopover component
 *
 * Changed from mock PromptTemplateType to real PromptBlockInfo
 */
interface PromptsPopoverProps {
	onPromptSelect?: (prompt: PromptBlockInfo) => void // Now uses PromptBlockInfo
	className?: string
}

/**
 * Available YAML prompt categories from domain model
 * These match the categories in PromptCategory.ts: analysis, visualization, reporting, methodology
 */
const YAML_PROMPT_CATEGORIES = ["analysis", "visualization", "reporting", "methodology"] as const
type YamlPromptCategory = (typeof YAML_PROMPT_CATEGORIES)[number]

/**
 * Main PromptsPopover component
 */
export const PromptsPopover: React.FC<PromptsPopoverProps> = ({ onPromptSelect, className }) => {
	// ============================
	// State Management
	// ============================

	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [activeTab, setActiveTab] = useState<"default" | "custom">("default")
	const [isLoading, setIsLoading] = useState(false)
	
	// State for Create Prompt popover functionality
	const [showCreatePromptPopover, setShowCreatePromptPopover] = useState(false)
	
	// Focus retention for VSCode operations (similar to rules implementation)
	const [preventClose, setPreventClose] = useState(false)

	// Access enhanced YAML prompt blocks from context
	const {
		availableBlocks,
		activeBlocks,
		defaultBlocks,
		customBlocks,
		loadingBlocks: contextLoading,
		refreshAvailableBlocks,
	} = usePromptBlocks()

	// Refresh data when popover opens - use direct message like rules do
	React.useEffect(() => {
		if (open) {
			// Direct message posting (like rules) to avoid context state resets
			vscode.postMessage({ type: "loadPromptBlocks" })
		}
	}, [open])

	// ============================
	// Computed Values
	// ============================

	// Use categorized blocks directly from context (no need for useMemo)
	// The context now provides defaultBlocks and customBlocks directly

	/**
	 * Get current tab blocks based on active tab
	 */
	const currentTabBlocks = useMemo(() => {
		return activeTab === "default" ? defaultBlocks : customBlocks
	}, [activeTab, defaultBlocks, customBlocks])

	/**
	 * Filter prompts based on search and category
	 */
	const filteredBlocks = useMemo(() => {
		let blocks = currentTabBlocks

		// Apply search filter
		if (searchValue) {
			blocks = blocks.filter(
				(block) =>
					block.name.toLowerCase().includes(searchValue.toLowerCase()) ||
					block.description?.toLowerCase().includes(searchValue.toLowerCase()) ||
					block.category.toLowerCase().includes(searchValue.toLowerCase()),
			)
		}

		return blocks
	}, [currentTabBlocks, searchValue])

	/**
	 * Group blocks by category for organized display
	 */
	const blocksByCategory = useMemo(() => {
		const grouped: Record<YamlPromptCategory, PromptBlockInfo[]> = {} as any

		YAML_PROMPT_CATEGORIES.forEach((category) => {
			grouped[category] = filteredBlocks.filter((block) => block.category === category)
		})

		return grouped
	}, [filteredBlocks])

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle prompt block selection - integrates with activation service
	 */
	const handleBlockSelect = async (block: PromptBlockInfo) => {
		try {
			setIsLoading(true)
			onPromptSelect?.(block)
			setOpen(false)
		} catch (error) {
			console.error("Failed to select prompt block:", error)
			// Still close the popover even if tracking fails
			onPromptSelect?.(block)
			setOpen(false)
		} finally {
			setIsLoading(false)
		}
	}

	/**
	 * Handle popover close
	 */
	const handleClose = () => {
		if (preventClose) return // Prevent closing during VSCode operations
		setOpen(false)
	}

	/**
	 * Clear search input
	 */
	const handleClearSearch = () => {
		setSearchValue("")
	}

	/**
	 * Handle create prompt button click - opens creation popover
	 */
	const handleCreatePromptClick = () => {
		setShowCreatePromptPopover(true)
		// Note: onCreatePrompt callback will be added in future phases when backend is ready
	}

	/**
	 * Handle CreatePromptPopover close - prevent parent from closing
	 */
	const handleCreatePromptPopoverChange = (newOpen: boolean) => {
		setPreventClose(true) // Prevent parent from closing
		setShowCreatePromptPopover(newOpen)
		// Allow parent to close after a brief delay
		setTimeout(() => setPreventClose(false), 100)
	}

	/**
	 * Handle edit operation start for custom prompts
	 * Manages UI state during edit operations
	 */
	const handleEditStart = () => {
		setPreventClose(true) // Prevent popover from closing during edit
		console.log('[PromptsPopover] Edit operation started')
		// Allow popover to close after VSCode operation completes
		setTimeout(() => setPreventClose(false), 2000)
	}

	/**
	 * Handle delete operation start for custom prompts
	 * Manages UI state during delete operations
	 */
	const handleDeleteStart = () => {
		setPreventClose(true) // Prevent popover from closing during delete
		console.log('[PromptsPopover] Delete operation started')
		// Allow popover to close after operation completes
		setTimeout(() => setPreventClose(false), 2000)
	}

	// ============================
	// Render Helpers
	// ============================

	/**
	 * Render blocks grouped by category
	 */
	const renderBlocksByCategory = () => {
		if (contextLoading || isLoading) {
			return (
				<div className="flex items-center justify-center py-8">
					<Loader2 className="w-6 h-6 animate-spin text-vscode-descriptionForeground" />
					<span className="ml-2 text-sm text-vscode-descriptionForeground">Loading prompts...</span>
				</div>
			)
		}

		if (filteredBlocks.length === 0) {
			return (
				<div className="text-center py-8 text-vscode-descriptionForeground">
					<FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
					<div className="text-sm">
						{searchValue ? "No prompts match your filters" : `No ${activeTab} prompts available`}
					</div>
					<div className="text-xs mt-1">
						{searchValue
							? "Try adjusting your search or category filter"
							: activeTab === "custom"
								? "Create custom prompts to see them here"
								: "Default prompts will appear here when available"}
					</div>
				</div>
			)
		}

		return (
			<div className="space-y-4">
				{YAML_PROMPT_CATEGORIES.map((category) => {
					const categoryBlocks = blocksByCategory[category]
					if (categoryBlocks.length === 0) return null

					return (
						<div key={category}>
							{/* Category Blocks */}
							<div className="space-y-2">
								{categoryBlocks.map((block) => (
									<PromptBlockCard
										key={block.name}
										promptBlock={block}
										onSelect={handleBlockSelect}
										onEditStart={handleEditStart}
										onDeleteStart={handleDeleteStart}
										compact={false}
									/>
								))}
							</div>
						</div>
					)
				})}
			</div>
		)
	}

	// ============================
	// Render
	// ============================

	return (
		<Popover
			open={open}
			onOpenChange={(newOpen) => {
				if (!newOpen && preventClose) return // Prevent closing during operations
				setOpen(newOpen)
			}}>
			<PopoverTrigger asChild>
				<button
					className={cn(
						"flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ease-in-out",
						"border border-transparent",
						open
							? [
									"bg-vscode-button-background",
									"text-vscode-button-foreground",
									"border-vscode-button-border",
									"shadow-sm",
								]
							: [
									"bg-transparent",
									"text-vscode-foreground",
									"opacity-60 hover:opacity-100",
									"hover:bg-vscode-toolbar-hoverBackground",
									"hover:border-vscode-contrastBorder",
								],
					)}
					title="Prompts - Quick access to prompt templates"
					aria-label="Prompts - Quick access to prompt templates">
					<MessageSquare className="w-4 h-4" />
				</button>
			</PopoverTrigger>

			<PopoverContent
				align="start"
				className={cn(
					"w-95 max-w-[90vw] max-h-[70vh] p-0",
					"bg-vscode-dropdown-background",
					"border border-vscode-dropdown-border",
					"shadow-lg",
					"flex flex-col",
					className,
				)}
				onEscapeKeyDown={handleClose}>
				{/* Header */}
				<div className="px-4 pt-2 border-b border-vscode-dropdown-border">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-sm text-vscode-foreground">Prompt Blocks</h3>
						<button
							onClick={handleClose}
							className="text-vscode-descriptionForeground hover:text-vscode-foreground">
							<X className="w-4 h-4" />
						</button>
					</div>
					<p className="text-xs text-vscode-descriptionForeground mt-1">
						Custom instructions to guide AI responses for specific tasks
					</p>
				</div>

				{/* Search and Filters */}
				<div className="px-4 py-3 border-b border-vscode-dropdown-border space-y-3">
					{/* Search Input */}
					<div className="relative">
						<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-vscode-descriptionForeground" />
						<Input
							placeholder="Search prompts..."
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							className="pl-8 h-8 text-sm"
						/>
						{searchValue && (
							<button
								onClick={handleClearSearch}
								className="absolute right-2 top-1/2 transform -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-foreground">
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>

				{/* Tabs - Default vs Custom */}
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as any)}
					className="flex-1 flex flex-col min-h-0">
					<TabsList className="flex mx-3 mt-3 mb-2">
						<TabsTrigger value="default" className="flex-1">
							<FolderOpen className="w-3 h-3 mr-1 flex-shrink-0" />
							<span className="truncate">Default ({defaultBlocks.length})</span>
						</TabsTrigger>
						<TabsTrigger value="custom" className="flex-1">
							<FolderOpen className="w-3 h-3 mr-1 flex-shrink-0" />
							<span className="truncate">Custom ({customBlocks.length})</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab Content */}
					<div className="flex-1 overflow-y-auto px-4 pb-4">
						<TabsContent value="default" className="mt-3">
							{renderBlocksByCategory()}
						</TabsContent>

						<TabsContent value="custom" className="mt-3">
							{renderBlocksByCategory()}
						</TabsContent>
					</div>
				</Tabs>

				{/* Footer */}
				<div className="px-4 py-3 border-t border-vscode-dropdown-border mt-2">
					{/* Phase 1.3: Action Buttons - Integrated Create Prompt functionality */}
					<div className="flex items-center gap-2 mb-2">
						<CreatePromptPopover
							open={showCreatePromptPopover}
							onOpenChange={handleCreatePromptPopoverChange}
							trigger={
								<Button
									variant="secondary"
									size="sm"
									onClick={handleCreatePromptClick}
									className="flex-1 h-7 text-xs bg-vscode-editor-background hover:bg-vscode-editor-background/80"
									title="Create a new custom prompt template"
									aria-label="Create a new custom prompt template">
									<Plus className="w-3 h-3 mr-1" />
									Create Prompt
								</Button>
							}
						/>
					</div>

					{/* Statistics */}
					<div className="flex items-center justify-end text-xs text-vscode-descriptionForeground">
						<span>{activeBlocks.length} active</span>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
