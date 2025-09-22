/**
 * PromptsPopover
 * This component displays the Prompts dropdown with categorized prompt templates,
 * search functionality, favorites, and quick access to commonly used prompts.
 * 
 * Features:
 * - Categorized prompt templates
 * - Search across prompts, descriptions, and tags
 * - Favorite prompts section
 * - Most used prompts section
 * - Template variable preview
 * - Quick insert functionality
 */

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { 
  Search,
  Star,
  TrendingUp,
  Plus,
  Settings,
  ExternalLink,
  X,
  Filter,
  RotateCcw,
  MessageSquare
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

import { PromptTemplate as PromptTemplateType, PromptCategory } from '../types'
import { 
  mockPromptsData, 
  getPromptsByCategory, 
  getFavoritePrompts, 
  getMostUsedPrompts,
  searchPrompts,
  getPromptStats,
  simulatePromptUsage
} from './mockPromptsData'
import { PromptCategory as PromptCategoryComponent } from './PromptCategory'
import { PromptTemplate } from './PromptTemplate'

/**
 * Props for the PromptsPopover component
 */
interface PromptsPopoverProps {
  trigger: (props: { active: boolean }) => React.ReactNode
  onPromptSelect?: (prompt: PromptTemplateType) => void
  onCreatePrompt?: () => void
  onManagePrompts?: () => void
  className?: string
}

/**
 * Available prompt categories
 */
const CATEGORIES: PromptCategory[] = ['code', 'debug', 'review', 'test', 'docs', 'refactor', 'explain']

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
  const [categoryFilter, setCategoryFilter] = useState<PromptCategory | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recent'>('all')

  // ============================
  // Computed Values
  // ============================

  /**
   * Filter prompts based on search and category
   */
  const filteredPrompts = useMemo(() => {
    let prompts = mockPromptsData

    // Apply search filter
    if (searchValue) {
      prompts = searchPrompts(searchValue)
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      prompts = prompts.filter(prompt => prompt.category === categoryFilter)
    }

    return prompts
  }, [searchValue, categoryFilter])

  /**
   * Get favorite prompts
   */
  const favoritePrompts = useMemo(() => getFavoritePrompts(), [])

  /**
   * Get most used prompts
   */
  const mostUsedPrompts = useMemo(() => getMostUsedPrompts(8), [])

  /**
   * Get prompt statistics
   */
  const promptStats = useMemo(() => getPromptStats(), [])

  /**
   * Group prompts by category
   */
  const promptsByCategory = useMemo(() => {
    const grouped: Record<PromptCategory, PromptTemplateType[]> = {} as any
    
    CATEGORIES.forEach(category => {
      grouped[category] = filteredPrompts.filter(prompt => prompt.category === category)
    })
    
    return grouped
  }, [filteredPrompts])

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle prompt selection with usage tracking
   */
  const handlePromptSelect = async (prompt: PromptTemplateType) => {
    try {
      await simulatePromptUsage(prompt.id)
      onPromptSelect?.(prompt)
      setOpen(false)
    } catch (error) {
      console.error('Failed to track prompt usage:', error)
      onPromptSelect?.(prompt)
      setOpen(false)
    }
  }

  /**
   * Handle favorite toggle
   */
  const handleToggleFavorite = (promptId: string, isFavorite: boolean) => {
    const prompt = mockPromptsData.find(p => p.id === promptId)
    if (prompt) {
      prompt.isFavorite = isFavorite
      console.log(`Prompt ${promptId} ${isFavorite ? 'added to' : 'removed from'} favorites`)
    }
  }

  /**
   * Handle prompt preview
   */
  const handlePromptPreview = (prompt: PromptTemplateType) => {
    console.log('Preview prompt:', prompt.name)
    // Could open a larger preview modal here
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
    setActiveTab('all')
  }

  // ============================
  // Render Helpers
  // ============================

  /**
   * Render All Prompts tab content
   */
  const renderAllPrompts = () => (
    <div className="space-y-3">
      {CATEGORIES.map(category => {
        const categoryPrompts = promptsByCategory[category]
        if (categoryPrompts.length === 0) return null
        
        return (
          <PromptCategoryComponent
            key={category}
            category={category}
            prompts={categoryPrompts}
            onSelectPrompt={handlePromptSelect}
            onToggleFavorite={handleToggleFavorite}
            onPreviewPrompt={handlePromptPreview}
            defaultExpanded={CATEGORIES.indexOf(category) < 2} // Expand first 2 categories
            compact={false}
          />
        )
      })}
    </div>
  )

  /**
   * Render Favorites tab content
   */
  const renderFavorites = () => (
    <div className="space-y-2">
      {favoritePrompts.length === 0 ? (
        <div className="text-center py-8 text-vscode-descriptionForeground">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">No favorite prompts yet</div>
          <div className="text-xs mt-1">Click the heart icon on any prompt to add it to favorites</div>
        </div>
      ) : (
        favoritePrompts.map((prompt) => (
          <PromptTemplate
            key={prompt.id}
            prompt={prompt}
            onSelect={handlePromptSelect}
            onToggleFavorite={handleToggleFavorite}
            onPreview={handlePromptPreview}
            compact={false}
          />
        ))
      )}
    </div>
  )

  /**
   * Render Recent/Most Used tab content
   */
  const renderRecent = () => (
    <div className="space-y-2">
      {mostUsedPrompts.length === 0 ? (
        <div className="text-center py-8 text-vscode-descriptionForeground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">No usage data yet</div>
          <div className="text-xs mt-1">Start using prompts to see your most used ones here</div>
        </div>
      ) : (
        mostUsedPrompts.map((prompt) => (
          <PromptTemplate
            key={prompt.id}
            prompt={prompt}
            onSelect={handlePromptSelect}
            onToggleFavorite={handleToggleFavorite}
            onPreview={handlePromptPreview}
            compact={true}
          />
        ))
      )}
    </div>
  )

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
              <ExternalLink className="w-4 h-4" />
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
              onChange={(e) => setCategoryFilter(e.target.value as PromptCategory | 'all')}
              className="flex-1 min-w-0 h-7 px-2 text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded truncate"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(category => (
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex mx-3 mt-3 mb-2">
            <TabsTrigger value="all" className="flex-1">
              <span className="truncate">All ({filteredPrompts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1">
              <Star className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Favorites ({favoritePrompts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex-1">
              <TrendingUp className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Popular</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <TabsContent value="all" className="mt-3">
              {renderAllPrompts()}
            </TabsContent>
            
            <TabsContent value="favorites" className="mt-3">
              {renderFavorites()}
            </TabsContent>
            
            <TabsContent value="recent" className="mt-3">
              {renderRecent()}
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
              {filteredPrompts.length} of {promptStats.total} prompts
            </span>
            <span>
              {promptStats.favorites} favorites
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}