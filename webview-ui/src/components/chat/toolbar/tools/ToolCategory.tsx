/**
 * ToolCategory - Category grouping component for organizing development tools
 * 
 * This component groups development tools by category with collapsible sections,
 * category descriptions, status indicators, and tool counts for better organization.
 * 
 * Features:
 * - Collapsible category sections
 * - Category icons and descriptions
 * - Tool counts and status indicators
 * - Available/enabled tool statistics
 * - Quick access to category tools
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  Globe,
  Terminal,
  GitBranch,
  Database,
  Brain,
  CheckCircle,
  AlertCircle,
  XCircle,
  Hash
} from 'lucide-react'

import { ToolOption, ToolCategory as ToolCategoryType, ToolStatus } from '../types'
import { ToolItem } from './ToolItem'

/**
 * Props for the ToolCategory component
 */
interface ToolCategoryProps {
  category: ToolCategoryType
  tools: ToolOption[]
  onExecuteTool?: (toolId: string, parameters: Record<string, any>) => void
  onToggleTool?: (toolId: string, enabled: boolean) => void
  onConfigureTool?: (tool: ToolOption) => void
  executingTools?: Set<string>
  defaultExpanded?: boolean
  compact?: boolean
  className?: string
}

/**
 * Category configuration with icons and descriptions
 */
const CATEGORY_CONFIG = {
  file: {
    icon: FileText,
    title: 'File Operations',
    description: 'Read, write, and manage files and directories',
    color: 'text-blue-400'
  },
  search: {
    icon: Search,
    title: 'Search Tools',
    description: 'Search files, content, and codebase patterns',
    color: 'text-green-400'
  },
  web: {
    icon: Globe,
    title: 'Web Access',
    description: 'Fetch content and scrape web resources',
    color: 'text-purple-400'
  },
  terminal: {
    icon: Terminal,
    title: 'Terminal Commands',
    description: 'Execute shell commands and package managers',
    color: 'text-orange-400'
  },
  git: {
    icon: GitBranch,
    title: 'Git Operations',
    description: 'Version control and repository management',
    color: 'text-red-400'
  },
  database: {
    icon: Database,
    title: 'Database Access',
    description: 'Query and inspect database schemas',
    color: 'text-cyan-400'
  },
  ai: {
    icon: Brain,
    title: 'AI Tools',
    description: 'AI-powered code analysis and generation',
    color: 'text-pink-400'
  }
}

/**
 * Tool category grouping component
 */
