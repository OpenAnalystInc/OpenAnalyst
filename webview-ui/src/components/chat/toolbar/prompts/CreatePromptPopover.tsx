/**
 * CreatePromptPopover
 * 
 * Prompt creation interface as a popover.
 * Based on CreateRulePopover but adapted for YAML prompt template creation.
 * This component focuses solely on creating new custom prompt templates.
 * 
 * Features:
 * - Prompt creation form with name input
 * - Global vs Workspace scope selection (Building/Globe icons)
 * - YAML extension validation (.yaml enforced)
 * - Form validation and error handling
 * - Loading states and user feedback
 * - VSCode integration preparation (backend will be implemented in later phases)
 * - Clean, modular, and maintainable code structure
 */

import React, { useState, useRef, useEffect } from "react"
import { useClickAway } from "react-use"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { X, Globe, Building } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui"

import { vscode } from "@/utils/vscode"

/**
 * Props interface for CreatePromptPopover component
 * Follows same pattern as CreateRulePopover for consistency
 */
interface CreatePromptPopoverProps {
	/** Whether the popover is open */
	open: boolean
	/** Callback when popover open state changes */
	onOpenChange: (open: boolean) => void
	/** Additional CSS classes */
	className?: string
	/** Optional trigger element (for future extensibility) */
	trigger?: React.ReactNode
}

/**
 * Main CreatePromptPopover component - prompt creation only
 * 
 * This component handles the UI for creating new custom prompts.
 * Backend integration will be added in later phases.
 */
