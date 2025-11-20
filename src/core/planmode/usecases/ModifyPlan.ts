/**
 * Module: ModifyPlan (use case)
 * Purpose: Handle plan modification workflow
 * Responsibilities:
 *  - Keep system in PLAN mode for plan refinement
 *  - Track modification history
 *  - Provide guidance for plan improvements
 *  - Clear any pending approved plan
 * Preconditions:
 *  - User has a plan they want to modify
 *  - Should be in PLAN mode or have an approved plan
 * Postconditions:
 *  - System returns to PLAN mode
 *  - No approved plan stored (cleared for new version)
 *  - Ready for AI to create modified plan
 * Dependencies: IPlanRepository
 * Security: No sensitive data handling
 * Performance: Fast operation, mainly state management
 */

import { PlanMode, WorkflowMode } from "../domain/PlanMode"
import { ApprovedPlan } from "../domain/ApprovedPlan"
import { IPlanRepository } from "../ports/IPlanRepository"

/**
 * Input for plan modification operation
 */
export interface ModifyPlanInput {
	readonly feedback?: string
	readonly specificChanges?: string[]
	readonly originalPlanContent?: string // The plan being modified
	readonly preserveStructure?: boolean // Whether to keep the same structure
}

/**
 * Result of plan modification operation
 */
export interface ModifyPlanResult {
	readonly success: boolean
	readonly currentMode: WorkflowMode
	readonly hadApprovedPlan: boolean
	readonly modificationGuidance: string[]
	readonly originalPlanSummary?: string
	readonly feedback?: string
}

/**
 * Use case error for plan modification operations
 */
export class ModifyPlanError extends Error {
	/**
	 * Create a new modify plan error
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
		this.name = "ModifyPlanError"
	}
}

/**
 * Use case for modifying a strategic plan
 *
 * Handles the workflow when a user wants to modify an existing plan,
 * providing guidance and resetting the system for plan recreation.
 */
export class ModifyPlan {
	constructor(
		private readonly planRepository: IPlanRepository
	) {}

