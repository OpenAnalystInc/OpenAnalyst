/**
 * McpButton - MCP (Model Context Protocol) toolbar button component
 *
 * Features:
 * - Connected MCP server count badge
 * - Hover and active states
 * - Keyboard accessibility
 */

import React, { useMemo } from "react"
import { Server } from "lucide-react"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"

/**
 * Props for the McpButton component
 */
interface McpButtonProps {
	disabled?: boolean
	className?: string
}

/**
 * MCP toolbar button component
 */
export const McpButton: React.FC<McpButtonProps> = ({ disabled = false, className }) => {
	// ============================
	// State Management
	// ============================

	/**
	 * Get MCP servers from extension state
	 * This provides the same server data used
	 */
	const { mcpServers } = useExtensionState()

	// ============================
	// Computed Values
	// ============================

	/**
	 * Calculate connected MCP server count for badge display
	 * Shows count of servers that are currently connected/active
	 */
	const connectedServersCount = useMemo(() => {
		if (!mcpServers || mcpServers.length === 0) {
			return 0
		}
		// Count servers that are connected - status types: "connected" | "connecting" | "disconnected"
		return mcpServers.filter((server) => server.status === "connected").length
	}, [mcpServers])

	// ============================
	// Event Handlers
	// ============================
	const handleClick = () => {
		// Exact same as header button - preserving complete command flow
		// Use window.postMessage to match the marketplace implementation
		window.postMessage(
			{
				type: "action",
				action: "mcpButtonClicked",
			},
			"*",
		)
	}

	// ============================
	// Render
	// ============================

	return (
		<button
			className={cn(
				"flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ease-in-out",
				"border border-transparent",
				"bg-transparent",
				"text-vscode-foreground",
				"opacity-60 hover:opacity-100",
				"hover:bg-vscode-toolbar-hoverBackground",
				"hover:border-vscode-contrastBorder",
				disabled && "opacity-30 cursor-not-allowed",
			)}
			title="MCP Servers"
			aria-label="MCP Servers"
			disabled={disabled}
			onClick={handleClick}>
			<Server className="w-4 h-4" />
		</button>
	)
}
