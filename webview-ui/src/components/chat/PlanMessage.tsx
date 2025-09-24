/**
 * Module: PlanMessage (React Component)
 * Purpose: Display strategic plans inline in chat with action buttons
 * Responsibilities:
 *  - Render plan content with proper formatting
 *  - Provide approve/modify/reject action buttons
 *  - Handle plan workflow state transitions
 *  - Show plan progress when in execution mode
 * Dependencies: React, VS Code UI toolkit, Extension state context
 * Security: No sensitive data handling, validates user inputs
 * Performance: Lightweight component with minimal re-renders
 */

import React, { memo, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import MarkdownBlock from "../common/MarkdownBlock"

interface PlanMessageProps {
	content: string
	isApproved?: boolean
	approvedPlan?: {
		content: string
		approvedAt: number
		currentPhase: number
		completedPhases: string[]
		estimatedHours?: number
		planBlockId?: string
	}
	workflowMode?: 'plan' | 'chat' | 'agent'
}

export const PlanMessage = memo(({ content, isApproved = false, approvedPlan, workflowMode }: PlanMessageProps) => {
	const { t } = useTranslation()
	const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
	const [modifyFeedback, setModifyFeedback] = useState("")

	const isPlanMode = workflowMode === 'plan'
	const isExecutionMode = workflowMode === 'chat' || workflowMode === 'agent'

	// Calculate plan progress if in execution mode
	const planProgress = approvedPlan ? {
		currentPhase: approvedPlan.currentPhase + 1,
		totalPhases: extractPhaseCount(approvedPlan.content),
		completionPercentage: Math.round((approvedPlan.completedPhases.length / Math.max(1, approvedPlan.currentPhase + 1)) * 100),
		completedPhases: approvedPlan.completedPhases,
		estimatedHours: approvedPlan.estimatedHours,
		approvedAt: new Date(approvedPlan.approvedAt).toLocaleString()
	} : null

	const handleApprovePlan = () => {
		// Extract estimated hours from plan content if not provided
		const estimatedHours = extractEstimatedHours(content)

		vscode.postMessage({
			type: "approvePlan",
			planContent: content,
			estimatedHours
		})
	}

	const handleRejectPlan = () => {
		vscode.postMessage({
			type: "rejectPlan",
			planContent: content,
			reason: "Plan rejected by user"
		})
	}

	const handleModifyPlan = () => {
		vscode.postMessage({
			type: "modifyPlan",
			feedback: modifyFeedback,
			specificChanges: [modifyFeedback],
			originalPlanContent: content,
			preserveStructure: false
		})
		setIsModifyModalOpen(false)
		setModifyFeedback("")
	}

	return (
		<div style={{
			border: "2px solid var(--vscode-editorWidget-border)",
			borderRadius: "8px",
			margin: "12px 0",
			backgroundColor: "var(--vscode-editor-background)"
		}}>
			{/* Plan Header */}
			<div style={{
				padding: "12px 16px",
				borderBottom: "1px solid var(--vscode-editorWidget-border)",
				backgroundColor: "var(--vscode-editorGroupHeader-tabsBackground)",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between"
			}}>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<span
						className="codicon codicon-project"
						style={{
							fontSize: "16px",
							color: isApproved ? "var(--vscode-testing-iconPassed)" : "var(--vscode-editorInfo-foreground)"
						}}
					/>
					<span style={{ fontWeight: "bold", fontSize: "14px" }}>
						{isApproved ? "Approved Plan" : "Strategic Plan"}
					</span>
					{isApproved && planProgress && (
						<span style={{
							fontSize: "12px",
							color: "var(--vscode-descriptionForeground)",
							marginLeft: "8px"
						}}>
							{planProgress.completionPercentage}% Complete
						</span>
					)}
				</div>

				{/* Plan Status Badge */}
				<div style={{
					padding: "2px 8px",
					borderRadius: "12px",
					fontSize: "11px",
					fontWeight: "bold",
					backgroundColor: isApproved
						? "var(--vscode-testing-iconPassed)"
						: "var(--vscode-editorInfo-foreground)",
					color: "white"
				}}>
					{isApproved ? "APPROVED" : "PENDING"}
				</div>
			</div>

			{/* Plan Progress (for execution mode) */}
			{isApproved && planProgress && isExecutionMode && (
				<div style={{
					padding: "12px 16px",
					borderBottom: "1px solid var(--vscode-editorWidget-border)",
					backgroundColor: "var(--vscode-editorGroupHeader-noTabsBackground)"
				}}>
					<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
						<span style={{ fontSize: "12px", fontWeight: "bold" }}>
							Phase {planProgress.currentPhase} of {planProgress.totalPhases}
						</span>
						<span style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
							{planProgress.completedPhases.length} phases completed
						</span>
					</div>

					{/* Progress Bar */}
					<div style={{
						width: "100%",
						height: "4px",
						backgroundColor: "var(--vscode-editorWidget-border)",
						borderRadius: "2px",
						overflow: "hidden"
					}}>
						<div style={{
							width: `${planProgress.completionPercentage}%`,
							height: "100%",
							backgroundColor: "var(--vscode-testing-iconPassed)",
							transition: "width 0.3s ease"
						}} />
					</div>

					{planProgress.estimatedHours && (
						<div style={{
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
							marginTop: "4px"
						}}>
							Estimated: {planProgress.estimatedHours} hours • Approved: {planProgress.approvedAt}
						</div>
					)}
				</div>
			)}

			{/* Plan Content */}
			<div style={{ padding: "16px" }}>
				<MarkdownBlock markdown={content} />
			</div>

			{/* Action Buttons (only for pending plans in plan mode) */}
			{!isApproved && isPlanMode && (
				<div style={{
					padding: "12px 16px",
					borderTop: "1px solid var(--vscode-editorWidget-border)",
					display: "flex",
					gap: "8px",
					justifyContent: "flex-end"
				}}>
					<VSCodeButton
						appearance="secondary"
						onClick={handleRejectPlan}
					>
						Reject
					</VSCodeButton>

					<VSCodeButton
						appearance="secondary"
						onClick={() => setIsModifyModalOpen(true)}
					>
						Modify
					</VSCodeButton>

					<VSCodeButton
						appearance="primary"
						onClick={handleApprovePlan}
					>
						Approve
					</VSCodeButton>
				</div>
			)}

			{/* Modify Plan Modal */}
			{isModifyModalOpen && (
				<div style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: "rgba(0, 0, 0, 0.5)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					zIndex: 1000
				}}>
					<div style={{
						backgroundColor: "var(--vscode-editor-background)",
						border: "1px solid var(--vscode-editorWidget-border)",
						borderRadius: "8px",
						padding: "20px",
						maxWidth: "500px",
						width: "90%"
					}}>
						<h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>
							Modify Plan
						</h3>

						<textarea
							value={modifyFeedback}
							onChange={(e) => setModifyFeedback(e.target.value)}
							placeholder="Enter your feedback and specific changes for the plan..."
							style={{
								width: "100%",
								height: "120px",
								padding: "8px",
								border: "1px solid var(--vscode-editorWidget-border)",
								borderRadius: "4px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								resize: "vertical",
								marginBottom: "16px"
							}}
						/>

						<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
							<VSCodeButton
								appearance="secondary"
								onClick={() => setIsModifyModalOpen(false)}
							>
								Cancel
							</VSCodeButton>
							<VSCodeButton
								appearance="primary"
								onClick={handleModifyPlan}
								disabled={!modifyFeedback.trim()}
							>
								Submit Changes
							</VSCodeButton>
						</div>
					</div>
				</div>
			)}

		</div>
	)
})

PlanMessage.displayName = "PlanMessage"

/**
 * Extract estimated hours from plan content
 */
function extractEstimatedHours(content: string): number | undefined {
	const hoursMatch = content.match(/(?:estimated?|time|hours?).*?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i)
	return hoursMatch ? parseFloat(hoursMatch[1]) : undefined
}

/**
 * Extract the number of phases from plan content
 */
function extractPhaseCount(content: string): number {
	const phaseMatches = content.match(/^#{2,3}\s+Phase\s+\d+/gm)
	return phaseMatches ? phaseMatches.length : 1
}

export default PlanMessage