/**
 * PromptBlockCard - NEW COMPONENT IN PHASE 3.2
 * 
 * Displays individual YAML prompt blocks from the extension backend.
 * Replaces the old PromptTemplate component to work with real PromptBlockInfo data.
 * 
 * Features:
 * - Displays YAML prompt block information (name, category, description)
 * - Shows active state indicators when block is activated
 * - Integrates with PromptActivationService for block activation
 * - Supports category-based styling and icons
 * - Compact and expanded display modes
 * - Loading states for activation process
 */

import { cn } from '@/lib/utils'
import { 
  MessageSquare,
  BarChart3,
  FileText,
  Settings,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { PromptBlockInfo } from '@/utils/prompt-blocks'
import { usePromptBlocks } from '@/context/PromptBlocksContext'

/**
 * Props for the PromptBlockCard component
 */
interface PromptBlockCardProps {
  /** The YAML prompt block to display */
  promptBlock: PromptBlockInfo
  /** Callback when block is selected/activated */
  onSelect?: (block: PromptBlockInfo) => void
  /** Callback when preview is requested */
  onPreview?: (block: PromptBlockInfo) => void
  /** Callback when favorite is toggled */
  onToggleFavorite?: (blockName: string, isFavorite: boolean) => void
  /** Whether to show in compact mode */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Get category-specific icon for prompt blocks
 */
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'analysis':
      return BarChart3
    case 'visualization':
      return BarChart3
    case 'reporting':
      return FileText
    case 'methodology':
      return Settings
    default:
      return MessageSquare
  }
}

/**
 * Get category-specific color classes
 */
const getCategoryColors = (category: string) => {
  switch (category) {
    case 'analysis':
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        icon: 'text-blue-400'
      }
    case 'visualization':
      return {
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        text: 'text-green-400',
        icon: 'text-green-400'
      }
    case 'reporting':
      return {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        icon: 'text-purple-400'
      }
    case 'methodology':
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        icon: 'text-orange-400'
      }
    default:
      return {
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        text: 'text-gray-400',
        icon: 'text-gray-400'
      }
  }
}

/**
 * Main PromptBlockCard component
 */
export const PromptBlockCard: React.FC<PromptBlockCardProps> = ({
  promptBlock,
  onSelect,
  compact = false,
  className
}) => {
  // ============================
  // State Management
  // ============================
  
  // Import all required methods for unified activation handler
  const { 
    activeBlocks, 
    availableBlocks,
    isBlockActive,
    getActivationState,
    toggleActiveBlock,
    getConflictInfo,
    addActiveBlock
  } = usePromptBlocks()

  // ============================
  // Computed Values
  // ============================
  
  const CategoryIcon = getCategoryIcon(promptBlock.category)
  const categoryColors = getCategoryColors(promptBlock.category)
  
  // PHASE 4.4 NEW: Use enhanced context methods for better sync
  const isActive = isBlockActive(promptBlock.name)
  const activationState = getActivationState(promptBlock.name)
  const isProcessing = activationState !== 'idle'
  const conflictInfo = getConflictInfo(promptBlock.name)

  // ============================
  // Event Handlers
  // ============================

  /**
   * PHASE 5.1 ENHANCED: Handle prompt block activation using unified handler
   * 
   * This now uses the same activation logic as slash commands to ensure
   * identical behavior and system prompt enhancement.
   */
  const handleActivate = async () => {
    try {
      // PHASE 5.1 NEW: Use unified activation handler for consistent behavior
      const { unifiedPromptActivationHandler } = await import('@/services/UnifiedPromptActivationHandler')
      
      // PHASE 5.1 NEW: Create activation context with all required methods
      const context = {
        availableBlocks,
        activeBlocks,
        isBlockActive,
        getActivationState,
        getConflictInfo,
        toggleActiveBlock,
        addActiveBlock
      }

      const result = await unifiedPromptActivationHandler.activatePromptBlock(
        promptBlock.name,
        context,
        'toolbar',
        { 
          showFeedback: true,
          variables: promptBlock.variables || {}
        }
      )

      if (result.success) {
        console.log(`[PromptBlockCard] ${result.userMessage}`)
        onSelect?.(promptBlock)
        
        // PHASE 5.1 NEW: Log detailed activation information
        if (result.wasReplacement && result.categoryConflict) {
          console.log(`[PromptBlockCard] Category conflict resolved: replaced '${result.categoryConflict.existingBlock.block.name}' with '${promptBlock.name}' in category '${result.categoryConflict.category}'`)
        }
        
        // PHASE 5.3: Success notification is now handled automatically by UnifiedPromptActivationHandler
      } else {
        console.error(`[PromptBlockCard] ${result.error}`)
        // PHASE 5.3: Error notification is now handled automatically by UnifiedPromptActivationHandler
      }
    } catch (error) {
      console.error(`[PromptBlockCard] Unified activation handler failed:`, error)
      // PHASE 5.3: Critical error - this shouldn't happen but if it does, the handler shows notifications
    }
  }

  // ============================
  // Render
  // ============================

  return (
    <div
      className={cn(
        'group relative',
        'border rounded-md p-3',
        'bg-vscode-editor-background',
        'border-vscode-panel-border',
        'hover:border-vscode-focusBorder',
        'hover:bg-vscode-list-hoverBackground',
        'cursor-pointer transition-colors',
        isActive && [
          'ring-1 ring-vscode-focusBorder',
          categoryColors.bg,
          categoryColors.border
        ],
        compact && 'p-2',
        className
      )}
      onClick={handleActivate}
      title={`${promptBlock.name} - ${promptBlock.description || 'No description'}`}
    >
      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-4 right-3">
          <CheckCircle2 className={cn('w-4 h-4', categoryColors.icon)} />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className={cn(
          'flex-shrink-0 p-2 rounded',
          categoryColors.bg,
          'ring-1',
          categoryColors.border
        )}>
          <CategoryIcon className={cn('w-3 h-3', categoryColors.icon)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 -mt-2.5">
            <h4 className={cn(
              'font-medium text-sm truncate',
              'text-vscode-foreground',
              isActive && categoryColors.text
            )}>
              {promptBlock.name}
            </h4>
          </div>

          {/* Category Badge */}
          <div className="flex items-center gap-2 mt-1">            
            
            {/* Processing state */}
            {isProcessing && (
              <span className="text-xs text-orange-400">
                {activationState === 'activating' ? 'Activating...' : 'Deactivating...'}
              </span>
            )}
            
            {/* Conflict info */}
            {conflictInfo && !isActive && (
              <span className="text-xs text-yellow-400" title={`Will replace ${conflictInfo.existingBlock.block.name}`}>
                Will replace
              </span>
            )}
          </div>

          {/* Description */}
          {!compact && promptBlock.description && (
            <p className="text-xs text-vscode-descriptionForeground -mt-1 line-clamp-2">
              {promptBlock.description}
            </p>
          )}

          {/* Variables Info */}
          {!compact && promptBlock.variables && Object.keys(promptBlock.variables).length > 0 && (
            <div className="text-xs text-vscode-descriptionForeground mt-1">
              Variables: {Object.keys(promptBlock.variables).join(', ')}
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {isProcessing && (
          <div className="flex-shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-vscode-descriptionForeground" />
          </div>
        )}
      </div>
    </div>
  )
}