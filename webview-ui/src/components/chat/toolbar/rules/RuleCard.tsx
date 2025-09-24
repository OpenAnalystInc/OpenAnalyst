/**
 * RuleCard - Individual rule display component for Rules popover
 *
 * This component displays a single coding rule with toggle functionality,
 * source labeling (Global/Workspace), and management actions.
 * Based on PromptBlockCard pattern but adapted for rule management.
 *
 * Features:
 * - Enable/disable toggle switch
 * - Rule source badges (Global/Workspace)
 * - Edit and delete actions
 * - VSCode integration for file operations
 * - Loading states for async operations
 */

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { Edit, Trash2, Loader2 } from "lucide-react"
import { vscode } from "@/utils/vscode"
import { getBasename } from "@/utils/oacode/path-webview"

/**
 * Rule source type
 */
type RuleSource = "global" | "workspace"

/**
 * Props for the RuleCard component
 */
interface RuleCardProps {
	/** The rule file path */
	rulePath: string
	/** Whether the rule is currently enabled */
	enabled: boolean
	/** Rule source (global or workspace) */
	source: RuleSource
	/** Whether the rule is currently being toggled */
	isLoading?: boolean
	/** Callback when rule is toggled */
	onToggle?: (rulePath: string, enabled: boolean) => void
	/** Callback when edit operation starts */
	onEditStart?: () => void
	/** Additional CSS classes */
	className?: string
}

/**
 * Individual rule card component
 */
export const RuleCard: React.FC<RuleCardProps> = ({
	rulePath,
	enabled,
	isLoading = false,
	onToggle,
	onEditStart,
	className,
}) => {
	// ============================
	// State Management
	// ============================

	const [isProcessing, setIsProcessing] = useState(false)

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle rule toggle
	 */
	const handleToggle = async (e?: React.MouseEvent) => {
		if (e) e.stopPropagation()
		if (isLoading || isProcessing) return

		setIsProcessing(true)
		try {
			onToggle?.(rulePath, !enabled)
		} finally {
			setIsProcessing(false)
		}
	}

	/**
	 * Handle edit rule - opens in VSCode
	 */
	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()

		// Notify parent to prevent closing before VSCode operation
		onEditStart?.()

		vscode.postMessage({
			type: "openFile",
			text: rulePath,
		})
	}

	/**
	 * Handle delete rule
	 */
	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation()
		vscode.postMessage({
			type: "deleteRuleFile",
			rulePath,
		})
	}

	// ============================
	// Computed Values
	// ============================

	const ruleName = getBasename(rulePath)
	const isOperationInProgress = isLoading || isProcessing

	// ============================
	// Styles
	// ============================

	const cardStyles = cn(
		"group border-b border-vscode-dropdown-border last:border-b-0",
		"hover:bg-vscode-list-hoverBackground",
		"transition-colors duration-200",
		"pr-3 pl-4 py-2",
		enabled ? "opacity-100" : "opacity-60",
		className,
	)

	// ============================
	// Render
	// ============================

	return (
		<div className={cardStyles}>
			<div className="flex items-center gap-3">
				{/* Toggle Switch */}
				<div
					role="switch"
					aria-checked={enabled}
					tabIndex={0}
					className={cn(
						"w-[32px] h-[16px] rounded-full relative cursor-pointer transition-colors duration-200 flex items-center flex-shrink-0",
						enabled ? "bg-blue-500" : "bg-gray-400",
						isOperationInProgress && "pointer-events-none opacity-50",
					)}
					onClick={handleToggle}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							e.stopPropagation()
							handleToggle()
						}
					}}>
					<div
						className={cn(
							"w-[12px] h-[12px] bg-white rounded-full absolute transition-all duration-200 shadow-sm",
							enabled ? "left-[18px]" : "left-[2px]",
						)}
					/>
					{isOperationInProgress && (
						<Loader2 className="w-3 h-3 animate-spin absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white" />
					)}
				</div>

				{/* Rule Name and Source */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-sm text-vscode-foreground font-medium truncate" title={rulePath}>
							{ruleName}
						</span>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center gap-1">
					<button
						onClick={handleEdit}
						className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
						title="Edit rule"
						aria-label="Edit rule">
						<Edit className="w-4 h-4" />
					</button>
					<button
						onClick={handleDelete}
						className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
						title="Delete rule"
						aria-label="Delete rule">
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	)
}

export default RuleCard
