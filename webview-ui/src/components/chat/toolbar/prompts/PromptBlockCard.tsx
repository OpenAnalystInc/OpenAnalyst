/**
 * PromptBlockCard - Enhanced for Phase 2.2
 *
 * Displays individual YAML prompt blocks from the extension backend.
 * Enhanced to support edit/delete functionality for custom prompts.
 *
 * Features:
 * - Displays YAML prompt block information (name, category, description)
 * - Shows active state indicators when block is activated
 * - Integrates with PromptActivationService for block activation
 * - Supports category-based styling and icons
 * - Compact and expanded display modes
 * - Loading states for activation process
 * 
 * Phase 2.2 Enhancements:
 * - Edit/Delete buttons for custom prompts only (source !== "defaults")
 * - Global/Workspace source badges for custom prompts
 * - VSCode integration for edit functionality
 * - Confirmation dialogs for delete functionality
 */

import { cn } from "@/lib/utils"
import { 
	MessageSquare, 
	BarChart3, 
	FileText, 
	Settings, 
	CheckCircle2, 
	Loader2,
	Edit,
	Trash2,
	Building,
	Globe
} from "lucide-react"
import { PromptBlockInfo, isPromptBlockEditable, getSourceDisplayName } from "@/utils/prompt-blocks"
import { usePromptBlocks } from "@/context/PromptBlocksContext"
import { vscode } from "@/utils/vscode"

/**
 * Props for the PromptBlockCard component
 */
interface PromptBlockCardProps {
	/** The YAML prompt block to display */
	promptBlock: PromptBlockInfo
	/** Callback when block is selected/activated */
	onSelect?: (block: PromptBlockInfo) => void
	/** Callback when preview is requested */
	onPreview?: (block: PromptBlockInfo) => void
	/** Callback when favorite is toggled */
	onToggleFavorite?: (blockName: string, isFavorite: boolean) => void
	
	// Phase 2.2: New callbacks for edit/delete functionality
	/** Callback when edit operation starts (for parent component state management) */
	onEditStart?: () => void
	/** Callback when delete operation starts (for parent component state management) */
	onDeleteStart?: () => void
	
	/** Whether to show in compact mode */
	compact?: boolean
	/** Additional CSS classes */
	className?: string
}

/**
 * Get category-specific icon for prompt blocks
 */
const getCategoryIcon = (category: string) => {
	switch (category) {
		case "analysis":
			return BarChart3
		case "visualization":
			return BarChart3
		case "reporting":
			return FileText
		case "methodology":
			return Settings
		default:
			return MessageSquare
	}
}

/**
 * Get category-specific color classes
 */
const getCategoryColors = (category: string) => {
	switch (category) {
		case "analysis":
			return {
				bg: "bg-blue-500/10",
				border: "border-blue-500/30",
				text: "text-blue-400",
				icon: "text-blue-400",
			}
		case "visualization":
			return {
				bg: "bg-green-500/10",
				border: "border-green-500/30",
				text: "text-green-400",
				icon: "text-green-400",
			}
		case "reporting":
			return {
				bg: "bg-purple-500/10",
				border: "border-purple-500/30",
				text: "text-purple-400",
				icon: "text-purple-400",
			}
		case "methodology":
			return {
				bg: "bg-orange-500/10",
				border: "border-orange-500/30",
				text: "text-orange-400",
				icon: "text-orange-400",
			}
		default:
			return {
				bg: "bg-gray-500/10",
				border: "border-gray-500/30",
				text: "text-gray-400",
				icon: "text-gray-400",
			}
	}
}

/**
 * Main PromptBlockCard component
 */
