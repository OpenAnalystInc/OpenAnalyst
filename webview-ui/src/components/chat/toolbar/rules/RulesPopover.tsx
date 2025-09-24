/**
 * RulesPopover
 *
 * This component displays the Rules dropdown with active coding rules,
 * source filtering, and rule management functionality.
 *
 * Features:
 * - List of active and inactive rules
 * - Source-based filtering (Global, Project, User, etc.)
 * - Enable/disable rule toggles
 * - Rule statistics and counts
 * - Search functionality for large rule sets
 * - Rule creation and management shortcuts
 */

import React, { useState, useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Plus, Search, FileText, X, Globe, Building } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"

import { vscode } from "@/utils/vscode"
import RuleCard from "./RuleCard"
import CreateRulePopover from "./CreateRulePopover"

/**
 * Props for the RulesPopover component
 */
interface RulesPopoverProps {
	onRuleToggle?: (ruleId: string, enabled: boolean) => void
	onCreateRule?: () => void
	onManageRules?: () => void
	className?: string
}

/**
 * Main RulesPopover component
 */
// Helper function to sort rules
const sortedRules = (data: Record<string, unknown> | undefined) =>
	Object.entries(data || {})
		.map(([path, enabled]): [string, boolean] => [path, enabled as boolean])
		.sort(([a], [b]) => a.localeCompare(b))

