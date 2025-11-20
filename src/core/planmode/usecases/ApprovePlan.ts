/**
 * Module: ApprovePlan (use case)
 * Purpose: Handle plan approval workflow
 * Responsibilities:
 *  - Validate plan structure and content
 *  - Store approved plan in repository
 *  - Trigger mode transition to execution
 *  - Save plan as reusable block for future use
 * Preconditions:
 *  - Must be in PLAN mode
 *  - Plan content must be valid strategic plan format
 * Postconditions:
 *  - Mode switches to CHAT for execution
 *  - Plan stored in repository with tracking metadata
 *  - Plan saved as block in storage for reusability
 * Dependencies: IPlanRepository, IPlanBlockStorage
 * Security: Validates plan content before storage
 * Performance: Async operations for I/O, plan saved in background
 */

import { ApprovedPlan, ApprovedPlanData } from "../domain/ApprovedPlan"
import { PlanMode, WorkflowMode } from "../domain/PlanMode"
import { IPlanRepository, PlanRepositoryError } from "../ports/IPlanRepository"
import { IPlanBlockStorage, PlanBlock, PlanBlockStorageError } from "../ports/IPlanBlockStorage"

/**
 * Input for plan approval operation
 */
export interface ApprovePlanInput {
	readonly planContent: string
	readonly estimatedHours?: number
	readonly saveAsBlock?: boolean
	readonly blockCategory?: string
	readonly blockDescription?: string
}

/**
 * Result of plan approval operation
 */
export interface ApprovePlanResult {
	readonly success: boolean
	readonly approvedPlan: ApprovedPlan
	readonly previousMode: WorkflowMode
	readonly newMode: WorkflowMode
	readonly savedAsBlock: boolean
	readonly blockName?: string
	readonly errors: string[]
	readonly warnings: string[]
}

/**
 * Use case error for plan approval operations
 */
export class ApprovePlanError extends Error {
	/**
	 * Create a new approve plan error
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
		this.name = "ApprovePlanError"
	}
}

/**
 * Use case for approving a strategic plan
 *
 * Orchestrates the workflow of plan approval including validation,
 * storage, mode transition, and optional block creation.
 */
export class ApprovePlan {
	constructor(
		private readonly planRepository: IPlanRepository,
		private readonly planBlockStorage: IPlanBlockStorage
	) {}

