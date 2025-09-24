/**
 * Module: PlanMode (domain entity)
 * Purpose: Core workflow mode entity for strategic planning system
 * Responsibilities:
 *  - Model workflow states (PLAN, CHAT, AGENT) and transitions
 *  - Enforce business rules for mode switching
 *  - Validate state consistency and provide mode checking utilities
 * Invariants:
 *  - currentMode must be one of the defined WorkflowMode values
 *  - Mode transitions follow defined business rules (PLAN → CHAT/AGENT, not CHAT ↔ AGENT)
 *  - Entity is immutable (returns new instances for changes)
 *  - All instances are created through static factory method with validation
 * Dependencies: None (pure domain entity, framework-agnostic)
 * Security: No sensitive data handling, input validation prevents injection
 * Performance: Lightweight value object with O(1) operations, no heavy computation
 * Risk Notes: Mode transitions affect system behavior significantly - PLAN mode restricts to read-only operations
 */

/**
 * Valid workflow modes for the system
 */
export enum WorkflowMode {
	PLAN = 'plan',
	CHAT = 'chat',
	AGENT = 'agent'
}

/**
 * Domain validation error for plan mode operations
 *
 * Thrown when plan mode operations violate domain rules or constraints.
 * Includes context-specific information for precise error reporting.
 */
export class PlanModeValidationError extends Error {
	/**
	 * Create a new plan mode validation error
	 *
	 * @param message - Human-readable error message
	 * @param context - Additional context about the error
	 */
	constructor(message: string, public readonly context?: Record<string, unknown>) {
		super(message)
		this.name = "PlanModeValidationError"
	}
}

/**
 * Raw plan mode data as received from external sources
 *
 * Represents unvalidated data structure before domain validation.
 * Used as input to PlanMode.create() factory method.
 */
export interface PlanModeData {
	currentMode: string
	isTransitioning?: boolean
}

/**
 * Immutable plan mode domain model
 *
 * Represents the current workflow mode state with validation and transition logic.
 * Follows Clean Architecture principles with pure domain logic.
 */
export class PlanMode {
	private constructor(
		public readonly currentMode: WorkflowMode,
		public readonly isTransitioning: boolean = false
	) {}

	/**
	 * Factory method to create a PlanMode with validation
	 *
	 * @param data - Raw plan mode data to validate
	 * @returns Validated PlanMode instance
	 * @throws PlanModeValidationError if data is invalid
	 */
	static create(data: PlanModeData): PlanMode {
		// Validate required fields
		if (!data.currentMode?.trim()) {
			throw new PlanModeValidationError("Current mode is required", { data })
		}

		// Validate mode is one of allowed values
		if (!Object.values(WorkflowMode).includes(data.currentMode as WorkflowMode)) {
			throw new PlanModeValidationError(
				`Invalid workflow mode: ${data.currentMode}. Must be one of: ${Object.values(WorkflowMode).join(', ')}`,
				{ providedMode: data.currentMode, validModes: Object.values(WorkflowMode) }
			)
		}

		return new PlanMode(
			data.currentMode as WorkflowMode,
			data.isTransitioning ?? false
		)
	}

	/**
	 * Create a PlanMode with default values
	 *
	 * @returns PlanMode instance in CHAT mode
	 */
	static createDefault(): PlanMode {
		return new PlanMode(WorkflowMode.CHAT, false)
	}

	/**
	 * Check if the current mode is PLAN
	 */
	isPlanMode(): boolean {
		return this.currentMode === WorkflowMode.PLAN
	}

	/**
	 * Check if the current mode is CHAT
	 */
	isChatMode(): boolean {
		return this.currentMode === WorkflowMode.CHAT
	}

	/**
	 * Check if the current mode is AGENT
	 */
	isAgentMode(): boolean {
		return this.currentMode === WorkflowMode.AGENT
	}

	/**
	 * Check if transition to target mode is valid
	 *
	 * @param targetMode - Mode to transition to
	 * @returns true if transition is allowed
	 */
	canTransitionTo(targetMode: WorkflowMode): boolean {
		// All transitions are allowed for now
		// Future: Add business rules for restricted transitions
		return targetMode !== this.currentMode
	}

	/**
	 * Create a new PlanMode with the specified mode
	 *
	 * @param newMode - Target workflow mode
	 * @returns New PlanMode instance
	 * @throws PlanModeValidationError if transition is invalid
	 */
	transitionTo(newMode: WorkflowMode): PlanMode {
		if (!this.canTransitionTo(newMode)) {
			throw new PlanModeValidationError(
				`Cannot transition from ${this.currentMode} to ${newMode}`,
				{ currentMode: this.currentMode, targetMode: newMode }
			)
		}

		return new PlanMode(newMode, false)
	}

	/**
	 * Create a copy marked as transitioning
	 *
	 * @returns New PlanMode instance marked as transitioning
	 */
	withTransitioning(isTransitioning: boolean): PlanMode {
		return new PlanMode(this.currentMode, isTransitioning)
	}

	/**
	 * Convert to plain object for serialization
	 *
	 * @returns Plain object representation
	 */
	toData(): PlanModeData {
		return {
			currentMode: this.currentMode,
			isTransitioning: this.isTransitioning
		}
	}

	/**
	 * Get a human-readable description of the current mode
	 */
	getDescription(): string {
		switch (this.currentMode) {
			case WorkflowMode.PLAN:
				return "Plan mode - AI creates strategic plans before execution"
			case WorkflowMode.CHAT:
				return "Chat mode - Interactive conversation with execution"
			case WorkflowMode.AGENT:
				return "Agent mode - Autonomous task execution"
			default:
				return `Unknown mode: ${this.currentMode}`
		}
	}

	/**
	 * Check equality with another PlanMode
	 *
	 * @param other - Other PlanMode to compare
	 * @returns true if modes are equal
	 */
	equals(other: PlanMode): boolean {
		return this.currentMode === other.currentMode &&
			   this.isTransitioning === other.isTransitioning
	}
}