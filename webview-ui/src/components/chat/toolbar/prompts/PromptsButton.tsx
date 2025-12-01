/**
 * PromptsButton
 * This component provides the Prompts button that opens the prompts templates
 * popover.
 *
 * LOCKED FEATURE - Currently disabled as premium feature
 *
 * Features:
 * - Integration with PromptsPopover component (COMMENTED OUT)
 * - Dynamic badge showing template count (COMMENTED OUT)
 * - Hover and active states
 * - Keyboard accessibility
 * - Prompt management callbacks (COMMENTED OUT)
 */

import React from "react"
// import { PromptsPopover } from "./PromptsPopover" // Commented out - locked feature
import { MessageSquareLock } from "lucide-react" // Lock icon for premium feature
import { PromptBlockInfo } from "@/utils/prompt-blocks"
import { usePromptBlocks } from "@/context/PromptBlocksContext"
import { cn } from "@/lib/utils"

/**
 * Props for the PromptsButton component
 */
interface PromptsButtonProps {
	disabled?: boolean
	onPromptSelect?: (prompt: PromptBlockInfo) => void
	className?: string
}

/**
 * Prompts button component - LOCKED as premium feature
 */
export const PromptsButton: React.FC<PromptsButtonProps> = ({ onPromptSelect, className }) => {
	// ============================
	// ORIGINAL CODE - COMMENTED OUT
	// ============================

	/**
	 * Handle prompt selection from popover
	 */
	// const handlePromptSelect = (prompt: PromptBlockInfo) => {
	// 	console.log("Prompt selected:", prompt.name)
	// 	onPromptSelect?.(prompt)
	// }

	// ============================
	// LOCKED FEATURE - NEW CODE
	// ============================

	const handleClick = () => {
		// Locked feature - do nothing
		console.log("Prompts button clicked - Premium feature locked")
		// Optionally show toast message here
	}

	// ============================
	// Render - LOCKED STATE
	// ============================

	// Original render - opens popover (COMMENTED OUT)
	// return <PromptsPopover onPromptSelect={handlePromptSelect} />

	// New render - locked button with yellow lock icon
	return (
		<button
			onClick={handleClick}
			title="Prompts (Premium Feature)"
			className={cn(
				"inline-flex items-center justify-center gap-1.5",
				"px-2 py-1.5",
				"text-xs font-medium",
				"rounded-md",
				"opacity-60",
				"cursor-not-allowed",
				"transition-opacity",
				"hover:opacity-70",
				className
			)}
		>
			<MessageSquareLock className="w-5 h-5 text-yellow-500" />
		</button>
	)
}
