/**
 * WorkflowButton - Dropdown button for switching between workflow modes
 * 
 * This component provides a dropdown menu to switch between Plan, Chat, and Agent modes.
 * 
 * Features:
 * - Three workflow modes: Plan, Chat, and Agent
 * - Visual feedback for current mode
 * - Keyboard navigation support
 * - Consistent styling with other toolbar buttons
 */

import React, { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { SelectDropdown, DropdownOptionType } from '@/components/ui'
import { ToolbarButton } from '../ToolbarButton'
import { vscode } from '@/utils/vscode'
import { 
  WorkflowButtonProps, 
  WorkflowMode, 
  WORKFLOW_MODES,
  DEFAULT_WORKFLOW_MODE 
} from './types'
import { useExtensionState } from '@/context/ExtensionStateContext'

/**
 * WorkflowButton component for workflow mode selection
 */
export const WorkflowButton: React.FC<WorkflowButtonProps> = ({
  currentMode = DEFAULT_WORKFLOW_MODE,
  onModeChange,
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  // Get current mode configuration
  const currentModeConfig = WORKFLOW_MODES[currentMode] || WORKFLOW_MODES[DEFAULT_WORKFLOW_MODE]

  /**
   * Handle mode selection from dropdown
   */
  const handleModeSelect = useCallback((value: string) => {
    const newMode = value as WorkflowMode
    
    // Validate mode
    if (!Object.values(WorkflowMode).includes(newMode)) {
      console.error('Invalid workflow mode:', value)
      return
    }

    // Update mode
    onModeChange(newMode)
    
    // Notify extension
    vscode.postMessage({
      type: 'workflowModeChanged',
      workflowMode: newMode
    })
    
    // Close dropdown
    setIsOpen(false)
  }, [onModeChange])

  /**
   * Handle button click to toggle dropdown
   */
  const handleButtonClick = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev)
    }
  }, [disabled])

  /**
   * Dropdown options for workflow modes
   */
  const dropdownOptions = [
    {
      value: 'shortcut',
      label: '',
      disabled: false,
      type: DropdownOptionType.SHORTCUT,
    },
    ...Object.values(WORKFLOW_MODES).map(mode => ({
      value: mode.id,
      label: mode.label,
      codicon: mode.icon,
      description: mode.description,
      type: DropdownOptionType.ITEM,
    })),
  ]

  return (
    <div className={cn('relative', className)}>
      {/* Use SelectDropdown for consistency with OaModeSelector */}
      <SelectDropdown
        value={currentMode}
        options={dropdownOptions}
        onChange={handleModeSelect}
        disabled={disabled}
        title="Switch workflow mode"
        placeholder="Select mode"
        disableSearch={true}
        triggerClassName={cn(
          "min-w-[100px] max-w-[150px]",
          "bg-transparent",
          "border border-[rgba(255,255,255,0.08)]",
          "hover:bg-[rgba(255,255,255,0.03)]",
          "hover:border-[rgba(255,255,255,0.15)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        contentClassName="w-[250px]"
        sideOffset={8}
        align="end"
      />
    </div>
  )
}

export default WorkflowButton