/**
 * Module: RejectPlan (use case)
 * Purpose: Handle plan rejection workflow
 * Responsibilities:
 *  - Clear any pending plan data
 *  - Maintain PLAN mode for user to retry
 *  - Log rejection for analytics
 *  - Provide feedback for plan improvement
 * Preconditions:
 *  - Should be in PLAN mode with a pending plan
 * Postconditions:
 *  - Remains in PLAN mode
 *  - No approved plan stored
 *  - Ready for new plan creation
 * Dependencies: IPlanRepository
 * Security: No sensitive data handling
 * Performance: Fast operation, mainly state cleanup
 */

import { PlanMode, WorkflowMode } from "../domain/PlanMode"
import { ApprovedPlan } from "../domain/ApprovedPlan"
import { IPlanRepository } from "../ports/IPlanRepository"

/**
 * Input for plan rejection operation
 */
export interface RejectPlanInput {
	readonly reason?: string
	readonly feedback?: string
	readonly planContent?: string // The rejected plan content for analysis
}

/**
 * Result of plan rejection operation
 */
export interface RejectPlanResult {
	readonly success: boolean
	readonly currentMode: WorkflowMode
	readonly hadApprovedPlan: boolean
	readonly suggestions: string[]
	readonly feedback?: string
}

/**
 * Use case error for plan rejection operations
 */
export class RejectPlanError extends Error {
	/**
	 * Create a new reject plan error
	 *
	 * @param message - Human-readable error message
	 * @param operation - The operation that failed
	 * @param cause - Original error that caused this error
	 */
	constructor(
		message: string,
		public readonly operation: string,
		public override readonly cause?: Error
	) {
		super(message)
		this.name = "RejectPlanError"
	}
}

/**
 * Use case for rejecting a strategic plan
 *
 * Handles the workflow when a user rejects a proposed plan,
 * providing feedback and keeping the system in planning mode.
 */
export class RejectPlan {
	constructor(
		private readonly planRepository: IPlanRepository
	) {}