export const RulesPopover: React.FC<RulesPopoverProps> = ({ onRuleToggle, onCreateRule, className }) => {
	// ============================
	// State Management
	// ============================

	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [activeTab, setActiveTab] = useState<"global" | "workspace">("global")
	const [loadingRules, setLoadingRules] = useState<Set<string>>(new Set())
	const [showCreateRulePopover, setShowCreateRulePopover] = useState(false)

	// Real rule data from VSCode
	const [localRules, setLocalRules] = useState<[string, boolean][]>([])
	const [globalRules, setGlobalRules] = useState<[string, boolean][]>([])

	// Focus retention for VSCode operations
	const [preventClose, setPreventClose] = useState(false)

	// ============================
	// Effects - VSCode Integration
	// ============================

	useEffect(() => {
		if (open) {
			vscode.postMessage({ type: "refreshRules" })
		}
	}, [open])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			switch (message.type) {
				case "rulesData":
					setLocalRules(sortedRules(message.localRules))
					setGlobalRules(sortedRules(message.globalRules))
					// Reset prevent close after data is loaded
					setPreventClose(false)
					break

				case "ruleCreated":
				case "ruleDeleted":
				case "ruleUpdated":
					// Refresh rules data when rule operations complete
					// But don't reset activation states to keep popover open
					vscode.postMessage({ type: "refreshRules" })
					break

				// Remove prompt block listeners - they're not relevant for rules
				// These were causing unnecessary refreshes and state resets
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// ============================
	// Computed Values
	// ============================

	/**
	 * Get current tab rules based on active tab
	 */
	const currentTabRules = useMemo(() => {
		return activeTab === "global" ? globalRules : localRules
	}, [activeTab, globalRules, localRules])

	/**
	 * Filter rules based on search
	 */
	const filteredRules = useMemo(() => {
		let rules = currentTabRules

		// Filter by search term
		if (searchValue) {
			const searchLower = searchValue.toLowerCase()
			rules = rules.filter(([rulePath]) => rulePath.toLowerCase().includes(searchLower))
		}

		return rules
	}, [currentTabRules, searchValue])

	/**
	 * Get rule counts for tab display
	 */
	const globalCount = globalRules.length
	const workspaceCount = localRules.length

	/**
	 * Get active rule counts
	 */
	const activeGlobalCount = globalRules.filter(([, enabled]) => enabled).length
	const activeWorkspaceCount = localRules.filter(([, enabled]) => enabled).length
	const totalActiveCount = activeGlobalCount + activeWorkspaceCount

	// ============================
	// Event Handlers
	// ============================

	/**
	 * Handle rule toggle with loading state
	 */
	const handleRuleToggle = async (rulePath: string, enabled: boolean) => {
		setLoadingRules((prev) => new Set(prev).add(rulePath))
		setPreventClose(true) // Prevent popover from closing during operation

		try {
			// Determine if rule is global
			const isGlobal = globalRules.some(([path]) => path === rulePath)

			// Send toggle message to VSCode
			vscode.postMessage({
				type: "toggleRule",
				rulePath,
				enabled,
				isGlobal,
			})

			onRuleToggle?.(rulePath, enabled)
		} catch (error) {
			console.error("Rule toggle failed:", error)
		} finally {
			setLoadingRules((prev) => {
				const next = new Set(prev)
				next.delete(rulePath)
				return next
			})
			// Allow closing after a brief delay for operation to complete
			setTimeout(() => setPreventClose(false), 500)
		}
	}

	/**
	 * Handle popover close
	 */
	const handleClose = () => {
		if (preventClose) return // Prevent closing during VSCode operations
		setOpen(false)
	}

	/**
	 * Clear search input
	 */
	const handleClearSearch = () => {
		setSearchValue("")
	}

	/**
	 * Handle create rule button click - opens management popover
	 */
	const handleCreateRuleClick = () => {
		setShowCreateRulePopover(true)
		onCreateRule?.()
	}

	/**
	 * Handle CreateRulePopover close - prevent parent from closing
	 */
	const handleCreateRulePopoverChange = (newOpen: boolean) => {
		setPreventClose(true) // Prevent parent from closing
		setShowCreateRulePopover(newOpen)
		// Allow parent to close after a brief delay
		setTimeout(() => setPreventClose(false), 100)
	}

	/**
	 * Handle edit operation start - prevent popover from closing
	 */
	const handleEditStart = () => {
		setPreventClose(true)
		// Keep popover open during edit operation with longer timeout
		setTimeout(() => setPreventClose(false), 2000)
	}

	// ============================
	// Render
	// ============================

	return (
		<Popover
			open={open}
			onOpenChange={(newOpen) => {
				if (!newOpen && preventClose) return // Prevent closing during operations
				setOpen(newOpen)
			}}>
			<PopoverTrigger asChild>
				<button
					className={`flex items-center justify-center w-8 h-8 text-white rounded transition-all duration-200 ease-in-out ${
						open
							? "bg-[rgba(255,255,255,0.20)] border-[rgba(255,255,255,0.2)] shadow-sm"
							: "bg-transparent border-transparent hover:bg-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.1)] hover:shadow-sm"
					}`}
					style={{ position: "relative" }}
					title="Rules - Manage coding guidelines and best practices">
					<FileText className="w-4 h-4" />
				</button>
			</PopoverTrigger>

			<PopoverContent
				align="start"
				className={cn(
					"w-95 max-w-[90vw] max-h-[70vh] p-0",
					"bg-vscode-dropdown-background",
					"border border-vscode-dropdown-border",
					"shadow-lg",
					"flex flex-col",
					className,
				)}
				onEscapeKeyDown={handleClose}>
				{/* Header */}
				<div className="px-3 py-2 border-b border-vscode-dropdown-border">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-sm text-vscode-foreground">Rules</h3>
						<button
							onClick={handleClose}
							className="text-vscode-descriptionForeground hover:text-vscode-foreground">
							<X className="w-4 h-4" />
						</button>
					</div>
					<p className="text-xs text-vscode-descriptionForeground mt-1">
						Manage coding guidelines and best practices
					</p>
				</div>

				{/* Search and Filters */}
				<div className="px-4 py-3 border-b border-vscode-dropdown-border space-y-3">
					{/* Search Input */}
					<div className="relative">
						<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-vscode-descriptionForeground" />
						<Input
							placeholder="Search rules..."
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							className="pl-8 h-8 text-sm"
						/>
						{searchValue && (
							<button
								onClick={handleClearSearch}
								className="absolute right-2 top-1/2 transform -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-foreground">
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>

				{/* Tabs - Global vs Workspace */}
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as any)}
					className="flex-1 flex flex-col min-h-0">
					<TabsList className="flex mx-3 mt-3 mb-2">
						<TabsTrigger value="global" className="flex-1">
							<Globe className="w-3 h-3 mr-1 flex-shrink-0" />
							<span className="truncate">Global ({globalCount})</span>
						</TabsTrigger>
						<TabsTrigger value="workspace" className="flex-1">
							<Building className="w-3 h-3 mr-1 flex-shrink-0" />
							<span className="truncate">Workspace ({workspaceCount})</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab Content */}
					<div className="flex-1 overflow-y-auto">
						<TabsContent value="global" className="mt-0 px-0">
							{filteredRules.length === 0 ? (
								<div className="px-4 py-8 text-center text-vscode-descriptionForeground">
									<Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
									<div className="text-sm">
										{searchValue
											? "No global rules match your search"
											: "No global rules configured"}
									</div>
									<div className="text-xs mt-1">
										{searchValue
											? "Try adjusting your search"
											: "Create your first global coding rule"}
									</div>
								</div>
							) : (
								<div>
									{filteredRules.map(([rulePath, enabled]) => (
										<RuleCard
											key={rulePath}
											rulePath={rulePath}
											enabled={enabled}
											source="global"
											onToggle={handleRuleToggle}
											onEditStart={handleEditStart}
											isLoading={loadingRules.has(rulePath)}
										/>
									))}
								</div>
							)}
						</TabsContent>

						<TabsContent value="workspace" className="mt-0 px-0">
							{filteredRules.length === 0 ? (
								<div className="px-4 py-8 text-center text-vscode-descriptionForeground">
									<Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
									<div className="text-sm">
										{searchValue
											? "No workspace rules match your search"
											: "No workspace rules configured"}
									</div>
									<div className="text-xs mt-1">
										{searchValue
											? "Try adjusting your search"
											: "Create your first workspace coding rule"}
									</div>
								</div>
							) : (
								<div>
									{filteredRules.map(([rulePath, enabled]) => (
										<RuleCard
											key={rulePath}
											rulePath={rulePath}
											enabled={enabled}
											source="workspace"
											onToggle={handleRuleToggle}
											onEditStart={handleEditStart}
											isLoading={loadingRules.has(rulePath)}
										/>
									))}
								</div>
							)}
						</TabsContent>
					</div>
				</Tabs>

				{/* Footer */}
				<div className="px-3 py-2 border-t border-vscode-dropdown-border">
					{/* Action Buttons */}
					<div className="flex items-center gap-2 mb-2">
						<CreateRulePopover
							open={showCreateRulePopover}
							onOpenChange={handleCreateRulePopoverChange}
							trigger={
								<Button
									variant="secondary"
									size="sm"
									onClick={handleCreateRuleClick}
									className="flex-1 h-7 text-xs bg-vscode-editor-background hover:bg-vscode-editor-background/80">
									<Plus className="w-3 h-3 mr-1" />
									Create Rule
								</Button>
							}
						/>
					</div>

					{/* Statistics */}
					<div className="flex items-center justify-end text-xs text-vscode-descriptionForeground">
						<span>{totalActiveCount} active</span>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
