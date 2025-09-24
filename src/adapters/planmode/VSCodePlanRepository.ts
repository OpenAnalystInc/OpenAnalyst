/**
 * Module: VSCodePlanRepository (adapter)
 * Purpose: VS Code adapter implementing IPlanRepository using globalState
 * Responsibilities:
 *  - Implement plan mode state persistence using VS Code's globalState
 *  - Handle serialization/deserialization of domain objects
 *  - Provide error handling and logging for storage operations
 * Invariants:
 *  - All state changes are persisted to VS Code globalState
 *  - Domain objects are validated before storage
 *  - Errors are mapped to domain-specific exceptions
 * Dependencies: vscode.ExtensionContext, domain entities
 * Security: Uses VS Code's secure storage mechanism
 * Performance: Synchronous operations with VS Code's in-memory state
 */

import * as vscode from "vscode"
import { PlanMode, PlanModeData, WorkflowMode } from "../../core/planmode/domain/PlanMode"
import { ApprovedPlan, ApprovedPlanData } from "../../core/planmode/domain/ApprovedPlan"
import { IPlanRepository, PlanRepositoryError } from "../../core/planmode/ports/IPlanRepository"

/**
 * Storage keys for VS Code globalState
 */
const STORAGE_KEYS = {
	WORKFLOW_MODE: "planMode.workflowMode",
	APPROVED_PLAN: "planMode.approvedPlan"
} as const

/**
 * VS Code adapter for plan mode repository
 *
 * Implements IPlanRepository using VS Code's globalState for persistence.
 * Handles conversion between domain objects and storage format.
 */
export class VSCodePlanRepository implements IPlanRepository {
	constructor(
		private readonly context: vscode.ExtensionContext
	) {}

