/**
 * PromptTemplate - Individual prompt template component for Prompts popover
 * 
 * This component displays a single prompt template with selection functionality,
 * favorite toggle, usage statistics, and variable preview.
 * 
 * Features:
 * - Template preview with truncation
 * - Favorite toggle with heart icon
 * - Usage count display
 * - Variable indicators
 * - Category badges
 * - Click to select/use template
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  Heart,
  Play,
  Tag,
  Hash,
  Eye,
  EyeOff,
  Copy,
  Star
} from 'lucide-react'
import { Button } from '@/components/ui'

import { PromptTemplate as PromptTemplateType, PromptCategory } from '../types'

/**
 * Props for the PromptTemplate component
 */
interface PromptTemplateProps {
  prompt: PromptTemplateType
  onSelect?: (prompt: PromptTemplateType) => void
  onToggleFavorite?: (promptId: string, isFavorite: boolean) => void
  onPreview?: (prompt: PromptTemplateType) => void
  className?: string
  compact?: boolean
}

/**
 * Get category color based on prompt category
 */
const getCategoryColor = (category: PromptCategory) => {
  switch (category) {
    case 'code':
      return 'text-blue-400 bg-blue-400/10'
    case 'debug':
      return 'text-red-400 bg-red-400/10'
    case 'review':
      return 'text-yellow-400 bg-yellow-400/10'
    case 'test':
      return 'text-green-400 bg-green-400/10'
    case 'docs':
      return 'text-purple-400 bg-purple-400/10'
    case 'refactor':
      return 'text-orange-400 bg-orange-400/10'
    case 'explain':
      return 'text-cyan-400 bg-cyan-400/10'
  }
}

/**
 * Individual prompt template component
 */
export const PromptTemplate: React.FC<PromptTemplateProps> = ({
  prompt,
  onSelect,
  onToggleFavorite,
  onPreview,
  className,
  compact = false
}) => {
  // ============================
  // State Management
  // ============================
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle prompt selection
   */
  const handleSelect = () => {
    if (onSelect) {
      onSelect(prompt)
    }
  }

  /**
   * Handle favorite toggle
   */
  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onToggleFavorite) {
      onToggleFavorite(prompt.id, !prompt.isFavorite)
    }
  }

  /**
   * Handle preview toggle
   */
  const handlePreviewToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowPreview(!showPreview)
    if (!showPreview && onPreview) {
      onPreview(prompt)
    }
  }

  /**
   * Handle expansion toggle
   */
  const handleExpansionToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  /**
   * Handle copy prompt to clipboard
   */
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(prompt.template)
      console.log('Prompt copied to clipboard')
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    }
  }

  /**
   * Truncate template for preview
   */
  const getTruncatedTemplate = (template: string, maxLength: number = 150) => {
    if (template.length <= maxLength) return template
    return template.substring(0, maxLength) + '...'
  }

  // ============================
  // Styles
  // ============================

  const itemStyles = cn(
    'group relative p-3 border border-vscode-dropdown-border rounded-md',
    'hover:bg-vscode-list-hoverBackground hover:border-vscode-focusBorder',
    'cursor-pointer transition-all duration-200',
    'focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder',
    compact && 'p-2',
    className
  )

  const categoryStyles = cn(
    'inline-flex items-center gap-1 px-2 py-1 rounded-full',
    'text-xs font-medium capitalize',
    getCategoryColor(prompt.category)
  )

  // ============================
  // Render
  // ============================

  return (
    <div 
      className={itemStyles}
      onClick={handleSelect}
      tabIndex={0}
      role="button"
      aria-label={`Select prompt: ${prompt.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-vscode-foreground truncate">
              {prompt.name}
            </h4>
            
            {/* Category Badge */}
            <span className={categoryStyles}>
              <Tag className="w-3 h-3" />
              {prompt.category}
            </span>
            
            {/* Popular Badge */}
            {prompt.usageCount > 50 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-vscode-badge-background text-vscode-badge-foreground rounded text-xs">
                <Star className="w-2.5 h-2.5" />
                Popular
              </span>
            )}
          </div>
          
          <p className="text-xs text-vscode-descriptionForeground line-clamp-2">
            {prompt.description}
          </p>
        </div>
        
        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className={cn(
            'flex-shrink-0 p-1 rounded transition-colors',
            'hover:bg-vscode-toolbar-hoverBackground',
            prompt.isFavorite 
              ? 'text-red-400 hover:text-red-300' 
              : 'text-vscode-descriptionForeground hover:text-vscode-foreground'
          )}
          title={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart 
            className={cn(
              'w-4 h-4',
              prompt.isFavorite && 'fill-current'
            )} 
          />
        </button>
      </div>

      {/* Template Preview */}
      {!compact && (
        <div className="mb-2">
          <div className="p-2 bg-vscode-textCodeBlock-background rounded border border-vscode-textPreformat-foreground/20">
            <pre className="text-xs text-vscode-textPreformat-foreground whitespace-pre-wrap font-mono">
              {showPreview || isExpanded 
                ? prompt.template 
                : getTruncatedTemplate(prompt.template)
              }
            </pre>
            
            {prompt.template.length > 150 && (
              <button
                onClick={handleExpansionToggle}
                className="mt-1 text-xs text-vscode-textLink hover:underline"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
        <div className="flex items-center gap-3">
          {/* Variables Count */}
          {prompt.variables.length > 0 && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {prompt.variables.length} var{prompt.variables.length > 1 ? 's' : ''}
            </span>
          )}
          
          {/* Usage Count */}
          <span className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            {prompt.usageCount} use{prompt.usageCount !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handlePreviewToggle}
            className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </button>
          
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground"
            title="Copy prompt to clipboard"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {prompt.tags.length > 0 && !compact && (
        <div className="mt-2 flex flex-wrap gap-1">
          {prompt.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-1.5 py-0.5 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded text-xs"
            >
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="px-1.5 py-0.5 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded text-xs">
              +{prompt.tags.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}