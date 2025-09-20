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

	// Enhance system prompt with active prompt blocks
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
