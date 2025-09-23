/**
 * RulesPopover
 * 
 * This component displays the Rules dropdown with active coding rules,
 * source filtering, and rule management functionality.
 * 
 * Features:
 * - List of active and inactive rules
 * - Source-based filtering (Global, Project, User, etc.)
 * - Enable/disable rule toggles
 * - Rule statistics and counts
 * - Search functionality for large rule sets
 * - Rule creation and management shortcuts
 */

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { 
  Plus,
  Search,
  Filter,
  FileText,
  RotateCcw,
  ExternalLink,
  X
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'

import { Rule, RuleSource } from '../types'
import { mockRulesData, getRuleStats, simulateRuleToggle, getActiveRules } from './mockRulesData'
import { RuleItem } from './RuleItem'

/**
 * Props for the RulesPopover component
 */
interface RulesPopoverProps {
  onRuleToggle?: (ruleId: string, enabled: boolean) => void
  onCreateRule?: () => void
  onManageRules?: () => void
  className?: string
}

/**
 * Filter options for rule sources
 */
const SOURCE_FILTERS: { value: RuleSource | 'all', label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'global', label: 'Global' },
  { value: 'project', label: 'Project' },
  { value: 'user', label: 'User' },
  { value: 'model', label: 'Model' },
  { value: 'workspace', label: 'Workspace' }
]

/**
 * Main RulesPopover component
 */
export const RulesPopover: React.FC<RulesPopoverProps> = ({
  onRuleToggle,
  onCreateRule,
  onManageRules,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [sourceFilter, setSourceFilter] = useState<RuleSource | 'all'>('all')
  const [loadingRules, setLoadingRules] = useState<Set<string>>(new Set())

  // ============================
  // Computed Values
  // ============================

  /**
   * Filter and search rules based on current filters
   */
  const filteredRules = useMemo(() => {
    let rules = mockRulesData

    // Filter by source
    if (sourceFilter !== 'all') {
      rules = rules.filter(rule => rule.source === sourceFilter)
    }

    // Filter by search term
    if (searchValue) {
      const searchLower = searchValue.toLowerCase()
      rules = rules.filter(rule =>
        rule.name.toLowerCase().includes(searchLower) ||
        rule.description.toLowerCase().includes(searchLower) ||
        rule.content.toLowerCase().includes(searchLower)
      )
    }

    // Sort by priority (highest first) and then by name
    return rules.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.name.localeCompare(b.name)
    })
  }, [sourceFilter, searchValue])

  /**
   * Get rule statistics
   */
  const ruleStats = useMemo(() => getRuleStats(), [])
  
  /**
   * Get count of active rules for badge display
   */
  const activeRulesCount = getActiveRules().length

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle rule toggle with loading state
   */
  const handleRuleToggle = async (ruleId: string, enabled: boolean) => {
    setLoadingRules(prev => new Set(prev).add(ruleId))
    
    try {
      await simulateRuleToggle(ruleId)
      onRuleToggle?.(ruleId, enabled)
    } catch (error) {
      console.error('Rule toggle failed:', error)
    } finally {
      setLoadingRules(prev => {
        const next = new Set(prev)
        next.delete(ruleId)
        return next
      })
    }
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
    setSourceFilter('all')
  }

  // ============================
  // Render
  // ============================

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
      <button 
         className={`flex items-center justify-center w-8 h-8 text-white rounded transition-all duration-200 ease-in-out ${
          open 
            ? 'bg-[rgba(255,255,255,0.20)] border-[rgba(255,255,255,0.2)] shadow-sm' 
            : 'bg-transparent border-transparent hover:bg-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.1)] hover:shadow-sm'
        }`}
         style={{ position: 'relative' }}
         title="Rules - Manage coding guidelines and best practices"
       >
         <FileText className="w-4 h-4" />
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
        <div className="px-3 py-2 border-b border-vscode-dropdown-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-vscode-foreground">
              Coding Rules
            </h3>
            <button
              onClick={handleClose}
              className="text-vscode-descriptionForeground hover:text-vscode-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-vscode-descriptionForeground mt-1">
            Manage coding guidelines and best practices
          </p>
        </div>

        {/* Search and Filters */}
        <div className="px-3 py-2 border-b border-vscode-dropdown-border space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-vscode-descriptionForeground" />
            <Input
              placeholder="Search rules..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
            {searchValue && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-vscode-descriptionForeground" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as RuleSource | 'all')}
              className="flex-1 h-6 px-2 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
            >
              {SOURCE_FILTERS.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            
            {(searchValue || sourceFilter !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="text-vscode-descriptionForeground hover:text-vscode-foreground"
                title="Reset filters"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Rules List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRules.length === 0 ? (
            <div className="px-3 py-8 text-center text-vscode-descriptionForeground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">
                {searchValue || sourceFilter !== 'all' 
                  ? 'No rules match your filters'
                  : 'No rules configured'
                }
              </div>
              <div className="text-xs mt-1">
                {searchValue || sourceFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first coding rule to get started'
                }
              </div>
            </div>
          ) : (
            <div>
              {filteredRules.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  onToggle={handleRuleToggle}
                  isLoading={loadingRules.has(rule.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-vscode-dropdown-border">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onCreateRule}
              className="flex-1 h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Create Rule
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onManageRules}
              className="flex-1 h-7 text-xs"
            >
              <FileText className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </div>

          {/* Statistics */}
          <div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
            <span>
              {filteredRules.length} of {ruleStats.total} rules
            </span>
            <span>
              {ruleStats.active} active
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}