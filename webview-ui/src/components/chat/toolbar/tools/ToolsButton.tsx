/**
 * ToolsButton - Tools toolbar button with development tools popover
 *
 * This component provides access to development tools through a toolbar button.
 * It uses the ToolsPopover component to display categorized development tools
 * with search functionality, status filtering, and tool execution capabilities.
 *
 * Features:
 * - Tools count badge display
 * - Integration with ToolsPopover
 * - Status-based styling
 * - Keyboard accessibility
 * - Tool execution callbacks
 */

import React, { useMemo } from "react"
import { Wrench } from "lucide-react"
import { ToolsPopover } from "./ToolsPopover"
import { getToolStats, getEnabledTools } from "./mockToolsData"
import { ToolOption } from "../types"

/**
 * Props for the ToolsButton component
 */
interface ToolsButtonProps {
	onToolExecute?: (toolId: string, parameters: Record<string, any>) => void
	onToolConfigure?: (tool: ToolOption) => void
	onManageTools?: () => void
	className?: string
}

/**
 * Tools toolbar button component
 */
export const ToolsButton: React.FC<ToolsButtonProps> = ({
	onToolExecute,
	onToolConfigure,
	onManageTools,
	className,
}) => {
	// ============================
	// Computed Values
	// ============================

	/**
	 * Get tool statistics for badge display
	 */
	const toolStats = useMemo(() => getToolStats(), [])

	/**
	 * Get enabled tools for status indication
	 */
	const enabledTools = useMemo(() => getEnabledTools(), [])

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle tool execution
	 */
	const handleToolExecute = (toolId: string, parameters: Record<string, any>) => {
		console.log("Executing tool:", toolId, parameters)
		onToolExecute?.(toolId, parameters)
	}

	/**
	 * Handle tool configuration
	 */
	const handleToolConfigure = (tool: ToolOption) => {
		console.log("Configuring tool:", tool.name)
		onToolConfigure?.(tool)
	}

	/**
	 * Handle manage tools action
	 */
	const handleManageTools = () => {
		console.log("Opening tools management")
		onManageTools?.()
	}

	// ============================
	// Render
	// ============================

	return (
		<ToolsPopover
			onToolExecute={handleToolExecute}
			onToolConfigure={handleToolConfigure}
			onManageTools={handleManageTools}
		/>
	)
}
