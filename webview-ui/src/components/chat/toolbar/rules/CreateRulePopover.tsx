/**
 * CreateRulePopover
 * 
 * Simplified rule creation interface as a popover.
 * This component now focuses solely on creating new rules,
 * while rule display and management has moved to the main RulesPopover.
 * 
 * Features:
 * - Rule creation form only
 * - Global vs Workspace rule selection
 * - File validation and creation
 * - VSCode integration for file creation
 * - Clean, focused interface
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
import { getExtension } from "@/utils/oacode/path-webview"
import { allowedExtensions } from "@roo/oacode/rules"

interface CreateRulePopoverProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	className?: string
	trigger?: React.ReactNode
}

/**
 * Main CreateRulePopover component - rule creation only
 */
export const CreateRulePopover: React.FC<CreateRulePopoverProps> = ({
	open,
	onOpenChange,
	className,
	trigger
}) => {
	const { t } = useTranslation()
	
	// ============================
	// State Management
	// ============================
	
	const [isGlobal, setIsGlobal] = useState(false)
	const [filename, setFilename] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)
	
	const inputRef = useRef<HTMLInputElement>(null)
	const componentRef = useRef<HTMLDivElement>(null)

	// ============================
	// Effects
	// ============================

	useEffect(() => {
		if (open && inputRef.current) {
			inputRef.current.focus()
		}
	}, [open])

	useClickAway(componentRef, () => {
		if (open) {
			handleClose()
		}
	})

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle form submission
	 */
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		e.stopPropagation() // Prevent event from bubbling to parent popovers
		

		if (filename.trim()) {
			const trimmedFilename = filename.trim()
			const extension = getExtension(trimmedFilename)

			if (extension !== "" && !allowedExtensions.includes(extension)) {
				setError(t("oacode:rules.validation.invalidFileExtension"))
				return
			}

			let finalFilename = trimmedFilename
			if (extension === "") {
				finalFilename = `${trimmedFilename}.md`
			}

			setIsSubmitting(true)
			try {
				vscode.postMessage({
					type: "createRuleFile",
					isGlobal,
					filename: finalFilename,
					ruleType: "rule",
				})
				
				// Reset form but keep popovers open
				setFilename("")
				setError(null)
				// Don't call handleClose() - let user manually close if desired
			} catch (err) {
				console.error("Error creating rule file:", err)
				setError("Failed to create rule file")
			} finally {
				setIsSubmitting(false)
			}
		}
	}

	/**
	 * Handle popover close
	 */
	const handleClose = (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation()
			e.preventDefault()
		}
		onOpenChange(false)
		setFilename("")
		setError(null)
		setIsSubmitting(false)
	}

	/**
	 * Handle keyboard shortcuts
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

	// ============================
	// Styles
	// ============================

	const popoverStyles = cn(
		"w-95 max-w-[90vw] p-0 pb-2 -ml-3",
		"bg-vscode-editor-background",
		"border border-vscode-dropdown-border",
		"shadow-lg",
		"flex flex-col",
		className
	)

	// ============================
	// Render
	// ============================

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			{trigger && (
				<PopoverTrigger asChild>
					{trigger}
				</PopoverTrigger>
			)}
			
			<PopoverContent 
				align="start" 
				className={popoverStyles}
				onEscapeKeyDown={() => handleClose()}
			>
				<div ref={componentRef}>
					{/* Header */}
					<div className="px-4 py-3 border-b border-vscode-dropdown-border">
						<div className="flex items-center justify-between">
							<h3 className="font-medium text-sm text-vscode-foreground">
								Create New Rule
							</h3>
							<button
								onClick={handleClose}
								className="text-vscode-descriptionForeground hover:text-vscode-foreground"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
						<p className="text-xs text-vscode-descriptionForeground mt-1">
							Create a new coding guideline or rule
						</p>
					</div>

					{/* Creation Form */}
					<div className="p-4 space-y-4">
						{/* Rule Scope Selection */}
						<div>
							<label className="text-sm font-medium text-vscode-foreground mb-2 block">
								Rule Scope
							</label>
							<div className="flex gap-2">
								<Button
									type="button"
									variant={!isGlobal ? "default" : "secondary"}
									size="sm"
									onClick={() => setIsGlobal(false)}
									className="flex-1"
								>
									<Building className="w-3 h-3 mr-1" />
									Workspace
								</Button>
								<Button
									type="button"
									variant={isGlobal ? "default" : "secondary"}
									size="sm"
									onClick={() => setIsGlobal(true)}
									className="flex-1"
								>
									<Globe className="w-3 h-3 mr-1" />
									Global
								</Button>
							</div>
							<p className="text-xs text-vscode-descriptionForeground mt-1">
								{isGlobal 
									? "Apply to all projects and workspaces"
									: "Apply only to current workspace"
								}
							</p>
						</div>

						{/* Rule Name Input */}
						<form onSubmit={handleSubmit} className="space-y-3">
							<div>
								<label className="text-sm font-medium text-vscode-foreground mb-2 block">
									Rule Name
								</label>
								<Input
									ref={inputRef}
									type="text"
									placeholder="e.g., typescript-strict-mode"
									value={filename}
									onChange={(e) => setFilename(e.target.value)}
									onKeyDown={handleKeyDown}
									className="w-full"
									disabled={isSubmitting}
								/>
								<p className="text-xs text-vscode-descriptionForeground mt-1">
									Filename for the rule (supports .md, .txt, or no extension)
								</p>
								{error && (
									<p className="text-xs text-vscode-errorForeground mt-1">
										{error}
									</p>
								)}
							</div>

							{/* Submit Button */}
							<div className="flex justify-end pt-2">
								<Button
									type="submit"
									size="sm"
									disabled={!filename.trim() || isSubmitting}
								>
									{isSubmitting ? "Creating..." : "Create Rule"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default CreateRulePopover