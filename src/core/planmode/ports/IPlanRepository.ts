/**
 * Module: IPlanRepository (port/interface)
 * Purpose: Repository interface for plan mode state persistence
 * Responsibilities:
 *  - Abstract plan mode state storage operations
 *  - Provide clean interface for workflow mode management
 *  - Enable testability through dependency inversion
 * Invariants:
 *  - All operations are async to support various storage backends
 *  - Methods should be idempotent where possible
 * Dependencies: PlanMode, ApprovedPlan domain entities
 * Security: Repository implementations must handle data validation
 * Performance: Interface allows for caching implementations
 */

import { PlanMode, WorkflowMode } from "../domain/PlanMode"
import { ApprovedPlan } from "../domain/ApprovedPlan"

/**
 * Repository error for plan storage operations
 */
export class PlanRepositoryError extends Error {
	/**
	 * Create a new plan repository error
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
		this.name = "PlanRepositoryError"
	}
}

/**
 * Repository interface for plan mode state persistence
 *
 * Abstracts the storage mechanism for workflow mode and approved plans.
 * Implementations can use VS Code globalState, files, databases, etc.
 */
export interface IPlanRepository {
	/**
	 * Get the current workflow mode
	 *
	 * @returns Promise resolving to current PlanMode or default if not set
	 * @throws PlanRepositoryError if storage access fails
	 */
	getCurrentMode(): Promise<PlanMode>

	/**
	 * Set the current workflow mode
	 *
	 * @param mode - New workflow mode to set
	 * @throws PlanRepositoryError if storage write fails
	 */
	setCurrentMode(mode: WorkflowMode): Promise<void>

	/**
	 * Get the currently approved plan if any
	 *
	 * @returns Promise resolving to ApprovedPlan or null if none
	 * @throws PlanRepositoryError if storage access fails
	 */
	getApprovedPlan(): Promise<ApprovedPlan | null>

	/**
	 * Save an approved plan
	 *
	 * @param plan - Approved plan to store
	 * @throws PlanRepositoryError if storage write fails
	 */
	setApprovedPlan(plan: ApprovedPlan): Promise<void>

	/**
	 * Clear the currently approved plan
	 *
	 * @throws PlanRepositoryError if storage write fails
	 */
	clearApprovedPlan(): Promise<void>

	/**
	 * Update the progress of the approved plan
	 *
	 * @param currentPhase - New current phase index
	 * @param completedPhases - Updated list of completed phase names
	 * @throws PlanRepositoryError if no plan exists or storage write fails
	 */
	updatePlanProgress(currentPhase: number, completedPhases: string[]): Promise<void>

	/**
	 * Check if a plan is currently active (approved and not completed)
	 *
	 * @returns Promise resolving to true if an active plan exists
	 */
	hasActivePlan(): Promise<boolean>

	/**
	 * Get plan state for debugging and diagnostics
	 *
	 * @returns Promise resolving to current state information
	 */
	getStateInfo(): Promise<{
		hasMode: boolean
		currentMode?: WorkflowMode
		hasApprovedPlan: boolean
		planTitle?: string
		planProgress?: number
	}>
}