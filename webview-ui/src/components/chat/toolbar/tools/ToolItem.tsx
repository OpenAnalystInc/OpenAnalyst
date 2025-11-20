/**
 * ToolItem - Individual tool display component for Tools popover
 * 
 * This component displays a single development tool with execution functionality,
 * parameter configuration, status indicators, and enable/disable toggles.
 * 
 * Features:
 * - Tool status indicators (available, unavailable, error)
 * - Enable/disable toggle switches  
 * - Parameter configuration modal
 * - Quick execution with default parameters
 * - Tool shortcuts display
 * - Category and version information
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  Play,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Keyboard,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Switch } from '@/components/ui'
import { Button } from '@/components/ui'

import { ToolOption, ToolStatus, ToolCategory } from '../types'

/**
 * Props for the ToolItem component
 */
interface ToolItemProps {
  tool: ToolOption
  onExecute?: (toolId: string, parameters: Record<string, any>) => void
  onToggle?: (toolId: string, enabled: boolean) => void
  onConfigure?: (tool: ToolOption) => void
  isExecuting?: boolean
  className?: string
  compact?: boolean
}

/**
 * Get status icon and color based on tool status
 */
const getStatusIcon = (status: ToolStatus) => {
  switch (status) {
    case 'available':
      return { icon: CheckCircle, color: 'text-green-400' }
    case 'unavailable':
      return { icon: AlertCircle, color: 'text-yellow-400' }
    case 'error':
      return { icon: XCircle, color: 'text-red-400' }
  }
}

/**
 * Get category color based on tool category
 */
const getCategoryColor = (category: ToolCategory) => {
  switch (category) {
    case 'file':
      return 'text-blue-400 bg-blue-400/10'
    case 'search':
      return 'text-green-400 bg-green-400/10'
    case 'web':
      return 'text-purple-400 bg-purple-400/10'
    case 'terminal':
      return 'text-orange-400 bg-orange-400/10'
    case 'git':
      return 'text-red-400 bg-red-400/10'
    case 'database':
      return 'text-cyan-400 bg-cyan-400/10'
    case 'ai':
      return 'text-pink-400 bg-pink-400/10'
  }
}

/**
 * Individual tool item component
 */
