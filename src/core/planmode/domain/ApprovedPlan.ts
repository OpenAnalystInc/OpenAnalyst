/**
 * Module: ApprovedPlan (domain/value-object)
 * Purpose: Value object representing an approved strategic plan
 * Responsibilities:
 *  - Encapsulate approved plan data and metadata
 *  - Validate plan structure and content
 *  - Provide plan phase tracking
 *  - Ensure immutability and data integrity
 * Invariants:
 *  - Approved plan content must be non-empty
 *  - Approval timestamp must be valid
 *  - Phase tracking must be consistent
 * Dependencies: None (pure domain logic)
 * Security: No sensitive data - plans are strategic documents
 * Performance: Immutable design with efficient phase tracking
 */

/**
 * Plan phase information
 */
export interface PlanPhase {
	readonly name: string
	readonly description: string
	readonly status: 'pending' | 'in_progress' | 'completed'
	readonly estimatedHours?: number
}

/**
 * Domain validation error for approved plan operations
 */
export class ApprovedPlanValidationError extends Error {
	/**
	 * Create a new approved plan validation error
	 *
	 * @param message - Human-readable error message
	 * @param field - Optional field name that caused the validation error
	 */
	constructor(message: string, public readonly field?: string) {
		super(message)
		this.name = "ApprovedPlanValidationError"
	}
}

/**
 * Raw approved plan data as received from external sources
 */
export interface ApprovedPlanData {
	content: string
	approvedAt?: number
	currentPhase?: number
	completedPhases?: string[]
	estimatedHours?: number
	planBlockId?: string
}

/**
 * Immutable approved plan value object
 *
 * Represents a strategic plan that has been approved for execution.
 * Contains the plan content, tracking information, and execution state.
 */
export class ApprovedPlan {
	private constructor(
		public readonly content: string,
		public readonly approvedAt: number,
		public readonly currentPhase: number,
		public readonly completedPhases: readonly string[],
		public readonly estimatedHours?: number,
		public readonly planBlockId?: string
	) {}

	/**
	 * Factory method to create an ApprovedPlan with validation
	 *
	 * @param data - Raw approved plan data to validate
	 * @returns Validated ApprovedPlan instance
	 * @throws ApprovedPlanValidationError if data is invalid
	 */
	static create(data: ApprovedPlanData): ApprovedPlan {
		// Validate required fields
		if (!data.content?.trim()) {
			throw new ApprovedPlanValidationError("Plan content is required", "content")
		}

		// Validate approval timestamp
		const approvedAt = data.approvedAt ?? Date.now()
		if (approvedAt <= 0 || approvedAt > Date.now()) {
			throw new ApprovedPlanValidationError("Invalid approval timestamp", "approvedAt")
		}

		// Validate current phase
		const currentPhase = data.currentPhase ?? 0
		if (currentPhase < 0) {
			throw new ApprovedPlanValidationError("Current phase cannot be negative", "currentPhase")
		}

		// Validate estimated hours if provided
		if (data.estimatedHours !== undefined && data.estimatedHours <= 0) {
			throw new ApprovedPlanValidationError("Estimated hours must be positive", "estimatedHours")
		}

		return new ApprovedPlan(
			data.content.trim(),
			approvedAt,
			currentPhase,
			data.completedPhases ? [...data.completedPhases] : [],
			data.estimatedHours,
			data.planBlockId?.trim()
		)
	}

