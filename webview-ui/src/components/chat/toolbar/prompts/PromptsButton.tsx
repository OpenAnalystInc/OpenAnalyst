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
import { PromptsPopover } from './PromptsPopover'
import { PromptBlockInfo } from '@/utils/prompt-blocks'
import { usePromptBlocks } from '@/context/PromptBlocksContext'

/**
 * Props for the PromptsButton component
 */
interface PromptsButtonProps {
  disabled?: boolean
  onPromptSelect?: (prompt: PromptBlockInfo) => void
  className?: string
}

/**
 * Prompts button component with integrated popover functionality
 */
export const PromptsButton: React.FC<PromptsButtonProps> = ({
  onPromptSelect,
}) => {

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle prompt selection from popover
   */
  const handlePromptSelect = (prompt: PromptBlockInfo) => {
    console.log('Prompt selected:', prompt.name)
    onPromptSelect?.(prompt)
  }

  // ============================
  // Render
  // ============================

  return (
    <PromptsPopover
      onPromptSelect={handlePromptSelect}
    />
  )
}