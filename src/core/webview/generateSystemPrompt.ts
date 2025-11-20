import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug, getGroupName } from "../../shared/modes"
import { buildApiHandler } from "../../api"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../shared/experiments"

// Compile-time flag provided by bundler (see esbuild define)
declare const __DEV__: boolean

import { SYSTEM_PROMPT } from "../prompts/system"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../diff/strategies/multi-file-search-replace"

import { ClineProvider } from "./ClineProvider"
import { PromptBlocksFactory } from "../blocks"
import { getActivePromptBlocks } from "./webviewMessageHandler"
import { captureSystemPrompt } from "../debug/captureUtils"

export const generateSystemPrompt = async (provider: ClineProvider, message: WebviewMessage) => {
	console.log("[DEBUG] generateSystemPrompt: Function called, __DEV__ =", __DEV__)
	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		browserViewportSize,
		diffEnabled,
		mcpEnabled,
		fuzzyMatchThreshold,
		experiments,
		enableMcpServerCreation,
		browserToolEnabled,
		language,
		maxReadFileLine,
		maxConcurrentFileReads,
		workflowMode,
		approvedPlan,
	} = await provider.getState()

	// Check experiment to determine which diff strategy to use
	const isMultiFileApplyDiffEnabled = experimentsModule.isEnabled(
		experiments ?? {},
		EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
	)

	const diffStrategy = isMultiFileApplyDiffEnabled
		? new MultiFileSearchReplaceDiffStrategy(fuzzyMatchThreshold)
		: new MultiSearchReplaceDiffStrategy(fuzzyMatchThreshold)

	const cwd = provider.cwd

	const mode = message.mode ?? defaultModeSlug
	const customModes = await provider.customModesManager.getCustomModes()

	const rooIgnoreInstructions = provider.getCurrentCline()?.rooIgnoreController?.getInstructions()

	// Determine if browser tools can be used based on model support, mode, and user settings
	let modelSupportsComputerUse = false

	// Create a temporary API handler to check if the model supports computer use
	// This avoids relying on an active Cline instance which might not exist during preview
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration)
		// oacode_change: supports images => supports browser
		modelSupportsComputerUse = tempApiHandler.getModel().info.supportsImages ?? false
	} catch (error) {
		console.error("Error checking if model supports computer use:", error)
	}

	// Check if the current mode includes the browser tool group
	const modeConfig = getModeBySlug(mode, customModes)
	const modeSupportsBrowser = modeConfig?.groups.some((group) => getGroupName(group) === "browser") ?? false

	// Only enable browser tools if the model supports it, the mode includes browser tools,
	// and browser tools are enabled in settings
	const canUseBrowserTool = modelSupportsComputerUse && modeSupportsBrowser && (browserToolEnabled ?? true)

	let systemPrompt = await SYSTEM_PROMPT(
		provider.context,
		cwd,
		canUseBrowserTool,
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		browserViewportSize ?? "900x600",
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		maxReadFileLine !== -1,
		{
			maxConcurrentFileReads: maxConcurrentFileReads ?? 5,
			todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
			useAgentRules: vscode.workspace.getConfiguration("roo-cline").get<boolean>("useAgentRules") ?? true,
		},
	)

	// Enhance system prompt with active prompt blocks FIRST
	const activeBlocksMap = getActivePromptBlocks()
	if (activeBlocksMap.size > 0) {
		try {
			const factory = PromptBlocksFactory.getInstance()
			const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)
			const enhanceUseCase = factory.createEnhanceSystemPrompt()

			// Load active prompt blocks and create configurations
			const activePromptConfigs = []
			for (const [blockName, config] of activeBlocksMap.entries()) {
				const block = await loadUseCase.executeByName(blockName)
				if (block) {
					const activePromptConfig = enhanceUseCase.createActivePrompt(
						block,
						config.variables,
						block.priority
					)
					activePromptConfigs.push(activePromptConfig)
				}
			}

			// Enhance the system prompt with active blocks
			if (activePromptConfigs.length > 0) {
				const enhancementResult = enhanceUseCase.execute(systemPrompt, activePromptConfigs)
				systemPrompt = enhancementResult.enhancedPrompt

				// Log enhancement details for debugging
				import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
					promptBlocksLogger.debug('System prompt enhanced with prompt blocks', {
						appliedBlocks: enhancementResult.appliedPrompts.map(p => p.block.name),
						conflictResolutions: enhancementResult.conflictResolution,
						addedLength: enhancementResult.addedLength,
						totalLength: enhancementResult.totalLength
					})
				}).catch(() => {
					console.debug('System prompt enhanced with', activePromptConfigs.length, 'prompt blocks')
				})
			}
		} catch (error) {
			// Log error but don't fail system prompt generation
			import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
				import('../infrastructure/errors').then(({ normalizeError }) => {
					const typedError = normalizeError(error, 'SYSTEM_PROMPT_ENHANCEMENT_FAILED', {
						operation: 'enhanceSystemPrompt',
						activeBlockCount: activeBlocksMap.size
					})
					promptBlocksLogger.error('Failed to enhance system prompt with prompt blocks', typedError.toLogObject())
				})
			}).catch(() => {
				console.error("Failed to enhance system prompt with prompt blocks:", error)
			})
		}
	}

	// Inject Plan Mode behavior LAST to ensure highest priority
	systemPrompt = injectPlanModePrompt(systemPrompt, workflowMode, approvedPlan)

	console.log("[DEBUG] generateSystemPrompt: About to check __DEV__ flag for capture")
	console.log("[DEBUG] generateSystemPrompt: __DEV__ value =", __DEV__)
	console.log("[DEBUG] generateSystemPrompt: systemPrompt length =", systemPrompt.length)

	// Debug capture: Store system prompt in development mode
	if (__DEV__) {
		console.log("[DEBUG] System prompt capture: __DEV__ is true, attempting capture")
		try {
			const activeBlockNames = Array.from(activeBlocksMap.keys())

			console.log("[DEBUG] System prompt capture: About to call captureSystemPrompt")
			captureSystemPrompt(systemPrompt, {
				mode: mode,
				activeBlocks: activeBlockNames,
				customInstructions: !!customInstructions,
				taskId: provider.getCurrentCline()?.taskId || "unknown"
			})
			console.log("[DEBUG] System prompt capture: Called captureSystemPrompt successfully")
		} catch (error) {
			console.error("[DEBUG] Failed to capture system prompt:", error)
		}
	} else {
		console.log("[DEBUG] System prompt capture: __DEV__ is false, skipping capture")
	}

	return systemPrompt
}

