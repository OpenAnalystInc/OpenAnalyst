/**
 * PromptCategory - Category grouping component for organizing prompts
 * 
 * This component groups prompt templates by category with collapsible sections,
 * category descriptions, and prompt counts for better organization.
 * 
 * Features:
 * - Collapsible category sections
 * - Category icons and descriptions
 * - Prompt counts per category
 * - Quick access to category favorites
 * - Compact and expanded view modes
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  ChevronDown,
  ChevronRight,
  Code,
  Bug,
  FileText,
  TestTube,
  BookOpen,
  RefreshCw,
  HelpCircle,
  Star,
  Hash
} from 'lucide-react'

import { PromptTemplate as PromptTemplateType, PromptCategory as PromptCategoryType } from '../types'
import { PromptTemplate } from './PromptTemplate'

/**
 * Props for the PromptCategory component
 */
interface PromptCategoryProps {
  category: PromptCategoryType
  prompts: PromptTemplateType[]
  onSelectPrompt?: (prompt: PromptTemplateType) => void
  onToggleFavorite?: (promptId: string, isFavorite: boolean) => void
  onPreviewPrompt?: (prompt: PromptTemplateType) => void
  defaultExpanded?: boolean
  compact?: boolean
  className?: string
}

/**
 * Category configuration with icons and descriptions
 */
const CATEGORY_CONFIG = {
  code: {
    icon: Code,
    title: 'Code Generation',
    description: 'Create functions, classes, and code structures',
    color: 'text-blue-400'
  },
  debug: {
    icon: Bug,
    title: 'Debugging',
    description: 'Analyze errors and performance issues',
    color: 'text-red-400'
  },
  review: {
    icon: FileText,
    title: 'Code Review',
    description: 'Security reviews and code quality checks',
    color: 'text-yellow-400'
  },
  test: {
    icon: TestTube,
    title: 'Testing',
    description: 'Generate unit tests and test scenarios',
    color: 'text-green-400'
  },
  docs: {
    icon: BookOpen,
    title: 'Documentation',
    description: 'API docs, README files, and guides',
    color: 'text-purple-400'
  },
  refactor: {
    icon: RefreshCw,
    title: 'Refactoring',
    description: 'Extract patterns and improve code structure',
    color: 'text-orange-400'
  },
  explain: {
    icon: HelpCircle,
    title: 'Code Explanation',
    description: 'Understand and analyze complex code',
    color: 'text-cyan-400'
  }
}

/**
 * Prompt category grouping component
 */
export const PromptCategory: React.FC<PromptCategoryProps> = ({
  category,
  prompts,
  onSelectPrompt,
  onToggleFavorite,
  onPreviewPrompt,
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
  const favoritePrompts = prompts.filter(p => p.isFavorite)
  const totalUsage = prompts.reduce((sum, p) => sum + p.usageCount, 0)

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
   * Handle prompt selection
   */
  const handleSelectPrompt = (prompt: PromptTemplateType) => {
    onSelectPrompt?.(prompt)
  }

  /**
   * Handle favorite toggle
   */
  const handleToggleFavorite = (promptId: string, isFavorite: boolean) => {
    onToggleFavorite?.(promptId, isFavorite)
  }

  /**
   * Handle prompt preview
   */
  const handlePreviewPrompt = (prompt: PromptTemplateType) => {
    onPreviewPrompt?.(prompt)
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
  // Render
  // ============================

  if (prompts.length === 0) {
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
        <div className="flex items-center gap-3 text-xs text-vscode-descriptionForeground">
          {/* Favorites Count */}
          {favoritePrompts.length > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {favoritePrompts.length}
            </span>
          )}
          
          {/* Prompt Count */}
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {prompts.length}
          </span>
          
          {/* Total Usage */}
          {!compact && totalUsage > 0 && (
            <span className="text-xs">
              {totalUsage} uses
            </span>
          )}
        </div>
      </div>

      {/* Category Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Show favorites first */}
          {favoritePrompts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-medium text-vscode-foreground">
                  Favorites
                </span>
              </div>
              <div className="space-y-2">
                {favoritePrompts.map((prompt) => (
                  <PromptTemplate
                    key={prompt.id}
                    prompt={prompt}
                    onSelect={handleSelectPrompt}
                    onToggleFavorite={handleToggleFavorite}
                    onPreview={handlePreviewPrompt}
                    compact={compact}
                  />
                ))}
              </div>
              
              {/* Separator if there are non-favorite prompts */}
              {prompts.length > favoritePrompts.length && (
                <div className="border-t border-vscode-dropdown-border my-3" />
              )}
            </div>
          )}
          
          {/* Show all other prompts */}
          <div className="space-y-2">
            {prompts
              .filter(p => !p.isFavorite)
              .map((prompt) => (
                <PromptTemplate
                  key={prompt.id}
                  prompt={prompt}
                  onSelect={handleSelectPrompt}
                  onToggleFavorite={handleToggleFavorite}
                  onPreview={handlePreviewPrompt}
                  compact={compact}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}