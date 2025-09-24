/**
 * RulesButton
 * This component provides the Rules button with integrated popover functionality.
 * The RulesPopover contains a "Create Rule" button that opens the full management interface.
 *
 * Features:
 * - Integration with RulesPopover (includes CreateRulePopover)
 * - Active rules count badge
 * - Hover and active states
 * - Keyboard accessibility
 * - Full CRUD operations for rules via embedded popover
 */

import React from "react"
import { RulesPopover } from "./RulesPopover"

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
export const RulesButton: React.FC<RulesButtonProps> = ({ onRuleToggle, onCreateRule, onManageRules, className }) => {
	// ============================
	// Computed Values
	// ============================

	// Active rules count is now managed within RulesPopover

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle rule toggle from popover
	 */
	const handleRuleToggle = (ruleId: string, enabled: boolean) => {
		console.log("Rule toggled:", ruleId, enabled)
		onRuleToggle?.(ruleId, enabled)
	}

	/**
	 * Handle create rule action
	 */
	const handleCreateRule = () => {
		console.log("Create rule requested")
		onCreateRule?.()
	}

	/**
	 * Handle manage rules action
	 */
	const handleManageRules = () => {
		console.log("Manage rules requested")
		onManageRules?.()
	}

	// ============================
	// Render
	// ============================

	return (
		<RulesPopover
			onRuleToggle={handleRuleToggle}
			onCreateRule={handleCreateRule}
			onManageRules={handleManageRules}
			className={className}
		/>
	)
}
