/**
 * ModelsPopover
 * This component displays the Models dropdown with categories for
 * Chat, Autocomplete, Edit, and Apply models.
 * 
 * Features:
 * - Four model categories with setup status
 * - Individual model configuration options
 * - Setup buttons for unconfigured models
 * - Default model selection
 * - Provider icons and status indicators
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  Check, 
  Settings, 
  ExternalLink, 
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { Button } from '@/components/ui'

import { ModelsData, ModelConfig, ModelCategory } from '../types'
import { mockModelsData, getCategorySetupStatus, simulateModelSetup } from './mockModelsData'

/**
 * Props for the ModelsPopover component
 */
interface ModelsPopoverProps {
  trigger: (props: { active: boolean }) => React.ReactNode
  onModelSelect?: (model: ModelConfig) => void
  onModelSetup?: (modelId: string, category: ModelCategory) => void
  className?: string
}

/**
 * Props for ModelCategorySection component
 */
interface ModelCategorySectionProps {
  category: ModelCategory
  data: ModelsData['categories'][ModelCategory]
  onModelSelect?: (model: ModelConfig) => void
  onSetupClick?: (modelId: string, category: ModelCategory) => void
  isLoading?: boolean
}

/**
 * Individual model category section component
 */
const ModelCategorySection: React.FC<ModelCategorySectionProps> = ({
  category,
  data,
  onModelSelect,
  onSetupClick,
  isLoading = false
}) => {
  const setupStatus = getCategorySetupStatus(category)
  const defaultModel = data.models.find(m => m.isDefault)

  /**
   * Handle setup button click
   */
  const handleSetupClick = () => {
    if (onSetupClick && !isLoading) {
      // Find first model that needs setup or use default model
      const modelToSetup = data.models.find(m => !m.isSetup) || data.models[0]
      if (modelToSetup) {
        onSetupClick(modelToSetup.id, category)
      }
    }
  }

  /**
   * Get status icon based on setup status
   */
  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-vscode-foreground" />
    }
    
    switch (setupStatus) {
      case 'complete':
        return <Check className="w-4 h-4 text-vscode-testing-passedForeground" />
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-vscode-editorWarning-foreground" />
      case 'none':
        return <Settings className="w-4 h-4 text-vscode-descriptionForeground" />
    }
  }

  return (
    <div className="px-3 py-2 border-b border-vscode-dropdown-border last:border-b-0">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <div className="font-medium text-sm text-vscode-foreground">
              {data.name}
            </div>
            {defaultModel && (
              <div className="text-xs text-vscode-descriptionForeground">
                Current: {defaultModel.name}
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-vscode-descriptionForeground" />
      </div>

      {/* Setup Button */}
      <Button
        variant="secondary"
        size="sm"
        className={cn(
          'w-full justify-start text-left h-8',
          'bg-vscode-button-secondaryBackground',
          'hover:bg-vscode-button-secondaryHoverBackground',
          'text-vscode-button-secondaryForeground',
          'border border-vscode-button-border'
        )}
        onClick={handleSetupClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            <Settings className="w-3 h-3 mr-2" />
            Setup {data.name} model
          </>
        )}
      </Button>
    </div>
  )
}

/**
 * Main ModelsPopover component
 */
export const ModelsPopover: React.FC<ModelsPopoverProps> = ({
  trigger,
  onModelSelect,
  onModelSetup,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  const [open, setOpen] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState<Set<ModelCategory>>(new Set())

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle model setup with loading state
   */
  const handleModelSetup = async (modelId: string, category: ModelCategory) => {
    setLoadingCategories(prev => new Set(prev).add(category))
    
    try {
      await simulateModelSetup(modelId)
      onModelSetup?.(modelId, category)
    } catch (error) {
      console.error('Model setup failed:', error)
    } finally {
      setLoadingCategories(prev => {
        const next = new Set(prev)
        next.delete(category)
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

  // ============================
  // Render
  // ============================

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="flex items-center justify-center w-8 h-8 border border-gray-600 bg-gray-700 text-white rounded hover:bg-gray-600"
          style={{ position: 'relative' }}
          title="Models - Configure chat, autocomplete, edit and apply models"
        >
          <Settings className="w-4 h-4" />
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
              Models
            </h3>
            <button
              onClick={handleClose}
              className="text-vscode-descriptionForeground hover:text-vscode-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-vscode-descriptionForeground mt-1">
            Configure AI models for different use cases
          </p>
        </div>

        {/* Model Categories */}
        <div className="flex-1 overflow-y-auto">
          {(Object.keys(mockModelsData.categories) as ModelCategory[]).map(category => (
            <ModelCategorySection
              key={category}
              category={category}
              data={mockModelsData.categories[category]}
              onModelSelect={onModelSelect}
              onSetupClick={handleModelSetup}
              isLoading={loadingCategories.has(category)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-vscode-dropdown-border">
          <div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
            <span>4 categories available</span>
            <span>
              {Object.values(mockModelsData.categories)
                .reduce((acc, cat) => acc + cat.models.filter(m => m.isSetup).length, 0)} 
              {' '}configured
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}