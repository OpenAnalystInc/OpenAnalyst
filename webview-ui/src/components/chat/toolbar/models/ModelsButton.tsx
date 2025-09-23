/**
 * ModelsButton 
 * This component provides the Models button that opens the models configuration
 * dropdown.
 * 
 * Features:
 * - Integration with ModelsPopover component
 * - Status indicators for model configuration
 * - Hover and active states
 * - Keyboard accessibility
 * - Loading states during model setup
 */

import React from 'react'
import { ModelsPopover } from './ModelsPopover'
import { ModelConfig, ModelCategory } from '../types'

/**
 * Props for the ModelsButton component
 */
interface ModelsButtonProps {
  disabled?: boolean
  onModelSelect?: (model: ModelConfig) => void
  onModelSetup?: (modelId: string, category: ModelCategory) => void
  className?: string
}

/**
 * Models button component with integrated dropdown functionality
 */
export const ModelsButton: React.FC<ModelsButtonProps> = ({
  disabled = false,
  onModelSelect,
  onModelSetup,
  className
}) => {
  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle model selection from dropdown
   */
  const handleModelSelect = (model: ModelConfig) => {
    console.log('Model selected:', model)
    onModelSelect?.(model)
  }

  /**
   * Handle model setup from dropdown
   */
  const handleModelSetup = (modelId: string, category: ModelCategory) => {
    console.log('Setting up model:', modelId, 'in category:', category)
    onModelSetup?.(modelId, category)
  }

  // ============================
  // Render
  // ============================

  return (
    <ModelsPopover
      onModelSelect={handleModelSelect}
      onModelSetup={handleModelSetup}
    />
  )
}