	/**
	 * Execute the plan rejection workflow
	 *
	 * @param input - Plan rejection input data
	 * @returns Promise resolving to rejection result
	 * @throws RejectPlanError if rejection handling fails
	 */
	async execute(input: RejectPlanInput = {}): Promise<RejectPlanResult> {
		try {
			// 1. Get current state
			const currentMode = await this.planRepository.getCurrentMode()
			const existingApprovedPlan = await this.planRepository.getApprovedPlan()

			// 2. Clear any approved plan (in case user is rejecting an existing plan)
			const hadApprovedPlan = existingApprovedPlan !== null
			if (hadApprovedPlan) {
				await this.planRepository.clearApprovedPlan()
			}

			// 3. Ensure we're in PLAN mode for retry
			if (!currentMode.isPlanMode()) {
				await this.planRepository.setCurrentMode(WorkflowMode.PLAN)
			}

			// 4. Generate suggestions for plan improvement
			const suggestions = this.generatePlanSuggestions(input.planContent, input.reason)

			// 5. Log rejection for analytics (if needed in future)
			await this.logRejection(input, existingApprovedPlan)

			return {
				success: true,
				currentMode: WorkflowMode.PLAN,
				hadApprovedPlan,
				suggestions,
				feedback: input.feedback
			}

		} catch (error) {
			if (error instanceof RejectPlanError) {
				throw error
			}

			throw new RejectPlanError(
				`Plan rejection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				"execute",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Generate suggestions for improving the rejected plan
	 *
	 * @param planContent - The rejected plan content
	 * @param reason - Reason for rejection
	 * @returns Array of improvement suggestions
	 */
	private generatePlanSuggestions(planContent?: string, reason?: string): string[] {
		const suggestions: string[] = []

		// Analyze plan content if provided
		if (planContent) {
			// Check for common plan structure issues
			if (!planContent.match(/^#\s+Plan:/m)) {
				suggestions.push("Consider starting with a clear plan title: '# Plan: [Your Title]'")
			}

			if (!planContent.match(/^#{2,3}\s+Phase/m)) {
				suggestions.push("Break down the work into phases for better organization")
			}

			if (!planContent.match(/approach|strategy|method/i)) {
				suggestions.push("Include your technical approach and reasoning")
			}

			if (!planContent.match(/test|validation|verification/i)) {
				suggestions.push("Consider adding testing and validation strategies")
			}

			if (!planContent.match(/risk|issue|challenge/i)) {
				suggestions.push("Include potential risks and mitigation strategies")
			}

			if (planContent.length < 500) {
				suggestions.push("Provide more detailed planning - consider expanding each phase")
			}

			if (!planContent.match(/deliverable|outcome|result/i)) {
				suggestions.push("Clearly define deliverables and expected outcomes")
			}
		}

		// Add reason-specific suggestions
		if (reason) {
			const reasonLower = reason.toLowerCase()

			if (reasonLower.includes('too vague') || reasonLower.includes('unclear')) {
				suggestions.push("Add more specific details about implementation steps")
				suggestions.push("Include file names, component names, and specific technologies")
			}

			if (reasonLower.includes('too complex') || reasonLower.includes('complicated')) {
				suggestions.push("Break down complex phases into smaller, manageable steps")
				suggestions.push("Consider reducing scope for initial implementation")
			}

			if (reasonLower.includes('missing') || reasonLower.includes('incomplete')) {
				suggestions.push("Ensure all required components are covered in the plan")
				suggestions.push("Add any missing phases or considerations")
			}

			if (reasonLower.includes('wrong approach') || reasonLower.includes('different')) {
				suggestions.push("Reconsider the technical approach based on requirements")
				suggestions.push("Research alternative implementation strategies")
			}
		}

		// Default suggestions if no specific issues found
		if (suggestions.length === 0) {
			suggestions.push("Consider adding more detail to the implementation phases")
			suggestions.push("Include specific technologies and tools to be used")
			suggestions.push("Add estimated time for each phase")
			suggestions.push("Consider potential challenges and how to address them")
		}

		return suggestions.slice(0, 5) // Limit to 5 most relevant suggestions
	}

	/**
	 * Log the plan rejection for future analytics
	 *
	 * @param input - Rejection input data
	 * @param rejectedPlan - The plan that was rejected
	 */
	private async logRejection(
		input: RejectPlanInput,
		rejectedPlan: ApprovedPlan | null
	): Promise<void> {
		try {
			// For now, this is a placeholder for future analytics
			// Could log to telemetry service, file, or analytics platform

			if (process.env.NODE_ENV === 'development') {
				console.debug('[RejectPlan] Plan rejected', {
					reason: input.reason,
					hadExistingPlan: rejectedPlan !== null,
					planTitle: rejectedPlan?.getTitle(),
					timestamp: new Date().toISOString()
				})
			}

			// Future: Implement actual logging
			// await this.analyticsService.logPlanRejection({
			//   reason: input.reason,
			//   planTitle: rejectedPlan?.getTitle(),
			//   planLength: input.planContent?.length,
			//   timestamp: Date.now()
			// })

		} catch (error) {
			// Don't fail the rejection operation if logging fails
			if (process.env.NODE_ENV === 'development') {
				console.warn('[RejectPlan] Failed to log rejection:', error)
			}
		}
	}

	/**
	 * Get current plan state for diagnostics
	 *
	 * @returns Promise resolving to current state information
	 */
	async getStateInfo(): Promise<{
		currentMode: WorkflowMode
		hasApprovedPlan: boolean
		canReject: boolean
	}> {
		try {
			const currentMode = await this.planRepository.getCurrentMode()
			const hasApprovedPlan = await this.planRepository.hasActivePlan()

			return {
				currentMode: currentMode.currentMode,
				hasApprovedPlan,
				canReject: currentMode.isPlanMode() || hasApprovedPlan
			}
		} catch (error) {
			throw new RejectPlanError(
				"Failed to get state information",
				"getStateInfo",
				error instanceof Error ? error : undefined
			)
		}
	}
}