export const ToolCategory: React.FC<ToolCategoryProps> = ({
  category,
  tools,
  onExecuteTool,
  onToggleTool,
  onConfigureTool,
  executingTools = new Set(),
  defaultExpanded = false,
  compact = false,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // ============================
  // Computed Values
  // ============================

  const config = CATEGORY_CONFIG[category]
  const availableTools = tools.filter(t => t.status === 'available')
  const enabledTools = tools.filter(t => t.enabled && t.status === 'available')
  const unavailableTools = tools.filter(t => t.status === 'unavailable')
  const errorTools = tools.filter(t => t.status === 'error')

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle category expansion toggle
   */
  const handleToggleExpansion = () => {
    setIsExpanded(!isExpanded)
  }

  /**
   * Handle tool execution
   */
  const handleExecuteTool = (toolId: string, parameters: Record<string, any>) => {
    onExecuteTool?.(toolId, parameters)
  }

  /**
   * Handle tool toggle
   */
  const handleToggleTool = (toolId: string, enabled: boolean) => {
    onToggleTool?.(toolId, enabled)
  }

  /**
   * Handle tool configuration
   */
  const handleConfigureTool = (tool: ToolOption) => {
    onConfigureTool?.(tool)
  }

  // ============================
  // Styles
  // ============================

  const categoryStyles = cn(
    'border border-vscode-dropdown-border rounded-md',
    'bg-vscode-dropdown-background',
    className
  )

  const headerStyles = cn(
    'flex items-center justify-between p-3 cursor-pointer',
    'hover:bg-vscode-list-hoverBackground',
    'border-b border-vscode-dropdown-border',
    !isExpanded && 'border-b-0'
  )

  const iconStyles = cn(
    'w-4 h-4',
    config.color
  )

  // ============================
  // Render Helpers
  // ============================

  /**
   * Render status indicators
   */
  const renderStatusIndicators = () => {
    return (
      <div className="flex items-center gap-2 text-xs">
        {availableTools.length > 0 && (
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-3 h-3" />
            {availableTools.length}
          </span>
        )}
        {unavailableTools.length > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertCircle className="w-3 h-3" />
            {unavailableTools.length}
          </span>
        )}
        {errorTools.length > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="w-3 h-3" />
            {errorTools.length}
          </span>
        )}
      </div>
    )
  }

  // ============================
  // Render
  // ============================

  if (tools.length === 0) {
    return null // Don't render empty categories
  }

  return (
    <div className={categoryStyles}>
      {/* Category Header */}
      <div className={headerStyles} onClick={handleToggleExpansion}>
        <div className="flex items-center gap-3">
          {/* Expansion Icon */}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-vscode-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-vscode-foreground" />
          )}
          
          {/* Category Icon */}
          <config.icon className={iconStyles} />
          
          {/* Category Info */}
          <div>
            <h3 className="font-medium text-sm text-vscode-foreground">
              {config.title}
            </h3>
            {!compact && (
              <p className="text-xs text-vscode-descriptionForeground">
                {config.description}
              </p>
            )}
          </div>
        </div>
        
        {/* Category Stats */}
        <div className="flex items-center gap-3">
          {/* Status Indicators */}
          {renderStatusIndicators()}
          
          {/* Tool Count */}
          <div className="flex items-center gap-1 text-xs text-vscode-descriptionForeground">
            <Hash className="w-3 h-3" />
            {tools.length}
          </div>
          
          {/* Enabled Count */}
          {!compact && enabledTools.length > 0 && (
            <span className="text-xs text-vscode-descriptionForeground">
              {enabledTools.length} enabled
            </span>
          )}
        </div>
      </div>

      {/* Category Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Show enabled tools first */}
          {enabledTools.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-vscode-foreground">
                  Enabled Tools
                </span>
              </div>
              <div className="space-y-2">
                {enabledTools.map((tool) => (
                  <ToolItem
                    key={tool.id}
                    tool={tool}
                    onExecute={handleExecuteTool}
                    onToggle={handleToggleTool}
                    onConfigure={handleConfigureTool}
                    isExecuting={executingTools.has(tool.id)}
                    compact={compact}
                  />
                ))}
              </div>
              
              {/* Separator if there are disabled tools */}
              {availableTools.length > enabledTools.length && (
                <div className="border-t border-vscode-dropdown-border my-3" />
              )}
            </div>
          )}
          
          {/* Show available but disabled tools */}
          {availableTools.filter(t => !t.enabled).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3 h-3 text-vscode-descriptionForeground" />
                <span className="text-xs font-medium text-vscode-foreground">
                  Available Tools
                </span>
              </div>
              <div className="space-y-2">
                {availableTools
                  .filter(t => !t.enabled)
                  .map((tool) => (
                    <ToolItem
                      key={tool.id}
                      tool={tool}
                      onExecute={handleExecuteTool}
                      onToggle={handleToggleTool}
                      onConfigure={handleConfigureTool}
                      isExecuting={executingTools.has(tool.id)}
                      compact={compact}
                    />
                  ))}
              </div>
            </div>
          )}
          
          {/* Show unavailable/error tools */}
          {(unavailableTools.length > 0 || errorTools.length > 0) && (
            <div>
              <div className="border-t border-vscode-dropdown-border my-3" />
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs font-medium text-vscode-foreground">
                  Unavailable Tools
                </span>
              </div>
              <div className="space-y-2">
                {[...unavailableTools, ...errorTools].map((tool) => (
                  <ToolItem
                    key={tool.id}
                    tool={tool}
                    onExecute={handleExecuteTool}
                    onToggle={handleToggleTool}
                    onConfigure={handleConfigureTool}
                    isExecuting={false}
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}