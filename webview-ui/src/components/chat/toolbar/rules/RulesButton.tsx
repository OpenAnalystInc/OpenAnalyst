/**
 * RulesButton
 * This component provides the Rules button that opens the rules management
 * popover.
 * 
 * Features:
 * - Integration with RulesPopover component
 * - Active rules count badge
 * - Hover and active states
 * - Keyboard accessibility
 * - Rule management callbacks
 */

import React from 'react'
import { FileText } from 'lucide-react'
import { ToolbarButton } from '../ToolbarButton'
import { RulesPopover } from './RulesPopover'
import { getActiveRules } from './mockRulesData'

/**
 * Props for the RulesButton component
 */
interface RulesButtonProps {
  disabled?: boolean
  onRuleToggle?: (ruleId: string, enabled: boolean) => void
  onCreateRule?: () => void
  onManageRules?: () => void
  className?: string
}

/**
 * Rules button component with integrated popover functionality
 */
export const RulesButton: React.FC<RulesButtonProps> = ({
  disabled = false,
  onRuleToggle,
  onCreateRule,
  onManageRules,
  className
}) => {
  // ============================
  // Computed Values
  // ============================

  /**
   * Get count of active rules for badge display
   */
  const activeRulesCount = getActiveRules().length

  // ============================
  // Event Handlers
  // ============================

  /**
   * Handle rule toggle from popover
   */
  const handleRuleToggle = (ruleId: string, enabled: boolean) => {
    console.log('Rule toggled:', ruleId, enabled)
    onRuleToggle?.(ruleId, enabled)
  }

  /**
   * Handle create rule action
   */
  const handleCreateRule = () => {
    console.log('Create rule requested')
    onCreateRule?.()
  }

  /**
   * Handle manage rules action
   */
  const handleManageRules = () => {
    console.log('Manage rules requested')
    onManageRules?.()
  }

  // ============================
  // Render
  // ============================

  return (
    <RulesPopover
      trigger={({ active: isOpen }) => (
        <ToolbarButton
          icon={<FileText className="w-4 h-4" />}
          tooltip="Rules - Manage coding guidelines and best practices"
          active={isOpen}
          disabled={disabled}
          badge={activeRulesCount > 0 ? activeRulesCount : undefined}
          variant={isOpen ? 'active' : 'default'}
          className={className}
        />
      )}
      onRuleToggle={handleRuleToggle}
      onCreateRule={handleCreateRule}
      onManageRules={handleManageRules}
    />
  )
}