	/**
	 * Get the current workflow mode
	 *
	 * @returns Promise resolving to current PlanMode or default if not set
	 * @throws PlanRepositoryError if storage access fails
	 */
	async getCurrentMode(): Promise<PlanMode> {
		try {
			const storedMode = await this.context.globalState.get<string>(
				STORAGE_KEYS.WORKFLOW_MODE,
				WorkflowMode.CHAT // Default to CHAT mode
			)

			const planModeData: PlanModeData = {
				currentMode: storedMode
			}

			return PlanMode.create(planModeData)

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to get current workflow mode",
				"getCurrentMode",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Set the current workflow mode
	 *
	 * @param mode - New workflow mode to set
	 * @throws PlanRepositoryError if storage write fails
	 */
	async setCurrentMode(mode: WorkflowMode): Promise<void> {
		try {
			// Validate the mode using domain logic
			const planMode = PlanMode.create({ currentMode: mode })

			await this.context.globalState.update(
				STORAGE_KEYS.WORKFLOW_MODE,
				planMode.currentMode
			)

			if (process.env.NODE_ENV === 'development') {
				console.debug('[VSCodePlanRepository] Workflow mode updated', {
					newMode: mode,
					timestamp: new Date().toISOString()
				})
			}

		} catch (error) {
			throw new PlanRepositoryError(
				`Failed to set workflow mode to ${mode}`,
				"setCurrentMode",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Get the currently approved plan if any
	 *
	 * @returns Promise resolving to ApprovedPlan or null if none
	 * @throws PlanRepositoryError if storage access fails
	 */
	async getApprovedPlan(): Promise<ApprovedPlan | null> {
		try {
			const storedPlan = await this.context.globalState.get<ApprovedPlanData>(
				STORAGE_KEYS.APPROVED_PLAN
			)

			if (!storedPlan) {
				return null
			}

			// Validate and create domain object
			return ApprovedPlan.create(storedPlan)

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to get approved plan",
				"getApprovedPlan",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Save an approved plan
	 *
	 * @param plan - Approved plan to store
	 * @throws PlanRepositoryError if storage write fails
	 */
	async setApprovedPlan(plan: ApprovedPlan): Promise<void> {
		try {
			const planData = plan.toData()

			await this.context.globalState.update(
				STORAGE_KEYS.APPROVED_PLAN,
				planData
			)

			if (process.env.NODE_ENV === 'development') {
				console.debug('[VSCodePlanRepository] Approved plan stored', {
					title: plan.getTitle(),
					phases: plan.getTotalPhases(),
					estimatedHours: plan.estimatedHours,
					timestamp: new Date().toISOString()
				})
			}

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to save approved plan",
				"setApprovedPlan",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Clear the currently approved plan
	 *
	 * @throws PlanRepositoryError if storage write fails
	 */
	async clearApprovedPlan(): Promise<void> {
		try {
			await this.context.globalState.update(
				STORAGE_KEYS.APPROVED_PLAN,
				undefined
			)

			if (process.env.NODE_ENV === 'development') {
				console.debug('[VSCodePlanRepository] Approved plan cleared', {
					timestamp: new Date().toISOString()
				})
			}

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to clear approved plan",
				"clearApprovedPlan",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Update the progress of the approved plan
	 *
	 * @param currentPhase - New current phase index
	 * @param completedPhases - Updated list of completed phase names
	 * @throws PlanRepositoryError if no plan exists or storage write fails
	 */
	async updatePlanProgress(currentPhase: number, completedPhases: string[]): Promise<void> {
		try {
			const existingPlan = await this.getApprovedPlan()
			if (!existingPlan) {
				throw new PlanRepositoryError(
					"Cannot update progress: no approved plan exists",
					"updatePlanProgress"
				)
			}

			// Create updated plan with new progress
			const updatedPlan = existingPlan.updateProgress(currentPhase, completedPhases)

			await this.setApprovedPlan(updatedPlan)

			if (process.env.NODE_ENV === 'development') {
				console.debug('[VSCodePlanRepository] Plan progress updated', {
					currentPhase,
					completedPhases: completedPhases.length,
					completion: updatedPlan.getCompletionPercentage(),
					timestamp: new Date().toISOString()
				})
			}

		} catch (error) {
			if (error instanceof PlanRepositoryError) {
				throw error
			}

			throw new PlanRepositoryError(
				"Failed to update plan progress",
				"updatePlanProgress",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Check if a plan is currently active (approved and not completed)
	 *
	 * @returns Promise resolving to true if an active plan exists
	 */
	async hasActivePlan(): Promise<boolean> {
		try {
			const approvedPlan = await this.getApprovedPlan()
			return approvedPlan !== null && !approvedPlan.isCompleted()

		} catch (error) {
			// Don't throw for this query method, just return false
			if (process.env.NODE_ENV === 'development') {
				console.warn('[VSCodePlanRepository] Error checking for active plan:', error)
			}
			return false
		}
	}

	/**
	 * Get plan state for debugging and diagnostics
	 *
	 * @returns Promise resolving to current state information
	 */
	async getStateInfo(): Promise<{
		hasMode: boolean
		currentMode?: WorkflowMode
		hasApprovedPlan: boolean
		planTitle?: string
		planProgress?: number
	}> {
		try {
			const currentMode = await this.getCurrentMode()
			const approvedPlan = await this.getApprovedPlan()

			return {
				hasMode: true,
				currentMode: currentMode.currentMode,
				hasApprovedPlan: approvedPlan !== null,
				planTitle: approvedPlan?.getTitle(),
				planProgress: approvedPlan?.getCompletionPercentage()
			}

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to get state information",
				"getStateInfo",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Clear all plan mode state (for debugging/reset purposes)
	 *
	 * @throws PlanRepositoryError if storage operations fail
	 */
	async clearAllState(): Promise<void> {
		try {
			await Promise.all([
				this.context.globalState.update(STORAGE_KEYS.WORKFLOW_MODE, undefined),
				this.context.globalState.update(STORAGE_KEYS.APPROVED_PLAN, undefined)
			])

			if (process.env.NODE_ENV === 'development') {
				console.debug('[VSCodePlanRepository] All plan mode state cleared', {
					timestamp: new Date().toISOString()
				})
			}

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to clear all plan mode state",
				"clearAllState",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Get storage statistics for diagnostics
	 *
	 * @returns Storage usage information
	 */
	async getStorageStats(): Promise<{
		totalKeys: number
		planModeKeys: string[]
		storageSizeEstimate: number
	}> {
		try {
			const globalState = this.context.globalState
			const allKeys = globalState.keys()
			const planModeKeys = allKeys.filter(key => key.startsWith('planMode.'))

			// Estimate storage size (rough approximation)
			let sizeEstimate = 0
			for (const key of planModeKeys) {
				const value = await globalState.get(key)
				if (value) {
					sizeEstimate += JSON.stringify(value).length
				}
			}

			return {
				totalKeys: allKeys.length,
				planModeKeys,
				storageSizeEstimate: sizeEstimate
			}

		} catch (error) {
			throw new PlanRepositoryError(
				"Failed to get storage statistics",
				"getStorageStats",
				error instanceof Error ? error : undefined
			)
		}
	}
}