/**
 * PromptsButton
 * This component provides the Prompts button that opens the prompts templates
 * popover.
 * 
 * Features:
 * - Integration with PromptsPopover component
 * - Dynamic badge showing template count
 * - Hover and active states
 * - Keyboard accessibility
 * - Prompt management callbacks
 */

import React from 'react'
import { MessageSquare } from 'lucide-react'
import { ToolbarButton } from '../ToolbarButton'
import { PromptsPopover } from './PromptsPopover'
import { getPromptStats } from './mockPromptsData'
import { PromptTemplate } from '../types'

/**
 * Props for the PromptsButton component
 */
interface PromptsButtonProps {
  disabled?: boolean
  onPromptSelect?: (prompt: PromptTemplate) => void
  onCreatePrompt?: () => void
  onManagePrompts?: () => void
  className?: string
}

/**
 * Prompts button component with integrated popover functionality
 */
export const PromptsButton: React.FC<PromptsButtonProps> = ({
  disabled = false,
  onPromptSelect,
  onCreatePrompt,
  onManagePrompts,
  className
}) => {
  // ============================
  // Computed Values
  // ============================

  /**
   * Get prompt statistics for badge display
   */
  const promptStats = getPromptStats()

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle prompt selection from popover
   */
  const handlePromptSelect = (prompt: PromptTemplate) => {
    console.log('Prompt selected:', prompt.name)
    onPromptSelect?.(prompt)
  }

  /**
   * Handle create prompt action
   */
  const handleCreatePrompt = () => {
    console.log('Create prompt requested')
    onCreatePrompt?.()
  }

  /**
   * Handle manage prompts action
   */
  const handleManagePrompts = () => {
    console.log('Manage prompts requested')
    onManagePrompts?.()
  }

  // ============================
  // Render
  // ============================

  return (
    <PromptsPopover
      trigger={({ active: isOpen }) => (
        <ToolbarButton
          icon={<MessageSquare className="w-4 h-4" />}
          tooltip="Prompts - Quick access to prompt templates"
          active={isOpen}
          disabled={disabled}
          badge={promptStats.total > 0 ? promptStats.total : undefined}
          variant={isOpen ? 'active' : 'default'}
          className={className}
        />
      )}
      onPromptSelect={handlePromptSelect}
      onCreatePrompt={handleCreatePrompt}
      onManagePrompts={handleManagePrompts}
    />
  )
}