	/**
	 * Execute the plan approval workflow
	 *
	 * @param input - Plan approval input data
	 * @returns Promise resolving to approval result
	 * @throws ApprovePlanError if approval fails
	 */
	async execute(input: ApprovePlanInput): Promise<ApprovePlanResult> {
		const errors: string[] = []
		const warnings: string[] = []

		try {
			// 1. Validate current state
			const currentMode = await this.planRepository.getCurrentMode()
			if (!currentMode.isPlanMode()) {
				throw new ApprovePlanError(
					`Cannot approve plan in ${currentMode.currentMode} mode. Must be in PLAN mode.`,
					"validateMode"
				)
			}

			// 2. Validate and create approved plan
			const approvedPlan = this.validateAndCreateApprovedPlan(input, errors, warnings)

			// 3. Store approved plan in repository
			await this.storePlanInRepository(approvedPlan)

			// 4. Transition to execution mode
			const newMode = await this.transitionToExecutionMode(currentMode)

			// 5. Save as reusable block if requested
			let savedAsBlock = false
			let blockName: string | undefined

			if (input.saveAsBlock !== false) { // Default to true unless explicitly false
				try {
					blockName = await this.savePlanAsBlock(approvedPlan, input, warnings)
					savedAsBlock = true
				} catch (error) {
					warnings.push(`Failed to save plan as block: ${error instanceof Error ? error.message : 'Unknown error'}`)
				}
			}

			return {
				success: true,
				approvedPlan,
				previousMode: currentMode.currentMode,
				newMode: newMode.currentMode,
				savedAsBlock,
				blockName,
				errors,
				warnings
			}

		} catch (error) {
			if (error instanceof ApprovePlanError) {
				throw error
			}

			throw new ApprovePlanError(
				`Plan approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				"execute",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Validate input and create approved plan domain object
	 *
	 * @param input - Plan approval input
	 * @param errors - Array to collect validation errors
	 * @param warnings - Array to collect validation warnings
	 * @returns Validated ApprovedPlan instance
	 */
	private validateAndCreateApprovedPlan(
		input: ApprovePlanInput,
		errors: string[],
		warnings: string[]
	): ApprovedPlan {
		// Validate plan content structure
		if (!input.planContent?.trim()) {
			throw new ApprovePlanError("Plan content cannot be empty", "validateContent")
		}

		// Check for plan title
		if (!input.planContent.match(/^#\s+Plan:\s*.+$/m)) {
			warnings.push("Plan should start with '# Plan: [Title]' for better structure")
		}

		// Check for phases
		const phaseMatches = input.planContent.match(/^#{2,3}\s+Phase\s+\d+:/gm)
		if (!phaseMatches || phaseMatches.length === 0) {
			warnings.push("Plan should include phases (## Phase 1:, ## Phase 2:, etc.) for better tracking")
		}

		// Validate estimated hours
		if (input.estimatedHours !== undefined && input.estimatedHours <= 0) {
			errors.push("Estimated hours must be positive if provided")
		}

		// Throw if there are validation errors
		if (errors.length > 0) {
			throw new ApprovePlanError(
				`Plan validation failed: ${errors.join(', ')}`,
				"validateContent"
			)
		}

		// Create approved plan data
		const planData: ApprovedPlanData = {
			content: input.planContent.trim(),
			approvedAt: Date.now(),
			currentPhase: 0,
			completedPhases: [],
			estimatedHours: input.estimatedHours
		}

		return ApprovedPlan.create(planData)
	}

	/**
	 * Store the approved plan in the repository
	 *
	 * @param approvedPlan - Plan to store
	 */
	private async storePlanInRepository(approvedPlan: ApprovedPlan): Promise<void> {
		try {
			await this.planRepository.setApprovedPlan(approvedPlan)
		} catch (error) {
			throw new ApprovePlanError(
				"Failed to store approved plan",
				"storeInRepository",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Transition from PLAN mode to AGENT mode for execution
	 *
	 * @param currentMode - Current plan mode
	 * @returns New plan mode after transition
	 */
	private async transitionToExecutionMode(currentMode: PlanMode): Promise<PlanMode> {
		try {
			const newMode = currentMode.transitionTo(WorkflowMode.AGENT)
			await this.planRepository.setCurrentMode(newMode.currentMode)
			return newMode
		} catch (error) {
			throw new ApprovePlanError(
				"Failed to transition to execution mode",
				"transitionMode",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Save the approved plan as a reusable block
	 *
	 * @param approvedPlan - Plan to save as block
	 * @param input - Original input with block metadata
	 * @param warnings - Array to collect warnings
	 * @returns Name of the created block
	 */
	private async savePlanAsBlock(
		approvedPlan: ApprovedPlan,
		input: ApprovePlanInput,
		warnings: string[]
	): Promise<string> {
		try {
			// Generate block name from plan title and timestamp
			const title = approvedPlan.getTitle()
			const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
			const blockName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp}`

			// Create plan block
			const planBlock: PlanBlock = {
				name: blockName,
				category: input.blockCategory || 'auto-generated',
				description: input.blockDescription || `Auto-saved plan: ${title}`,
				generated: true,
				createdAt: new Date().toISOString(),
				usageCount: 0,
				estimatedHours: input.estimatedHours,
				template: approvedPlan.content,
				matchKeywords: this.extractKeywordsFromPlan(approvedPlan.content)
			}

			// Validate block before saving
			const validation = await this.planBlockStorage.validatePlanBlock(planBlock)
			if (!validation.isValid) {
				warnings.push(`Plan block validation warnings: ${validation.warnings.join(', ')}`)
				if (validation.errors.length > 0) {
					throw new Error(`Plan block validation failed: ${validation.errors.join(', ')}`)
				}
			}

			// Save the block
			await this.planBlockStorage.savePlanBlock(planBlock)

			return blockName

		} catch (error) {
			throw new ApprovePlanError(
				"Failed to save plan as block",
				"savePlanAsBlock",
				error instanceof Error ? error : undefined
			)
		}
	}

	/**
	 * Extract keywords from plan content for matching
	 *
	 * @param planContent - Plan content to analyze
	 * @returns Array of extracted keywords
	 */
	private extractKeywordsFromPlan(planContent: string): string[] {
		const keywords = new Set<string>()

		// Extract from title
		const titleMatch = planContent.match(/^#\s+Plan:\s*(.+)$/m)
		if (titleMatch) {
			const titleWords = titleMatch[1].toLowerCase().split(/\s+/)
			titleWords.forEach(word => {
				if (word.length > 2) keywords.add(word)
			})
		}

		// Extract from phase names
		const phaseMatches = planContent.match(/^#{2,3}\s+Phase\s+\d+:\s*(.+)$/gm)
		if (phaseMatches) {
			phaseMatches.forEach(phase => {
				const phaseName = phase.replace(/^#{2,3}\s+Phase\s+\d+:\s*/, '')
				const words = phaseName.toLowerCase().split(/\s+/)
				words.forEach(word => {
					if (word.length > 2) keywords.add(word)
				})
			})
		}

		// Extract technology terms (common patterns)
		const techTerms = planContent.match(/\b(react|typescript|node|express|api|database|auth|jwt|oauth|graphql|rest|microservice|frontend|backend|docker|kubernetes|aws|azure|gcp)\b/gi)
		if (techTerms) {
			techTerms.forEach(term => keywords.add(term.toLowerCase()))
		}

		return Array.from(keywords).slice(0, 20) // Limit to 20 keywords
	}
}