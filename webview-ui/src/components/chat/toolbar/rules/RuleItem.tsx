/**
 * RuleItem - Individual rule display component for Rules popover
 * 
 * This component displays a single coding rule with toggle functionality,
 * source labeling, and expandable content display.
 * 
 * Features:
 * - Enable/disable toggle switch
 * - Rule source badges (Global, Project, User, etc.)
 * - Expandable rule content
 * - Priority indicators
 * - Pattern matching display
 * - Last modified timestamps
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  ChevronDown,
  ChevronRight,
  Globe,
  FolderOpen,
  User,
  Settings,
  Building,
  FileText,
  Clock,
  Target
} from 'lucide-react'
import { Switch } from '@/components/ui'

import { Rule, RuleSource } from '../types'

/**
 * Props for the RuleItem component
 */
interface RuleItemProps {
  rule: Rule
  onToggle?: (ruleId: string, enabled: boolean) => void
  isLoading?: boolean
  className?: string
}

/**
 * Get source icon based on rule source
 */
const getSourceIcon = (source: RuleSource) => {
  switch (source) {
    case 'global':
      return <Globe className="w-3 h-3" />
    case 'project':
      return <FolderOpen className="w-3 h-3" />
    case 'user':
      return <User className="w-3 h-3" />
    case 'model':
      return <Settings className="w-3 h-3" />
    case 'workspace':
      return <Building className="w-3 h-3" />
  }
}

/**
 * Get source color based on rule source
 */
const getSourceColor = (source: RuleSource) => {
  switch (source) {
    case 'global':
      return 'text-blue-400 bg-blue-400/10'
    case 'project':
      return 'text-green-400 bg-green-400/10'
    case 'user':
      return 'text-purple-400 bg-purple-400/10'
    case 'model':
      return 'text-orange-400 bg-orange-400/10'
    case 'workspace':
      return 'text-cyan-400 bg-cyan-400/10'
  }
}

/**
 * Individual rule item component
 */
export const RuleItem: React.FC<RuleItemProps> = ({
  rule,
  onToggle,
  isLoading = false,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  const [isExpanded, setIsExpanded] = useState(false)

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle rule toggle
   */
  const handleToggle = () => {
    if (!isLoading && onToggle) {
      onToggle(rule.id, !rule.enabled)
    }
  }

  /**
   * Handle expansion toggle
   */
  const handleExpansionToggle = () => {
    setIsExpanded(!isExpanded)
  }

  /**
   * Format date for display
   */
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ============================
  // Styles
  // ============================

  const itemStyles = cn(
    'group border-b border-vscode-dropdown-border last:border-b-0',
    'hover:bg-vscode-list-hoverBackground',
    'transition-colors duration-200',
    className
  )

  const sourceStyles = cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
    'text-xs font-medium',
    getSourceColor(rule.source)
  )

  // ============================
  // Render
  // ============================

  return (
    <div className={itemStyles}>
      {/* Main Rule Header */}
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left Side: Rule Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
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
              
              <h4 className="font-medium text-sm text-vscode-foreground truncate">
                {rule.name}
              </h4>
              
              {/* Source Badge */}
              <span className={sourceStyles}>
                {getSourceIcon(rule.source)}
                <span className="capitalize">{rule.source}</span>
              </span>
            </div>
            
            <p className="text-xs text-vscode-descriptionForeground ml-6 truncate">
              {rule.description}
            </p>
            
            {/* Rule Metadata */}
            <div className="flex items-center gap-3 ml-6 mt-1 text-xs text-vscode-descriptionForeground">
              {rule.priority && (
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Priority: {rule.priority}
                </span>
              )}
              
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(rule.modifiedAt)}
              </span>
              
              {rule.patterns && rule.patterns.length > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {rule.patterns.length} pattern{rule.patterns.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          {/* Right Side: Toggle Switch */}
          <div className="flex-shrink-0">
            <Switch
              checked={rule.enabled}
              onCheckedChange={handleToggle}
              disabled={isLoading || rule.status !== 'active'}
              size="sm"
            />
          </div>
        </div>
        
        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-3 ml-6 space-y-3 animate-fade-in">
            {/* Rule Content */}
            <div className="p-3 bg-vscode-textCodeBlock-background rounded border border-vscode-textPreformat-foreground/20">
              <pre className="text-xs text-vscode-textPreformat-foreground whitespace-pre-wrap font-mono">
                {rule.content}
              </pre>
            </div>
            
            {/* Patterns Display */}
            {rule.patterns && rule.patterns.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-vscode-foreground mb-1">
                  File Patterns:
                </h5>
                <div className="flex flex-wrap gap-1">
                  {rule.patterns.map((pattern, index) => (
                    <code
                      key={index}
                      className="px-2 py-1 text-xs bg-vscode-badge-background text-vscode-badge-foreground rounded"
                    >
                      {pattern}
                    </code>
                  ))}
                </div>
              </div>
            )}
            
            {/* Always Apply Badge */}
            {rule.alwaysApply && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded text-xs">
                <Globe className="w-3 h-3" />
                Always Applied
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}