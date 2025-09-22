/**
 * McpButton - MCP (Model Context Protocol) toolbar button component
 * 
 * Features:
 * - Connected MCP server count badge
 * - Hover and active states
 * - Keyboard accessibility  
 */

import React, { useMemo } from 'react'
import { Server } from 'lucide-react'
import { ToolbarButton } from '../ToolbarButton'
import { useExtensionState } from '@/context/ExtensionStateContext'

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
export const McpButton: React.FC<McpButtonProps> = ({
  disabled = false,
  className
}) => {
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
    return mcpServers.filter(server => server.status === 'connected').length
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
      "*"
    )
  }

  // ============================
  // Render
  // ============================

  return (
    <ToolbarButton
      icon={<Server className="w-4 h-4" />}
      
      // Show badge with connected server count (only if > 0)
      badge={connectedServersCount > 0 ? connectedServersCount : undefined}
      
      tooltip="MCP Servers"
      
      // Handle click
      onClick={handleClick}
      
      // Support disabled state from parent
      disabled={disabled}
      
      // Additional styling
      className={className}
    />
  )
}