	/**
	 * Extract phases from plan content using markdown parsing
	 *
	 * @returns Array of detected phases
	 */
	extractPhases(): PlanPhase[] {
		const phases: PlanPhase[] = []
		const lines = this.content.split('\n')

		for (const line of lines) {
			// Look for phase headers: ## Phase N: Title or ### Phase N: Title
			const phaseMatch = line.match(/^#{2,3}\s+Phase\s+(\d+):\s*(.+)$/i)
			if (phaseMatch) {
				const phaseNumber = parseInt(phaseMatch[1], 10)
				const phaseName = phaseMatch[2].trim()

				// Determine status based on current progress
				let status: PlanPhase['status'] = 'pending'
				if (phaseNumber - 1 < this.currentPhase) {
					status = 'completed'
				} else if (phaseNumber - 1 === this.currentPhase) {
					status = 'in_progress'
				}

				phases.push({
					name: phaseName,
					description: `Phase ${phaseNumber}: ${phaseName}`,
					status
				})
			}
		}

		return phases
	}

	/**
	 * Get the current phase name
	 *
	 * @returns Current phase name or null if no phases detected
	 */
	getCurrentPhaseName(): string | null {
		const phases = this.extractPhases()
		return phases[this.currentPhase]?.name ?? null
	}

	/**
	 * Get the total number of phases in the plan
	 */
	getTotalPhases(): number {
		return this.extractPhases().length
	}

	/**
	 * Calculate completion percentage
	 *
	 * @returns Completion percentage (0-100)
	 */
	getCompletionPercentage(): number {
		const totalPhases = this.getTotalPhases()
		if (totalPhases === 0) return 0

		return Math.round((this.completedPhases.length / totalPhases) * 100)
	}

	/**
	 * Check if the plan is fully completed
	 */
	isCompleted(): boolean {
		const totalPhases = this.getTotalPhases()
		return totalPhases > 0 && this.completedPhases.length >= totalPhases
	}

	/**
	 * Check if the plan has started execution
	 */
	hasStarted(): boolean {
		return this.currentPhase > 0 || this.completedPhases.length > 0
	}

	/**
	 * Mark the current phase as completed and advance
	 *
	 * @param phaseName - Name of the completed phase
	 * @returns New ApprovedPlan with updated progress
	 */
	completeCurrentPhase(phaseName: string): ApprovedPlan {
		const phases = this.extractPhases()
		const totalPhases = phases.length

		// Don't advance beyond the last phase
		const nextPhase = Math.min(this.currentPhase + 1, totalPhases)
		const updatedCompletedPhases = [...this.completedPhases, phaseName.trim()]

		return new ApprovedPlan(
			this.content,
			this.approvedAt,
			nextPhase,
			updatedCompletedPhases,
			this.estimatedHours,
			this.planBlockId
		)
	}

	/**
	 * Update the current phase without marking completion
	 *
	 * @param phaseIndex - New current phase index
	 * @returns New ApprovedPlan with updated current phase
	 */
	setCurrentPhase(phaseIndex: number): ApprovedPlan {
		if (phaseIndex < 0) {
			throw new ApprovedPlanValidationError("Phase index cannot be negative")
		}

		return new ApprovedPlan(
			this.content,
			this.approvedAt,
			phaseIndex,
			this.completedPhases,
			this.estimatedHours,
			this.planBlockId
		)
	}

	/**
	 * Update the plan progress with new phase and completed phases
	 *
	 * @param currentPhase - New current phase index
	 * @param completedPhases - Updated list of completed phase names
	 * @returns New ApprovedPlan instance with updated progress
	 */
	updateProgress(currentPhase: number, completedPhases: string[]): ApprovedPlan {
		if (currentPhase < 0) {
			throw new ApprovedPlanValidationError("Phase index cannot be negative")
		}

		return new ApprovedPlan(
			this.content,
			this.approvedAt,
			currentPhase,
			completedPhases,
			this.estimatedHours,
			this.planBlockId
		)
	}

	/**
	 * Get a summary of the plan for display
	 */
	getSummary(): string {
		const titleMatch = this.content.match(/^#\s+Plan:\s*(.+)$/m)
		const title = titleMatch ? titleMatch[1] : 'Untitled Plan'

		const phases = this.extractPhases()
		const completionPercentage = this.getCompletionPercentage()

		return `${title} (${completionPercentage}% complete, ${phases.length} phases)`
	}

	/**
	 * Extract the plan title from content
	 */
	getTitle(): string {
		const titleMatch = this.content.match(/^#\s+Plan:\s*(.+)$/m)
		return titleMatch ? titleMatch[1].trim() : 'Untitled Plan'
	}

	/**
	 * Get the age of the approved plan in hours
	 */
	getAgeInHours(): number {
		return (Date.now() - this.approvedAt) / (1000 * 60 * 60)
	}

	/**
	 * Check if the plan is stale (older than specified hours)
	 *
	 * @param maxAgeHours - Maximum age in hours before plan is considered stale
	 * @returns true if plan is stale
	 */
	isStale(maxAgeHours: number = 24): boolean {
		return this.getAgeInHours() > maxAgeHours
	}

	/**
	 * Convert to plain object for serialization
	 *
	 * @returns Plain object representation
	 */
	toData(): ApprovedPlanData {
		return {
			content: this.content,
			approvedAt: this.approvedAt,
			currentPhase: this.currentPhase,
			completedPhases: [...this.completedPhases],
			estimatedHours: this.estimatedHours,
			planBlockId: this.planBlockId
		}
	}

	/**
	 * Create a copy with updated content
	 *
	 * @param newContent - Updated plan content
	 * @returns New ApprovedPlan with updated content
	 */
	withContent(newContent: string): ApprovedPlan {
		if (!newContent?.trim()) {
			throw new ApprovedPlanValidationError("Plan content cannot be empty")
		}

		return new ApprovedPlan(
			newContent.trim(),
			this.approvedAt,
			this.currentPhase,
			this.completedPhases,
			this.estimatedHours,
			this.planBlockId
		)
	}

	/**
	 * Check equality with another ApprovedPlan
	 *
	 * @param other - Other ApprovedPlan to compare
	 * @returns true if plans are equal
	 */
	equals(other: ApprovedPlan): boolean {
		return this.content === other.content &&
			   this.approvedAt === other.approvedAt &&
			   this.currentPhase === other.currentPhase &&
			   JSON.stringify(this.completedPhases) === JSON.stringify(other.completedPhases) &&
			   this.estimatedHours === other.estimatedHours &&
			   this.planBlockId === other.planBlockId
	}
}