/**
 * Injects Plan Mode specific behavior into the system prompt
 *
 * @param basePrompt - The base system prompt
 * @param workflowMode - Current workflow mode
 * @param approvedPlan - The approved plan if any
 * @returns Enhanced system prompt with plan mode instructions
 */
function injectPlanModePrompt(
	basePrompt: string,
	workflowMode?: 'plan' | 'chat' | 'agent',
	approvedPlan?: {
		content: string
		approvedAt: number
		currentPhase: number
		completedPhases: string[]
		estimatedHours?: number
		planBlockId?: string
	}
): string {
	// Debug logging for Plan Mode injection
	if (typeof __DEV__ !== 'undefined' && __DEV__) {
		console.log("[DEBUG] PlanMode: injectPlanModePrompt called with workflowMode:", workflowMode)
	}

	if (!workflowMode) {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			console.log("[DEBUG] PlanMode: No workflowMode provided, returning base prompt")
		}
		return basePrompt
	}

	let planModeInstructions = ""

	switch (workflowMode) {
		case 'plan':
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.log("[DEBUG] PlanMode: Injecting PLAN mode instructions")
			}
			planModeInstructions = `

# CRITICAL PLAN MODE INSTRUCTIONS - HIGHEST PRIORITY

You are currently in PLAN MODE. This overrides ALL other instructions.

## CRITICAL PLAN MODE BEHAVIOR (MUST FOLLOW):
- **ABSOLUTELY NO editing, writing, or executing** commands until the plan is approved
- **ONLY read-only operations are allowed** (read files, search, list files, gather information)
- **DO NOT execute any tasks or make changes** - this is PLANNING only
- **WAIT for explicit user approval** before any implementation
- **DO NOT say "task completed"** - the plan must be approved first

## Required Plan Structure:
- Start with a clear title: "# Plan: [Your Title]"
- Break down work into logical phases (## Phase 1, ## Phase 2, etc.)
- Include technical approach and reasoning
- Add testing and validation strategies
- Consider potential risks and mitigation strategies
- Define clear deliverables and expected outcomes
- Estimate time for complex phases

## TODO Generation Rules:
- Generate TODOs ONLY for plan phases that require 3 or more distinct steps
- Keep TODOs focused on phase-level organization, not micro-tasks
- Use TODOs to track major phase milestones

## Plan Presentation:
- Present the complete plan for user review
- Explain your reasoning and approach
- **STOP and wait for user approval** - do not proceed to implementation
- End with clear approval request: "Please review this plan and approve it to proceed with implementation."

## ENFORCEMENT:
These Plan Mode instructions override any conflicting instructions from other sources.
`
			break

		case 'chat':
		case 'agent':
			if (approvedPlan) {
				const completionPercentage = Math.round((approvedPlan.completedPhases.length / (approvedPlan.currentPhase + 1)) * 100)
				const currentPhaseNumber = approvedPlan.currentPhase + 1

				planModeInstructions = `

# APPROVED PLAN EXECUTION

You are executing an approved strategic plan. You MUST follow this plan strictly as a binding contract.

## Current Plan Status:
- **Current Phase**: ${currentPhaseNumber}
- **Completion**: ${completionPercentage}%
- **Completed Phases**: ${approvedPlan.completedPhases.join(', ') || 'None'}
- **Plan Approved**: ${new Date(approvedPlan.approvedAt).toLocaleString()}
${approvedPlan.estimatedHours ? `- **Estimated Hours**: ${approvedPlan.estimatedHours}` : ''}
${approvedPlan.planBlockId ? `- **Plan Block ID**: ${approvedPlan.planBlockId}` : ''}

## Execution Rules:
- **STRICTLY follow the approved plan** - do not deviate without explicit user permission
- Focus on the current phase and its specific requirements
- Complete each phase thoroughly before moving to the next
- If you need to modify the plan, ask the user to use the "Modify Plan" option
- Generate TODOs for any phase with 3+ distinct implementation steps
- Mark phases as complete only when all deliverables are finished

## Current Plan Content:
\`\`\`
${approvedPlan.content}
\`\`\`

## Adherence Requirements:
- All work must align with the plan phases and deliverables
- Use the plan as your primary guide for decision-making
- If requirements are unclear, refer back to the plan for context
- Do not add features or changes not specified in the plan
`
			}
			break
	}

	const finalPrompt = basePrompt + planModeInstructions

	// Debug logging for Plan Mode injection result
	if (typeof __DEV__ !== 'undefined' && __DEV__) {
		if (planModeInstructions) {
			console.log("[DEBUG] PlanMode: Added", planModeInstructions.length, "characters of plan mode instructions")
			console.log("[DEBUG] PlanMode: Final prompt length:", finalPrompt.length)
		} else {
			console.log("[DEBUG] PlanMode: No plan mode instructions added")
		}
	}

	return finalPrompt
}