export const ToolItem: React.FC<ToolItemProps> = ({
  tool,
  onExecute,
  onToggle,
  onConfigure,
  isExecuting = false,
  className,
  compact = false
}) => {
  // ============================
  // State Management
  // ============================
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [showParameters, setShowParameters] = useState(false)

  // ============================
  // Computed Values
  // ============================

  const statusConfig = getStatusIcon(tool.status)
  const isInteractable = tool.status === 'available'
  const requiredParams = tool.parameters.filter(p => p.required)
  const hasRequiredParams = requiredParams.length > 0

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle tool execution
   */
  const handleExecute = () => {
    if (hasRequiredParams) {
      // Show parameter configuration if required params exist
      setShowParameters(true)
      onConfigure?.(tool)
    } else {
      // Execute with default parameters
      const defaultParams = tool.parameters.reduce((acc, param) => {
        if (param.defaultValue !== undefined) {
          acc[param.name] = param.defaultValue
        }
        return acc
      }, {} as Record<string, any>)
      
      onExecute?.(tool.id, defaultParams)
    }
  }

  /**
   * Handle tool toggle
   */
  const handleToggle = () => {
    if (isInteractable && onToggle) {
      onToggle(tool.id, !tool.enabled)
    }
  }

  /**
   * Handle configure button click
   */
  const handleConfigure = () => {
    onConfigure?.(tool)
  }

  /**
   * Handle expansion toggle
   */
  const handleExpansionToggle = () => {
    setIsExpanded(!isExpanded)
  }

  // ============================
  // Styles
  // ============================

  const itemStyles = cn(
    'group relative p-3 border border-vscode-dropdown-border rounded-md',
    'transition-all duration-200',
    isInteractable
      ? 'hover:bg-vscode-list-hoverBackground hover:border-vscode-focusBorder cursor-pointer'
      : 'opacity-50 cursor-not-allowed',
    compact && 'p-2',
    className
  )

  const categoryStyles = cn(
    'inline-flex items-center gap-1 px-2 py-1 rounded-full',
    'text-xs font-medium capitalize',
    getCategoryColor(tool.category)
  )

  // ============================
  // Render
  // ============================

  return (
    <div className={itemStyles}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        {/* Left Side: Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Expansion Toggle */}
            {!compact && (
              <button
                onClick={handleExpansionToggle}
                className="text-vscode-foreground hover:text-vscode-button-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            
            {/* Status Icon */}
            <statusConfig.icon className={cn('w-4 h-4', statusConfig.color)} />
            
            <h4 className="font-medium text-sm text-vscode-foreground truncate">
              {tool.name}
            </h4>
            
            {/* Category Badge */}
            <span className={categoryStyles}>
              {tool.category}
            </span>

            {/* Version Badge */}
            {tool.version && (
              <span className="px-1.5 py-0.5 bg-vscode-badge-background text-vscode-badge-foreground rounded text-xs">
                v{tool.version}
              </span>
            )}
          </div>
          
          <p className="text-xs text-vscode-descriptionForeground mb-2 line-clamp-2">
            {tool.description}
          </p>
          
          {/* Tool Metadata */}
          {!compact && (
            <div className="flex items-center gap-3 text-xs text-vscode-descriptionForeground">
              {tool.parameters.length > 0 && (
                <span className="flex items-center gap-1">
                  <Settings className="w-3 h-3" />
                  {tool.parameters.length} param{tool.parameters.length > 1 ? 's' : ''}
                  {requiredParams.length > 0 && (
                    <span className="text-vscode-editorWarning-foreground">
                      ({requiredParams.length} required)
                    </span>
                  )}
                </span>
              )}
              
              {tool.shortcuts && tool.shortcuts.length > 0 && (
                <span className="flex items-center gap-1">
                  <Keyboard className="w-3 h-3" />
                  {tool.shortcuts[0]}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Right Side: Controls */}
        <div className="flex items-center gap-2">
          {/* Execute Button */}
          {isInteractable && tool.enabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExecute}
              disabled={isExecuting}
              className="h-7 px-2"
            >
              {isExecuting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {!compact && (
                <span className="ml-1 text-xs">
                  {hasRequiredParams ? 'Config' : 'Run'}
                </span>
              )}
            </Button>
          )}
          
          {/* Configure Button */}
          {isInteractable && tool.parameters.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleConfigure}
              className="h-7 w-7 p-0"
              title="Configure parameters"
            >
              <Settings className="w-3 h-3" />
            </Button>
          )}
          
          {/* Enable/Disable Toggle */}
          {isInteractable && (
            <Switch
              checked={tool.enabled}
              onCheckedChange={handleToggle}
              size="sm"
            />
          )}
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && !compact && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {/* Parameters List */}
          {tool.parameters.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-vscode-foreground mb-2 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Parameters:
              </h5>
              <div className="space-y-2">
                {tool.parameters.slice(0, 3).map((param, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <code className="px-1.5 py-0.5 bg-vscode-textCodeBlock-background text-vscode-textPreformat-foreground rounded">
                        {param.name}
                      </code>
                      <span className="text-vscode-descriptionForeground">
                        {param.type}
                      </span>
                      {param.required && (
                        <span className="text-vscode-editorWarning-foreground">*</span>
                      )}
                    </div>
                    {param.defaultValue !== undefined && (
                      <span className="text-vscode-descriptionForeground">
                        default: {String(param.defaultValue)}
                      </span>
                    )}
                  </div>
                ))}
                {tool.parameters.length > 3 && (
                  <div className="text-xs text-vscode-descriptionForeground">
                    +{tool.parameters.length - 3} more parameters
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Shortcuts */}
          {tool.shortcuts && tool.shortcuts.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-vscode-foreground mb-1 flex items-center gap-1">
                <Keyboard className="w-3 h-3" />
                Shortcuts:
              </h5>
              <div className="flex flex-wrap gap-1">
                {tool.shortcuts.map((shortcut, index) => (
                  <kbd
                    key={index}
                    className="px-1.5 py-0.5 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded text-xs"
                  >
                    {shortcut}
                  </kbd>
                ))}
              </div>
            </div>
          )}
          
          {/* Status Message */}
          {tool.status !== 'available' && (
            <div className="flex items-center gap-2 p-2 bg-vscode-inputValidation-warningBackground rounded">
              <AlertCircle className="w-4 h-4 text-vscode-inputValidation-warningForeground" />
              <span className="text-xs text-vscode-inputValidation-warningForeground">
                {tool.status === 'unavailable' 
                  ? 'This tool is currently unavailable'
                  : 'This tool has encountered an error'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}