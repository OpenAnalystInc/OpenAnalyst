/**
 * PromptsPopover - REDESIGNED IN PHASE 3
 * 
 * This component now displays YAML prompt blocks from the extension backend
 * instead of mock data. It maintains the same interface as before to ensure
 * compatibility with existing toolbar integration.
 * 
 * NEW Features (Phase 3):
 * - Displays real YAML prompts from defaults/blocks/prompts/
 * - Default/Custom tabs for source-based categorization
 * - Category grouping within each tab (analysis, visualization, etc.)
 * - Integration with PromptBlocksContext for state management
 * - Active prompt indicators
 * - Loading and empty states
 * 
 * PRESERVED Features:
 * - Same PromptsPopover interface for toolbar compatibility
 * - Search functionality across prompts
 * - Responsive design and accessibility
 */

import React, { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { 
  Search,
  Settings,
  Plus,
  X,
  Filter,
  RotateCcw,
  MessageSquare,
  Loader2,
  FolderOpen
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

// NEW: Import YAML prompt block types and context
import { PromptBlockInfo } from '@/utils/prompt-blocks'
import { usePromptBlocks } from '@/context/PromptBlocksContext'
import { promptActivationService } from '@/services/PromptActivationService'
import { PromptBlockCard } from './PromptBlockCard'

/**
 * Props for the PromptsPopover component - UPDATED IN PHASE 3
 * 
 * Changed from mock PromptTemplateType to real PromptBlockInfo
 */
interface PromptsPopoverProps {
  trigger: (props: { active: boolean }) => React.ReactNode
  onPromptSelect?: (prompt: PromptBlockInfo) => void  // CHANGED: Now uses PromptBlockInfo
  onCreatePrompt?: () => void
  onManagePrompts?: () => void
  className?: string
}

/**
 * Available YAML prompt categories from domain model
 * These match the categories in PromptCategory.ts: analysis, visualization, reporting, methodology
 */
const YAML_PROMPT_CATEGORIES = ['analysis', 'visualization', 'reporting', 'methodology'] as const
type YamlPromptCategory = typeof YAML_PROMPT_CATEGORIES[number]

/**
 * Main PromptsPopover component
 */
export const PromptsPopover: React.FC<PromptsPopoverProps> = ({
  trigger,
  onPromptSelect,
  onCreatePrompt,
  onManagePrompts,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<YamlPromptCategory | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
  const [isLoading, setIsLoading] = useState(false)

  // PHASE 4.4 ENHANCED: Access enhanced YAML prompt blocks from context
  const { 
    availableBlocks, 
    activeBlocks, 
    defaultBlocks, 
    customBlocks,
    isLoading: contextLoading
  } = usePromptBlocks()

  // ============================
  // Computed Values
  // ============================

  // PHASE 4.4 ENHANCEMENT: Use categorized blocks directly from context (no need for useMemo)
  // The context now provides defaultBlocks and customBlocks directly

  /**
   * Get current tab blocks based on active tab
   */
  const currentTabBlocks = useMemo(() => {
    return activeTab === 'default' ? defaultBlocks : customBlocks
  }, [activeTab, defaultBlocks, customBlocks])

  /**
   * Filter prompts based on search and category
   */
  const filteredBlocks = useMemo(() => {
    let blocks = currentTabBlocks

    // Apply search filter
    if (searchValue) {
      blocks = blocks.filter(block => 
        block.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        block.description?.toLowerCase().includes(searchValue.toLowerCase()) ||
        block.category.toLowerCase().includes(searchValue.toLowerCase())
      )
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      blocks = blocks.filter(block => block.category === categoryFilter)
    }

    return blocks
  }, [currentTabBlocks, searchValue, categoryFilter])

  /**
   * Group blocks by category for organized display
   */
  const blocksByCategory = useMemo(() => {
    const grouped: Record<YamlPromptCategory, PromptBlockInfo[]> = {} as any
    
    YAML_PROMPT_CATEGORIES.forEach(category => {
      grouped[category] = filteredBlocks.filter(block => block.category === category)
    })
    
    return grouped
  }, [filteredBlocks])

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle prompt block selection - integrates with activation service
   */
  const handleBlockSelect = async (block: PromptBlockInfo) => {
    try {
      setIsLoading(true)
      onPromptSelect?.(block)
      setOpen(false)
    } catch (error) {
      console.error('Failed to select prompt block:', error)
      // Still close the popover even if tracking fails
      onPromptSelect?.(block)
      setOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle favorite toggle - TODO: Implement user preferences storage
   */
  const handleToggleFavorite = (blockName: string, isFavorite: boolean) => {
    console.log(`Block ${blockName} ${isFavorite ? 'added to' : 'removed from'} favorites`)
    // TODO: Implement favorite storage in user preferences
  }

  /**
   * Handle prompt block preview
   */
  const handleBlockPreview = (block: PromptBlockInfo) => {
    console.log('Preview block:', block.name)
    // TODO: Implement preview modal showing full block content and variables
  }

  /**
   * Handle popover close
   */
  const handleClose = () => {
    setOpen(false)
  }

  /**
   * Clear search input
   */
  const handleClearSearch = () => {
    setSearchValue('')
  }

  /**
   * Reset all filters
   */
  const handleResetFilters = () => {
    setSearchValue('')
    setCategoryFilter('all')
  }

  // ============================
  // Render Helpers
  // ============================

  /**
   * Render blocks grouped by category
   */
  const renderBlocksByCategory = () => {
    if (contextLoading || isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-vscode-descriptionForeground" />
          <span className="ml-2 text-sm text-vscode-descriptionForeground">Loading prompts...</span>
        </div>
      )
    }

    if (filteredBlocks.length === 0) {
      return (
        <div className="text-center py-8 text-vscode-descriptionForeground">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">
            {searchValue || categoryFilter !== 'all' 
              ? 'No prompts match your filters' 
              : `No ${activeTab} prompts available`}
          </div>
          <div className="text-xs mt-1">
            {searchValue || categoryFilter !== 'all'
              ? 'Try adjusting your search or category filter'
              : activeTab === 'custom' 
                ? 'Create custom prompts to see them here'
                : 'Default prompts will appear here when available'}
          </div>
        </div>
      )
    }

    // Group by category for better organization
    const hasMultipleCategories = Object.values(blocksByCategory).filter(blocks => blocks.length > 0).length > 1
    
    return (
      <div className="space-y-4">
        {YAML_PROMPT_CATEGORIES.map(category => {
          const categoryBlocks = blocksByCategory[category]
          if (categoryBlocks.length === 0) return null
          
          return (
            <div key={category}>
              {/* Category Header (only show if multiple categories) */}
              {hasMultipleCategories && (
                <h4 className="text-xs font-medium text-vscode-descriptionForeground uppercase tracking-wide mb-2">
                  {category} ({categoryBlocks.length})
                </h4>
              )}
              
              {/* Category Blocks */}
              <div className="space-y-2">
                {categoryBlocks.map((block) => (
                  <PromptBlockCard
                    key={block.name}
                    promptBlock={block}
                    onSelect={handleBlockSelect}
                    onPreview={handleBlockPreview}
                    onToggleFavorite={handleToggleFavorite}
                    compact={false}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ============================
  // Render
  // ============================

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="flex items-center justify-center w-8 h-8 border border-gray-600 bg-gray-700 text-white rounded hover:bg-gray-600"
          style={{ position: 'relative' }}
          title="Prompts - Quick access to prompt templates"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      
      <PopoverContent 
        align="start" 
        className={cn(
          'w-80 max-w-[90vw] max-h-[70vh] p-0',
          'bg-vscode-dropdown-background',
          'border border-vscode-dropdown-border',
          'shadow-lg',
          'flex flex-col',
          className
        )}
        onEscapeKeyDown={handleClose}
      >
        {/* Header */}
        <div className="px-4 pt-2 border-b border-vscode-dropdown-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-vscode-foreground">
              Prompt Templates
            </h3>
            <button
              onClick={handleClose}
              className="text-vscode-descriptionForeground hover:text-vscode-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-vscode-descriptionForeground mt-1">
            Quick access to coding prompt templates
          </p>
        </div>

        {/* Search and Filters */}
        <div className="px-4 py-3 border-b border-vscode-dropdown-border space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-vscode-descriptionForeground" />
            <Input
              placeholder="Search prompts..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {searchValue && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-vscode-descriptionForeground flex-shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as YamlPromptCategory | 'all')}
              className="flex-1 min-w-0 h-7 px-2 text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded truncate"
            >
              <option value="all">All Categories</option>
              {YAML_PROMPT_CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            
            {(searchValue || categoryFilter !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="text-vscode-descriptionForeground hover:text-vscode-foreground flex-shrink-0 p-1"
                title="Reset filters"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs - Default vs Custom */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex mx-3 mt-3 mb-2">
            <TabsTrigger value="default" className="flex-1">
              <FolderOpen className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Default ({defaultBlocks.length})</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">
              <Settings className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Custom ({customBlocks.length})</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <TabsContent value="default" className="mt-3">
              {renderBlocksByCategory()}
            </TabsContent>
            
            <TabsContent value="custom" className="mt-3">
              {renderBlocksByCategory()}
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-vscode-dropdown-border mt-2">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onCreatePrompt}
              className="flex-1 h-8 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Create Prompt
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onManagePrompts}
              className="flex-1 h-8 text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </div>

          {/* Statistics */}
          <div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
            <span>
              {filteredBlocks.length} of {availableBlocks.length} prompts
            </span>
            <span>
              {activeBlocks.length} active
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}