	/**
	 * Execute the plan modification workflow
	 *
	 * @param input - Plan modification input data
	 * @returns Promise resolving to modification result
	 * @throws ModifyPlanError if modification handling fails
	 */
	async execute(input: ModifyPlanInput = {}): Promise<ModifyPlanResult> {
		try {
			// 1. Get current state
			const currentMode = await this.planRepository.getCurrentMode()
			const existingApprovedPlan = await this.planRepository.getApprovedPlan()

			// 2. Capture original plan information for guidance
			const originalPlanSummary = existingApprovedPlan?.getSummary()

			// 3. Clear any approved plan to make room for the modified version
			const hadApprovedPlan = existingApprovedPlan !== null
			if (hadApprovedPlan) {
				await this.planRepository.clearApprovedPlan()
			}

			// 4. Ensure we're in PLAN mode for modification
			if (!currentMode.isPlanMode()) {
				await this.planRepository.setCurrentMode(WorkflowMode.PLAN)
			}

			// 5. Generate modification guidance based on input
			const modificationGuidance = this.generateModificationGuidance(
				input,
				existingApprovedPlan,
				input.originalPlanContent
			)

			// 6. Log modification request for analytics
			await this.logModification(input, existingApprovedPlan)

			return {
				success: true,
				currentMode: WorkflowMode.PLAN,
				hadApprovedPlan,
				modificationGuidance,
				originalPlanSummary,
				feedback: input.feedback
			}

		} catch (error) {
			if (error instanceof ModifyPlanError) {
				throw error
			}

			throw new ModifyPlanError(
				`Plan modification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				"execute",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Generate guidance for plan modification
	 *
	 * @param input - Modification input with user requirements
	 * @param originalPlan - The existing approved plan
	 * @param planContent - The original plan content
	 * @returns Array of modification guidance
	 */
	private generateModificationGuidance(
		input: ModifyPlanInput,
		originalPlan: ApprovedPlan | null,
		planContent?: string
	): string[] {
		const guidance: string[] = []

		// Add user feedback as primary guidance
		if (input.feedback) {
			guidance.push(`User feedback: ${input.feedback}`)
		}

		// Add specific changes requested
		if (input.specificChanges && input.specificChanges.length > 0) {
			guidance.push("Specific changes requested:")
			input.specificChanges.forEach(change => {
				guidance.push(`- ${change}`)
			})
		}

		// Provide structure guidance
		if (input.preserveStructure) {
			guidance.push("Maintain the original plan structure while incorporating changes")
		} else {
			guidance.push("Feel free to restructure the plan as needed for the requested changes")
		}

		// Analyze original plan for improvement suggestions
		if (originalPlan) {
			const phases = originalPlan.extractPhases()

			if (phases.length === 0) {
				guidance.push("Consider adding phase structure to the plan for better organization")
			}

			if (originalPlan.isCompleted()) {
				guidance.push("Note: The original plan was marked as completed. Consider if a new plan is needed.")
			} else if (originalPlan.hasStarted()) {
				guidance.push(`Original plan was in progress (Phase ${originalPlan.currentPhase + 1}). Consider impact on ongoing work.`)
			}
		}

		// Analyze plan content for common modification patterns
		if (planContent) {
			const content = planContent.toLowerCase()

			// Check for common modification triggers
			if (input.feedback?.toLowerCase().includes('scope') || content.includes('scope')) {
				guidance.push("Consider scope changes: addition/removal of features or phases")
			}

			if (input.feedback?.toLowerCase().includes('technology') || input.feedback?.toLowerCase().includes('tech')) {
				guidance.push("Review technology choices and update implementation approach")
			}

			if (input.feedback?.toLowerCase().includes('time') || input.feedback?.toLowerCase().includes('deadline')) {
				guidance.push("Adjust timeline and phase estimates based on new requirements")
			}

			if (input.feedback?.toLowerCase().includes('approach') || input.feedback?.toLowerCase().includes('method')) {
				guidance.push("Reconsider the implementation approach and methodology")
			}

			if (input.feedback?.toLowerCase().includes('detail') || input.feedback?.toLowerCase().includes('specific')) {
				guidance.push("Add more specific details and implementation steps")
			}
		}

		// Add general modification best practices
		guidance.push("Ensure the modified plan addresses all original requirements plus new changes")
		guidance.push("Update time estimates and dependencies based on modifications")
		guidance.push("Consider how changes affect testing and validation strategies")

		// Default guidance if no specific input provided
		if (guidance.length === 0) {
			guidance.push("Please specify what aspects of the plan you'd like to modify")
			guidance.push("Consider: scope changes, technology updates, timeline adjustments, or approach refinements")
		}

		return guidance.slice(0, 8) // Limit to 8 most relevant guidance items
	}

	/**
	 * Log the plan modification request for future analytics
	 *
	 * @param input - Modification input data
	 * @param originalPlan - The plan being modified
	 */
	private async logModification(
		input: ModifyPlanInput,
		originalPlan: ApprovedPlan | null
	): Promise<void> {
		try {
			// For now, this is a placeholder for future analytics
			if (process.env.NODE_ENV === 'development') {
				console.debug('[ModifyPlan] Plan modification requested', {
					hasFeedback: !!input.feedback,
					hasSpecificChanges: !!input.specificChanges?.length,
					originalPlanTitle: originalPlan?.getTitle(),
					originalPlanProgress: originalPlan?.getCompletionPercentage(),
					preserveStructure: input.preserveStructure,
					timestamp: new Date().toISOString()
				})
			}

			// Future: Implement actual logging
			// await this.analyticsService.logPlanModification({
			//   modificationReason: input.feedback,
			//   originalPlanTitle: originalPlan?.getTitle(),
			//   changeCount: input.specificChanges?.length || 0,
			//   timestamp: Date.now()
			// })

		} catch (error) {
			// Don't fail the modification operation if logging fails
			if (process.env.NODE_ENV === 'development') {
				console.warn('[ModifyPlan] Failed to log modification:', error)
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
		canModify: boolean
		planSummary?: string
	}> {
		try {
			const currentMode = await this.planRepository.getCurrentMode()
			const approvedPlan = await this.planRepository.getApprovedPlan()

			return {
				currentMode: currentMode.currentMode,
				hasApprovedPlan: approvedPlan !== null,
				canModify: true, // Can always request modification
				planSummary: approvedPlan?.getSummary()
			}
		} catch (error) {
			throw new ModifyPlanError(
				"Failed to get state information",
				"getStateInfo",
				error instanceof Error ? error : undefined
			)
		}
	}
}