/**
 * WorkflowPopover - Alternative popover implementation for workflow mode selection
 *
 * This component provides a custom popover for workflow mode selection.
 * It can be used as an alternative to the SelectDropdown approach if needed.
 *
 * Features:
 * - Custom layout for workflow modes
 * - Keyboard navigation
 * - Visual mode indicators
 * - Descriptions for each mode
 */

import React, { useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
// import { LockIcon } from "@/components/ui/LockIcon" // Not needed - using codicon-lock instead
import { WorkflowPopoverProps, WorkflowMode, WORKFLOW_MODES } from "./types"

/**
 * WorkflowPopover component for custom workflow mode selection
 */
export const WorkflowPopover: React.FC<WorkflowPopoverProps> = ({ currentMode, onModeChange, onClose }) => {
	const popoverRef = useRef<HTMLDivElement>(null)
	const [focusedIndex, setFocusedIndex] = React.useState(0)

	const modeOptions = Object.values(WORKFLOW_MODES)

	/**
	 * Handle mode selection
	 */
	const handleModeSelect = useCallback(
		(mode: WorkflowMode) => {
			// Check if mode is premium/locked
			const modeConfig = WORKFLOW_MODES[mode]
			if (modeConfig?.isPremium) {
				console.log("Cannot select premium/locked mode:", mode)
				return // Prevent selection of locked modes
			}

			onModeChange(mode)
			onClose()
		},
		[onModeChange, onClose],
	)

	/**
	 * Handle keyboard navigation
	 */
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			switch (event.key) {
				case "ArrowDown":
					event.preventDefault()
					setFocusedIndex((prev) => (prev + 1) % modeOptions.length)
					break

				case "ArrowUp":
					event.preventDefault()
					setFocusedIndex((prev) => (prev - 1 + modeOptions.length) % modeOptions.length)
					break

				case "Enter":
				case " ":
					event.preventDefault()
					handleModeSelect(modeOptions[focusedIndex].id)
					break

				case "Escape":
					event.preventDefault()
					onClose()
					break
			}
		},
		[focusedIndex, modeOptions, handleModeSelect, onClose],
	)

	/**
	 * Handle click outside to close
	 */
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [onClose])

	/**
	 * Focus on mount
	 */
	useEffect(() => {
		popoverRef.current?.focus()
	}, [])

	return (
		<div
			ref={popoverRef}
			className={cn(
				"absolute right-0 mt-2 w-64 rounded-md",
				"bg-vscode-dropdown-background",
				"border border-vscode-dropdown-border",
				"shadow-lg z-50",
				"focus:outline-none",
			)}
			role="menu"
			aria-label="Workflow mode selection"
			tabIndex={-1}
			onKeyDown={handleKeyDown}>
			<div className="py-1">
				{modeOptions.map((mode, index) => (
					<button
						key={mode.id}
						className={cn(
							"w-full px-3 py-2 text-left",
							"flex items-start gap-3",
							"transition-colors duration-150",
							// Disabled styles for premium modes
							mode.isPremium
								? "opacity-50 cursor-not-allowed"
								: "hover:bg-vscode-list-hoverBackground focus:bg-vscode-list-hoverBackground",
							currentMode === mode.id && !mode.isPremium && "bg-vscode-list-activeSelectionBackground",
							focusedIndex === index && !mode.isPremium && "bg-vscode-list-hoverBackground",
						)}
						onClick={() => handleModeSelect(mode.id)}
						disabled={mode.isPremium}
						role="menuitem"
						aria-selected={currentMode === mode.id}
						aria-disabled={mode.isPremium}>
						{/* Icon - Show lock codicon for premium modes */}
						<span className={cn(
							"codicon",
							mode.isPremium ? "codicon-lock" : mode.icon,
							"mt-0.5 text-base",
							mode.isPremium ? "text-yellow-500 opacity-100" : "opacity-80"
						)} />

						{/* Content */}
						<div className="flex-1">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">{mode.label}</span>
								{currentMode === mode.id && !mode.isPremium && (
									<Check className="w-4 h-4 text-vscode-textLink-foreground" />
								)}
							</div>
							<p className="text-xs text-vscode-descriptionForeground mt-0.5">
								{mode.isPremium ? "Premium feature - Upgrade to unlock" : mode.description}
							</p>
						</div>
					</button>
				))}
			</div>
		</div>
	)
}

export default WorkflowPopover
