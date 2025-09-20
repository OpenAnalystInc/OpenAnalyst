import React from "react"
import { X } from "lucide-react"
import { usePromptBlocks } from "@/context/PromptBlocksContext"
import { getCategoryDisplayName } from "@/utils/prompt-blocks"
import { cn } from "@/lib/utils"

interface ActivePromptsProps {
	className?: string
}

/**
 * Component to display and manage active prompt blocks
 * Shows pill badges for each active prompt block with category colors
 */
export const ActivePrompts: React.FC<ActivePromptsProps> = ({ className }) => {
	const { activeBlocks, removeActiveBlock } = usePromptBlocks()

	if (activeBlocks.length === 0) {
		return null
	}

	// Category color mapping for pill badges
	const getCategoryColor = (category: string): string => {
		switch (category) {
			case "analysis":
				return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
			case "visualization":
				return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
			case "reporting":
				return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
			case "methodology":
				return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
			default:
				return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800"
		}
	}

	const getSimpleCategoryName = (category: string): string => {
		switch (category) {
			case "analysis": return "📊"
			case "visualization": return "📈"
			case "reporting": return "📋"
			case "methodology": return "🔬"
			default: return "⚙️"
		}
	}

	return (
		<div className={cn("flex flex-wrap gap-2 p-3 bg-[var(--vscode-editor-background)]/50 border-b border-[var(--vscode-editorGroup-border)]", className)}>
			<div className="flex items-center gap-2 text-sm text-[var(--vscode-descriptionForeground)]">
				<span className="font-medium">Active Prompts:</span>
			</div>
			{activeBlocks.map((activeBlock) => (
				<div
					key={activeBlock.block.name}
					className={cn(
						"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
						getCategoryColor(activeBlock.block.category)
					)}
				>
					<span className="text-xs" title={getCategoryDisplayName(activeBlock.block.category)}>
						{getSimpleCategoryName(activeBlock.block.category)}
					</span>
					<span className="max-w-[100px] truncate" title={activeBlock.block.description}>
						{activeBlock.block.name}
					</span>
					<button
						onClick={() => removeActiveBlock(activeBlock.block.name)}
						className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
						title={`Remove ${activeBlock.block.name}`}
						aria-label={`Remove ${activeBlock.block.name} prompt block`}
					>
						<X className="h-3 w-3" />
					</button>
				</div>
			))}
			
			{activeBlocks.length > 1 && (
				<button
					onClick={() => {
						// Clear all active blocks
						activeBlocks.forEach(ab => removeActiveBlock(ab.block.name))
					}}
					className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-colors"
					title="Remove all active prompt blocks"
				>
					Clear all
				</button>
			)}
		</div>
	)
}

/**
 * Compact version for inline display
 */
export const ActivePromptsCompact: React.FC<{ className?: string }> = ({ className }) => {
	const { activeBlocks } = usePromptBlocks()

	if (activeBlocks.length === 0) {
		return null
	}

	return (
		<div className={cn("flex items-center gap-1 text-xs text-[var(--vscode-descriptionForeground)]", className)}>
			<span>Active:</span>
			{activeBlocks.map((activeBlock, index) => (
				<span key={activeBlock.block.name} className="inline-flex items-center">
					{index > 0 && <span className="mr-1">,</span>}
					<span className="font-medium text-[var(--vscode-foreground)]">
						{activeBlock.block.name}
					</span>
				</span>
			))}
		</div>
	)
}