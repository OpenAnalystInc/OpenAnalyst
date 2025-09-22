/**
 * ToolsPopover
 * 
 * This component displays the Tools dropdown with categorized development tools,
 * status filtering, search functionality, and tool execution capabilities.
 * 
 * Features:
 * - Categorized development tools
 * - Status filtering (available, unavailable, error)
 * - Search across tools and descriptions
 * - Tool execution with parameter configuration
 * - Enable/disable tool toggles
 * - Tool statistics and status overview
 */

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { 
  Search,
  Filter,
  Settings,
  ExternalLink,
  X,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Play,
  Wrench
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

import { ToolOption, ToolCategory, ToolStatus } from '../types'
import { 
  mockToolsData, 
  getToolsByCategory, 
  getAvailableTools, 
  getEnabledTools,
  getToolsByStatus,
  searchTools,
  getToolStats,
  simulateToolExecution,
  simulateToolToggle
} from './mockToolsData'
import { ToolCategory as ToolCategoryComponent } from './ToolCategory'
import { ToolItem } from './ToolItem'

/**
 * Props for the ToolsPopover component
 */
interface ToolsPopoverProps {
  trigger: (props: { active: boolean }) => React.ReactNode
  onToolExecute?: (toolId: string, parameters: Record<string, any>) => void
  onToolConfigure?: (tool: ToolOption) => void
  onManageTools?: () => void
  className?: string
}

/**
 * Available tool categories
 */
const CATEGORIES: ToolCategory[] = ['file', 'search', 'web', 'terminal', 'git', 'database', 'ai']

/**
 * Status filter options
 */
const STATUS_FILTERS: { value: ToolStatus | 'all', label: string, icon?: any }[] = [
  { value: 'all', label: 'All Tools' },
  { value: 'available', label: 'Available', icon: CheckCircle },
  { value: 'unavailable', label: 'Unavailable', icon: AlertCircle },
  { value: 'error', label: 'Error', icon: XCircle }
]

/**
 * Main ToolsPopover component
 */
export const ToolsPopover: React.FC<ToolsPopoverProps> = ({
  trigger,
  onToolExecute,
  onToolConfigure,
  onManageTools,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<ToolStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'enabled' | 'available'>('all')
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set())

  // ============================
  // Computed Values
  // ============================

  /**
   * Filter tools based on search, status, and category
   */
  const filteredTools = useMemo(() => {
    let tools = mockToolsData

    // Apply search filter
    if (searchValue) {
      tools = searchTools(searchValue)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      tools = tools.filter(tool => tool.status === statusFilter)
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      tools = tools.filter(tool => tool.category === categoryFilter)
    }

    return tools
  }, [searchValue, statusFilter, categoryFilter])

  /**
   * Get available tools
   */
  const availableTools = useMemo(() => getAvailableTools(), [])

  /**
   * Get enabled tools
   */
  const enabledTools = useMemo(() => getEnabledTools(), [])

  /**
   * Get tool statistics
   */
  const toolStats = useMemo(() => getToolStats(), [])

  /**
   * Group tools by category
   */
  const toolsByCategory = useMemo(() => {
    const grouped: Record<ToolCategory, ToolOption[]> = {} as any
    
    CATEGORIES.forEach(category => {
      grouped[category] = filteredTools.filter(tool => tool.category === category)
    })
    
    return grouped
  }, [filteredTools])

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle tool execution with loading state
   */
  const handleToolExecute = async (toolId: string, parameters: Record<string, any>) => {
    setExecutingTools(prev => new Set(prev).add(toolId))
    
    try {
      const result = await simulateToolExecution(toolId, parameters)
      if (result.success) {
        console.log('Tool execution result:', result.result)
        onToolExecute?.(toolId, parameters)
      } else {
        console.error('Tool execution failed:', result.error)
      }
    } catch (error) {
      console.error('Tool execution error:', error)
    } finally {
      setExecutingTools(prev => {
        const next = new Set(prev)
        next.delete(toolId)
        return next
      })
    }
  }

  /**
   * Handle tool toggle with loading state
   */
  const handleToolToggle = async (toolId: string, enabled: boolean) => {
    try {
      const success = await simulateToolToggle(toolId)
      if (success) {
        console.log(`Tool ${toolId} ${enabled ? 'enabled' : 'disabled'}`)
      }
    } catch (error) {
      console.error('Tool toggle error:', error)
    }
  }

  /**
   * Handle tool configuration
   */
  const handleToolConfigure = (tool: ToolOption) => {
    console.log('Configure tool:', tool.name)
    onToolConfigure?.(tool)
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
    setStatusFilter('all')
    setCategoryFilter('all')
    setActiveTab('all')
  }

  // ============================
  // Render Helpers
  // ============================

  /**
   * Render All Tools tab content
   */
  const renderAllTools = () => (
    <div className="space-y-3">
      {CATEGORIES.map(category => {
        const categoryTools = toolsByCategory[category]
        if (categoryTools.length === 0) return null
        
        return (
          <ToolCategoryComponent
            key={category}
            category={category}
            tools={categoryTools}
            onExecuteTool={handleToolExecute}
            onToggleTool={handleToolToggle}
            onConfigureTool={handleToolConfigure}
            executingTools={executingTools}
            defaultExpanded={CATEGORIES.indexOf(category) < 2} // Expand first 2 categories
            compact={false}
          />
        )
      })}
    </div>
  )

  /**
   * Render Enabled Tools tab content
   */
  const renderEnabledTools = () => (
    <div className="space-y-2">
      {enabledTools.length === 0 ? (
        <div className="text-center py-8 text-vscode-descriptionForeground">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">No tools enabled</div>
          <div className="text-xs mt-1">Enable tools from the All Tools tab to see them here</div>
        </div>
      ) : (
        enabledTools.map((tool) => (
          <ToolItem
            key={tool.id}
            tool={tool}
            onExecute={handleToolExecute}
            onToggle={handleToolToggle}
            onConfigure={handleToolConfigure}
            isExecuting={executingTools.has(tool.id)}
            compact={false}
          />
        ))
      )}
    </div>
  )

  /**
   * Render Available Tools tab content
   */
  const renderAvailableTools = () => (
    <div className="space-y-2">
      {availableTools.map((tool) => (
        <ToolItem
          key={tool.id}
          tool={tool}
          onExecute={handleToolExecute}
          onToggle={handleToolToggle}
          onConfigure={handleToolConfigure}
          isExecuting={executingTools.has(tool.id)}
          compact={true}
        />
      ))}
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
          title="Tools - Access development tools"
        >
          <Wrench className="w-4 h-4" />
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
              Development Tools
            </h3>
            <button
              onClick={handleClose}
              className="text-vscode-descriptionForeground hover:text-vscode-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-vscode-descriptionForeground mt-1">
            Access development tools and utilities
          </p>
        </div>

        {/* Search and Filters */}
        <div className="px-4 py-3 border-b border-vscode-dropdown-border space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-vscode-descriptionForeground" />
            <Input
              placeholder="Search tools..."
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

          {/* Filters Row */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-vscode-descriptionForeground flex-shrink-0" />
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ToolStatus | 'all')}
              className="flex-1 min-w-0 h-7 px-2 text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded truncate"
            >
              {STATUS_FILTERS.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ToolCategory | 'all')}
              className="flex-1 min-w-0 h-7 px-2 text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded truncate"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            
            {(searchValue || statusFilter !== 'all' || categoryFilter !== 'all') && (
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
              <span className="truncate">All ({filteredTools.length})</span>
            </TabsTrigger>
            <TabsTrigger value="enabled" className="flex-1">
              <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Enabled ({enabledTools.length})</span>
            </TabsTrigger>
            <TabsTrigger value="available" className="flex-1">
              <Play className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Available ({availableTools.length})</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <TabsContent value="all" className="mt-3">
              {renderAllTools()}
            </TabsContent>
            
            <TabsContent value="enabled" className="mt-3">
              {renderEnabledTools()}
            </TabsContent>
            
            <TabsContent value="available" className="mt-3">
              {renderAvailableTools()}
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
              onClick={onManageTools}
              className="flex-1 h-8 text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Manage Tools
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="flex-1 h-8 text-xs"
            >
              <Wrench className="w-3 h-3 mr-1" />
              Close
            </Button>
          </div>

          {/* Statistics */}
          <div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
            <div className="flex items-center gap-3">
              <span>{filteredTools.length} of {toolStats.total} tools</span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {toolStats.available} available
              </span>
            </div>
            <span>
              {toolStats.enabled} enabled
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}