export const PromptBlockCard: React.FC<PromptBlockCardProps> = ({
	promptBlock,
	onSelect,
	onEditStart,
	onDeleteStart,
	compact = false,
	className,
}) => {
	// ============================
	// State Management
	// ============================

	// Import all required methods for unified activation handler
	const {
		activeBlocks,
		availableBlocks,
		isBlockActive,
		getActivationState,
		toggleActiveBlock,
		getConflictInfo,
		addActiveBlock,
	} = usePromptBlocks()

	// ============================
	// Computed Values
	// ============================

	const CategoryIcon = getCategoryIcon(promptBlock.category)
	const categoryColors = getCategoryColors(promptBlock.category)

	// PHASE 4.4 NEW: Use enhanced context methods for better sync
	const isActive = isBlockActive(promptBlock.name)
	const activationState = getActivationState(promptBlock.name)
	const isProcessing = activationState !== "idle"
	const conflictInfo = getConflictInfo(promptBlock.name)
	
	// Phase 2.3: Check if this is a custom prompt for visual differentiation
	const isCustomPrompt = isPromptBlockEditable(promptBlock)
	
	// Phase 2.3: Get custom prompt styling classes
	const getCustomPromptStyles = () => {
		if (!isCustomPrompt) return {}
		
		return {
			// Subtle background gradient for custom prompts
			background: isActive 
				? "bg-gradient-to-r from-vscode-editor-background via-vscode-editor-background to-vscode-editor-background/50"
				: "bg-gradient-to-r from-vscode-editor-background/80 via-vscode-editor-background to-vscode-editor-background/90",
			// Enhanced hover effect for custom prompts
			hover: "hover:from-vscode-list-hoverBackground/90 hover:via-vscode-list-hoverBackground hover:to-vscode-list-hoverBackground/80"
		}
	}
	
	const customStyles = getCustomPromptStyles()

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Phase 2.2: Handle delete button click for custom prompts
	 * Sends delete request directly to backend (like rules do)
	 */
	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation() // Prevent card activation
		
		// Send message to VSCode extension to delete prompt file
		// Backend will handle confirmation dialog (same as rules)
		// Note: Don't call onDeleteStart since user might cancel the operation
		vscode.postMessage({
			type: "deletePromptFile",
			promptName: promptBlock.name,
			promptSource: promptBlock.source as "workspace" | "global" // Safe since delete is only available for custom prompts
		})
		
		console.log(`[PromptBlockCard] Delete requested for prompt: ${promptBlock.name}`)
	}

	/**
	 * Phase 2.2: Handle edit button click for custom prompts
	 * Opens the prompt file in VSCode for editing
	 */
	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation() // Prevent card activation
		
		// Notify parent component that edit operation is starting
		onEditStart?.()
		
		// Send message to VSCode extension to open prompt file for editing
		vscode.postMessage({
			type: "editPromptBlock",
			promptName: promptBlock.name,
			promptSource: promptBlock.source as "workspace" | "global" // Safe since edit is only available for custom prompts
		})
		
		console.log(`[PromptBlockCard] Edit requested for prompt: ${promptBlock.name}`)
	}

	/**
	 * PHASE 5.1 ENHANCED: Handle prompt block activation using unified handler
	 *
	 * This now uses the same activation logic as slash commands to ensure
	 * identical behavior and system prompt enhancement.
	 */
	const handleActivate = async () => {
		try {
			// PHASE 5.1 NEW: Use unified activation handler for consistent behavior
			const { unifiedPromptActivationHandler } = await import("@/services/UnifiedPromptActivationHandler")

			// PHASE 5.1 NEW: Create activation context with all required methods
			const context = {
				availableBlocks,
				activeBlocks,
				isBlockActive,
				getActivationState,
				getConflictInfo,
				toggleActiveBlock,
				addActiveBlock,
			}

			const result = await unifiedPromptActivationHandler.activatePromptBlock(
				promptBlock.name,
				context,
				"toolbar",
				{
					showFeedback: true,
					variables: promptBlock.variables || {},
				},
			)

			if (result.success) {
				console.log(`[PromptBlockCard] ${result.userMessage}`)
				onSelect?.(promptBlock)

				// PHASE 5.1 NEW: Log detailed activation information
				if (result.wasReplacement && result.categoryConflict) {
					console.log(
						`[PromptBlockCard] Category conflict resolved: replaced '${result.categoryConflict.existingBlock.block.name}' with '${promptBlock.name}' in category '${result.categoryConflict.category}'`,
					)
				}

				// PHASE 5.3: Success notification is now handled automatically by UnifiedPromptActivationHandler
			} else {
				console.error(`[PromptBlockCard] ${result.error}`)
				// PHASE 5.3: Error notification is now handled automatically by UnifiedPromptActivationHandler
			}
		} catch (error) {
			console.error(`[PromptBlockCard] Unified activation handler failed:`, error)
			// PHASE 5.3: Critical error - this shouldn't happen but if it does, the handler shows notifications
		}
	}

	// ============================
	// Render
	// ============================

	return (
		<div
			className={cn(
				"group relative",
				"border rounded-md p-3 pt-5",
				// Dynamic background based on custom/default
				isCustomPrompt ? customStyles.background : "bg-vscode-editor-background",
				"border-vscode-panel-border",
				"hover:border-vscode-focusBorder",
				// Enhanced hover effect for custom prompts
				isCustomPrompt ? customStyles.hover : "hover:bg-vscode-list-hoverBackground",
				"cursor-pointer transition-all duration-200",
				isActive && ["ring-1 ring-vscode-focusBorder", categoryColors.bg, categoryColors.border],
				compact && "p-2",
				className,
			)}
			onClick={handleActivate}
			title={`${promptBlock.name} - ${promptBlock.description || "No description"}`}>

			<div className="flex items-start gap-3">
				{/* Category Icon */}
				<div className={cn(
					"flex-shrink-0 p-2 rounded", 
					categoryColors.bg, 
					categoryColors.border,
					// Styling for custom prompts
					isCustomPrompt && "ring-1 ring-white/10"
				)}>
					<CategoryIcon className={cn("w-3 h-3", categoryColors.icon)} />
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Header */}
					<div className="flex items-center justify-between gap-2 -mt-2.5">
						<h4
							className={cn(
								"font-medium text-sm truncate",
								"text-vscode-foreground",
								isActive && categoryColors.text,
							)}>
							{promptBlock.name}
						</h4>

						{/* Phase 2.2: Source badge for custom prompts */}
						{isPromptBlockEditable(promptBlock) && promptBlock.source && (
							<div className="flex items-center gap-1">
								{/* Source icon and label */}
								{promptBlock.source === "workspace" ? (
									<>
										<Building className="w-3 h-3 text-blue-400" />
										<span className="textxs text-blue-400 font-medium">Workspace</span>
									</>
								) : (
									<>
										<Globe className="w-3 h-3 text-green-400" />
										<span className="text-xs text-green-400 font-medium">Global</span>
									</>
								)}
							</div>
						)}
						
						{/* Phase 2.2: Edit/Delete buttons for custom prompts */}
						{isPromptBlockEditable(promptBlock) && (
							<div className="flex items-center gap-1">
								{/* Edit Button */}
								<button
									onClick={handleEditClick}
									className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors"
									title={`Edit ${promptBlock.name} prompt`}
									aria-label={`Edit ${promptBlock.name} prompt`}>
									<Edit className="w-3 h-3" />
								</button>
								
								{/* Delete Button */}
								<button
									onClick={handleDeleteClick}
									className="p-1 rounded hover:bg-red-600/20 text-vscode-descriptionForeground hover:text-red-400 transition-colors"
									title={`Delete ${promptBlock.name} prompt`}
									aria-label={`Delete ${promptBlock.name} prompt`}>
									<Trash2 className="w-3 h-3" />
								</button>
							</div>
						)}
					</div>

					{/* Category Badge and Source Information */}
					<div className="flex items-center gap-2">
						{/* Category Badge */}
						<span className={cn(
							"text-xs px-2 py-0.5 rounded-full font-medium capitalize",
							categoryColors.bg,
							categoryColors.text,
							categoryColors.border,
							"border"
						)}>
							{promptBlock.category}
						</span>
						
						{/* Processing state */}
						{isProcessing && (
							<span className="text-xs text-orange-400">
								{activationState === "activating" ? "Activating..." : "Deactivating..."}
							</span>
						)}

					</div>

						{/* Conflict info */}
						<div className="flex items-center gap-2 mt-4">
							{conflictInfo && !isActive && (
								<span
									className="text-xs text-yellow-400 mb-2"
									title={`Will replace ${conflictInfo.existingBlock.block.name} in ${conflictInfo.category} category`}>
									Will replace "{conflictInfo.existingBlock.block.name}"
								</span>
							)}

							{/* Active Indicator */}
							{isActive && (
								<div className="absolute top-20 right-3">
									<CheckCircle2 className={cn("w-4 h-4", categoryColors.icon)} />
								</div>
							)}
						</div>

					{/* Variables Info */}
					{!compact && promptBlock.variables && Object.keys(promptBlock.variables).length > 0 && (
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							Variables: {Object.keys(promptBlock.variables).join(", ")}
						</div>
					)}
				</div>

				{/* Loading Indicator */}
				{isProcessing && (
					<div className="flex-shrink-0">
						<Loader2 className="w-4 h-4 animate-spin text-vscode-descriptionForeground" />
					</div>
				)}
			</div>
		</div>
	)
}