export const CreatePromptPopover: React.FC<CreatePromptPopoverProps> = ({
	open,
	onOpenChange,
	className,
	trigger
}) => {
	const { t } = useTranslation()

	// ============================
	// State Management
	// ============================

	// Scope selection: false = Workspace, true = Global
	const [isGlobal, setIsGlobal] = useState(false)
	
	// Prompt filename (without extension)
	const [filename, setFilename] = useState("")
	
	// Error message for validation failures
	const [error, setError] = useState<string | null>(null)
	
	// Loading state during file creation
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Refs for DOM elements
	const inputRef = useRef<HTMLInputElement>(null)
	const componentRef = useRef<HTMLDivElement>(null)

	// ============================
	// Effects
	// ============================

	/**
	 * Focus input when popover opens for better UX
	 */
	useEffect(() => {
		if (open && inputRef.current) {
			inputRef.current.focus()
		}
	}, [open])

	/**
	 * Close popover when clicking outside
	 * Uses react-use hook for clean implementation
	 */
	useClickAway(componentRef, () => {
		if (open) {
			handleClose()
		}
	})

	// ============================
	// Validation Helpers
	// ============================

	/**
	 * Validate prompt filename
	 * Basic validation, will be enhanced in later phases
	 * 
	 * @param name - The filename to validate
	 * @returns Error message or null if valid
	 */
	const validateFilename = (name: string): string | null => {
		const trimmedName = name.trim()
		
		// Check for empty name
		if (!trimmedName) {
			return "Prompt name is required"
		}
		
		// Check for invalid characters (basic validation)
		if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
			return "Prompt name can only contain letters, numbers, hyphens, and underscores"
		}
		
		// Check length constraints
		if (trimmedName.length < 2) {
			return "Prompt name must be at least 2 characters long"
		}
		
		if (trimmedName.length > 50) {
			return "Prompt name must be less than 50 characters"
		}
		
		return null
	}

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle form submission
	 * Validates input and prepares for backend integration
	 */
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		e.stopPropagation() // Prevent event from bubbling to parent popovers

		// Validate filename
		const validationError = validateFilename(filename)
		if (validationError) {
			setError(validationError)
			return
		}

		const trimmedFilename = filename.trim()
		
		// Always add .yaml extension for prompts (unlike rules which support multiple)
		const finalFilename = `${trimmedFilename}.yaml`

		setIsSubmitting(true)
		setError(null)

		try {
			// Send message to backend to create the prompt file
			vscode.postMessage({
				type: "createPromptFile",
				filename: finalFilename,
				isGlobal,
				promptCategory: "analysis", // Default category - can be enhanced later
			})

			console.log('[CreatePromptPopover] Creating prompt:', {
				filename: finalFilename,
				isGlobal,
				scope: isGlobal ? 'Global' : 'Workspace',
				category: 'analysis'
			})

			// Reset form on success
			setFilename("")
			setError(null)
			
			// Don't auto-close - let user manually close if desired
			// This matches the pattern from CreateRulePopover
			
		} catch (err) {
			console.error("Error creating prompt file:", err)
			setError("Failed to create prompt file. Please try again.")
		} finally {
			setIsSubmitting(false)
		}
	}

	/**
	 * Handle popover close
	 * Resets all form state when closing
	 */
	const handleClose = (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation()
			e.preventDefault()
		}
		
		// Reset all form state
		onOpenChange(false)
		setFilename("")
		setError(null)
		setIsSubmitting(false)
	}

	/**
	 * Handle keyboard shortcuts
	 * Provides accessible keyboard navigation
	 */
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			handleClose()
		} else if (e.key === "Enter") {
			// Prevent Enter from bubbling up and closing parent popovers
			e.stopPropagation()
			// Form submission will be handled by the form's onSubmit
		}
	}

	/**
	 * Handle scope toggle between Workspace and Global
	 * 
	 * @param newIsGlobal - Whether to set global scope
	 */
	const handleScopeChange = (newIsGlobal: boolean) => {
		setIsGlobal(newIsGlobal)
		// Clear any existing errors when changing scope
		if (error) {
			setError(null)
		}
	}

	// ============================
	// Render Helpers
	// ============================

	/**
	 * Render scope selection buttons
	 * Uses same styling as CreateRulePopover for consistency
	 */
	const renderScopeSelection = () => (
		<div>
			<label className="text-sm font-medium text-vscode-foreground mb-2 block">
				Prompt Scope
			</label>
			<div className="flex gap-2">
				<Button
					type="button"
					variant={!isGlobal ? "default" : "secondary"}
					size="sm"
					onClick={() => handleScopeChange(false)}
					className="flex-1"
					disabled={isSubmitting}>
					<Building className="w-3 h-3 mr-1" />
					Workspace
				</Button>
				<Button
					type="button"
					variant={isGlobal ? "default" : "secondary"}
					size="sm"
					onClick={() => handleScopeChange(true)}
					className="flex-1"
					disabled={isSubmitting}>
					<Globe className="w-3 h-3 mr-1" />
					Global
				</Button>
			</div>
			<p className="text-xs text-vscode-descriptionForeground mt-1">
				{isGlobal 
					? "Available in all projects and workspaces" 
					: "Available only in current workspace"
				}
			</p>
		</div>
	)

	/**
	 * Render filename input section
	 */
	const renderFilenameInput = () => (
		<div>
			<label className="text-sm font-medium text-vscode-foreground mb-2 block">
				Prompt Name
			</label>
			<Input
				ref={inputRef}
				type="text"
				placeholder="e.g., my-custom-analysis"
				value={filename}
				onChange={(e) => {
					setFilename(e.target.value)
					// Clear error when user starts typing
					if (error) {
						setError(null)
					}
				}}
				onKeyDown={handleKeyDown}
				className="w-full"
				disabled={isSubmitting}
			/>
			<p className="text-xs text-vscode-descriptionForeground mt-1">
				Will be saved as a .yaml file
			</p>
			{error && (
				<p className="text-xs text-vscode-errorForeground mt-1" role="alert">
					{error}
				</p>
			)}
		</div>
	)

	// ============================
	// Styles
	// ============================

	const popoverStyles = cn(
		"w-95 max-w-[90vw] p-0 pb-2 -ml-4",
		"bg-vscode-editor-background",
		"border border-vscode-dropdown-border",
		"shadow-lg",
		"flex flex-col",
		className,
	)

	// ============================
	// Render
	// ============================

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			{/* Trigger element - optional for future extensibility */}
			{trigger && <PopoverTrigger asChild>{trigger}</PopoverTrigger>}

			<PopoverContent align="start" className={popoverStyles} onEscapeKeyDown={() => handleClose()}>
				<div ref={componentRef}>
					{/* Header */}
					<div className="px-4 py-3 border-b border-vscode-dropdown-border">
						<div className="flex items-center justify-between">
							<h3 className="font-medium text-sm text-vscode-foreground">
								Create New Prompt
							</h3>
							<button
								onClick={handleClose}
								className="text-vscode-descriptionForeground hover:text-vscode-foreground"
								disabled={isSubmitting}
								aria-label="Close create prompt dialog">
								<X className="w-4 h-4" />
							</button>
						</div>
						<p className="text-xs text-vscode-descriptionForeground mt-1">
							Create a new custom prompt template
						</p>
					</div>

					{/* Creation Form */}
					<div className="p-4 space-y-4">
						{/* Scope Selection */}
						{renderScopeSelection()}

						{/* Prompt Name Input and Submit */}
						<form onSubmit={handleSubmit} className="space-y-3">
							{renderFilenameInput()}

							{/* Submit Button */}
							<div className="flex justify-end pt-2">
								<Button 
									type="submit" 
									size="sm" 
									disabled={!filename.trim() || isSubmitting}
									className="min-w-[100px]">
									{isSubmitting ? "Creating..." : "Create Prompt"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default CreatePromptPopover