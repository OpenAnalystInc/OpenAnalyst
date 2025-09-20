import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"
import axios from "axios" // oacode_change
import * as yaml from "yaml"

import {
	type Language,
	type ProviderSettings,
	type GlobalState,
	type ClineMessage,
	TelemetryEventName,
	ghostServiceSettingsSchema, // oacode_change
	customModesSettingsSchema,
} from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"
import { TelemetryService } from "@roo-code/telemetry"
import { type ApiMessage } from "../task-persistence/apiMessages"

import { ClineProvider } from "./ClineProvider"
import { changeLanguage, t } from "../../i18n"
import { Package } from "../../shared/package"
import { RouterName, toRouterName, ModelRecord } from "../../shared/api"
import { supportPrompt } from "../../shared/support-prompt"
import { MessageEnhancer } from "./messageEnhancer"

import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema, WebviewMessage } from "../../shared/WebviewMessage"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { experimentDefault } from "../../shared/experiments"
import { Terminal } from "../../integrations/terminal/Terminal"
import { openFile } from "../../integrations/misc/open-file"
import { CodeIndexManager } from "../../services/code-index/manager"
import { openImage, saveImage } from "../../integrations/misc/image-handler"
import { selectImages } from "../../integrations/misc/process-images"
import { getTheme } from "../../integrations/theme/getTheme"
import { discoverChromeHostUrl, tryChromeHostUrl } from "../../services/browser/browserDiscovery"
import { searchWorkspaceFiles } from "../../services/search/file-search"
import { fileExistsAtPath } from "../../utils/fs"
import { playTts, setTtsEnabled, setTtsSpeed, stopTts } from "../../utils/tts"
import { showSystemNotification } from "../../integrations/notifications" // oacode_change
import { singleCompletionHandler } from "../../utils/single-completion-handler" // oacode_change
import { searchCommits } from "../../utils/git"
import { exportSettings, importSettingsWithFeedback } from "../config/importExport"
import { getOpenAiModels } from "../../api/providers/openai"
import { getVsCodeLmModels } from "../../api/providers/vscode-lm"
import { openMention } from "../mentions"
import { TelemetrySetting } from "../../shared/TelemetrySetting"
import { getWorkspacePath } from "../../utils/path"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { Mode, defaultModeSlug } from "../../shared/modes"
import { getModels, flushModels } from "../../api/providers/fetchers/modelCache"
import { GetModelsOptions } from "../../shared/api"
import { generateSystemPrompt } from "./generateSystemPrompt"
import { getCommand } from "../../utils/commands"
import { toggleWorkflow, toggleRule, createRuleFile, deleteRuleFile } from "./oarules"
import { mermaidFixPrompt } from "../prompts/utilities/mermaid" // oacode_change
import { editMessageHandler, fetchOacodeNotificationsHandler } from "../oacode/webview/webviewMessageHandlerUtils" // oacode_change
import { PromptBlocksFactory } from "../blocks"

const ALLOWED_VSCODE_SETTINGS = new Set(["terminal.integrated.inheritEnv"])

// Temporary storage for active prompt blocks (per session)
// TODO: Replace with proper conversation state management
const activePromptBlocks = new Map<string, Record<string, any>>()

/**
 * Get current active prompt blocks for system prompt generation
 * @returns Map of active prompt blocks
 */
export function getActivePromptBlocks(): Map<string, Record<string, any>> {
	return activePromptBlocks
}

import { MarketplaceManager, MarketplaceItemType } from "../../services/marketplace"
import { setPendingTodoList } from "../tools/updateTodoListTool"
import { UsageTracker } from "../../utils/usage-tracker"

export const webviewMessageHandler = async (
	provider: ClineProvider,
	message: WebviewMessage,
	marketplaceManager?: MarketplaceManager,
) => {
	// Utility functions provided for concise get/update of global state via contextProxy API.
	const getGlobalState = <K extends keyof GlobalState>(key: K) => provider.contextProxy.getValue(key)
	const updateGlobalState = async <K extends keyof GlobalState>(key: K, value: GlobalState[K]) =>
		await provider.contextProxy.setValue(key, value)

	/**
	 * Shared utility to find message indices based on timestamp
	 */
	const findMessageIndices = (messageTs: number, currentCline: any) => {
		const timeCutoff = messageTs - 1000 // 1 second buffer before the message
		const messageIndex = currentCline.clineMessages.findIndex((msg: ClineMessage) => msg.ts && msg.ts >= timeCutoff)
		const apiConversationHistoryIndex = currentCline.apiConversationHistory.findIndex(
			(msg: ApiMessage) => msg.ts && msg.ts >= timeCutoff,
		)
		return { messageIndex, apiConversationHistoryIndex }
	}

	/**
	 * Removes the target message and all subsequent messages
	 */
	const removeMessagesThisAndSubsequent = async (
		currentCline: any,
		messageIndex: number,
		apiConversationHistoryIndex: number,
	) => {
		// Delete this message and all that follow
		await currentCline.overwriteClineMessages(currentCline.clineMessages.slice(0, messageIndex))

		if (apiConversationHistoryIndex !== -1) {
			await currentCline.overwriteApiConversationHistory(
				currentCline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
			)
		}
	}

	/**
	 * Handles message deletion operations with user confirmation
	 */
	const handleDeleteOperation = async (messageTs: number): Promise<void> => {
		// Send message to webview to show delete confirmation dialog
		await provider.postMessageToWebview({
			type: "showDeleteMessageDialog",
			messageTs,
		})
	}

	/**
	 * Handles confirmed message deletion from webview dialog
	 */
	const handleDeleteMessageConfirm = async (messageTs: number): Promise<void> => {
		// Only proceed if we have a current cline
		if (provider.getCurrentCline()) {
			const currentCline = provider.getCurrentCline()!
			const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)

			if (messageIndex !== -1) {
				try {
					const { historyItem } = await provider.getTaskWithId(currentCline.taskId)

					// Delete this message and all subsequent messages
					await removeMessagesThisAndSubsequent(currentCline, messageIndex, apiConversationHistoryIndex)

					// Initialize with history item after deletion
					await provider.initClineWithHistoryItem(historyItem)
				} catch (error) {
					console.error("Error in delete message:", error)
					vscode.window.showErrorMessage(
						`Error deleting message: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	/**
	 * Handles message editing operations with user confirmation
	 */
	const handleEditOperation = async (messageTs: number, editedContent: string, images?: string[]): Promise<void> => {
		// Send message to webview to show edit confirmation dialog
		await provider.postMessageToWebview({
			type: "showEditMessageDialog",
			messageTs,
			text: editedContent,
			images,
		})
	}

	/**
	 * Handles confirmed message editing from webview dialog
	 */
	const handleEditMessageConfirm = async (
		messageTs: number,
		editedContent: string,
		images?: string[],
	): Promise<void> => {
		// Only proceed if we have a current cline
		if (provider.getCurrentCline()) {
			const currentCline = provider.getCurrentCline()!

			// Use findMessageIndices to find messages based on timestamp
			const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)

			if (messageIndex !== -1) {
				try {
					// Edit this message and delete subsequent
					await removeMessagesThisAndSubsequent(currentCline, messageIndex, apiConversationHistoryIndex)

					// Process the edited message as a regular user message
					// This will add it to the conversation and trigger an AI response
					webviewMessageHandler(provider, {
						type: "askResponse",
						askResponse: "messageResponse",
						text: editedContent,
						images,
					})

					// Don't initialize with history item for edit operations
					// The webviewMessageHandler will handle the conversation state
				} catch (error) {
					console.error("Error in edit message:", error)
					vscode.window.showErrorMessage(
						`Error editing message: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	/**
	 * Handles message modification operations (delete or edit) with confirmation dialog
	 * @param messageTs Timestamp of the message to operate on
	 * @param operation Type of operation ('delete' or 'edit')
	 * @param editedContent New content for edit operations
	 * @returns Promise<void>
	 */
	const handleMessageModificationsOperation = async (
		messageTs: number,
		operation: "delete" | "edit",
		editedContent?: string,
		images?: string[],
	): Promise<void> => {
		if (operation === "delete") {
			await handleDeleteOperation(messageTs)
		} else if (operation === "edit" && editedContent) {
			await handleEditOperation(messageTs, editedContent, images)
		}
	}

	switch (message.type) {
		case "webviewDidLaunch":
			// Load custom modes first
			const customModes = await provider.customModesManager.getCustomModes()
			await updateGlobalState("customModes", customModes)

			// Refresh workflow toggles
			const { refreshWorkflowToggles } = await import("../context/instructions/workflows") // oacode_change
			await refreshWorkflowToggles(provider.context, provider.cwd) // oacode_change

			provider.postStateToWebview()
			provider.postRulesDataToWebview() // oacode_change: send workflows and rules immediately
			provider.workspaceTracker?.initializeFilePaths() // Don't await.

			getTheme().then((theme) => provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }))

			// If MCP Hub is already initialized, update the webview with
			// current server list.
			const mcpHub = provider.getMcpHub()

			if (mcpHub) {
				provider.postMessageToWebview({ type: "mcpServers", mcpServers: mcpHub.getAllServers() })
			}

			provider.providerSettingsManager
				.listConfig()
				.then(async (listApiConfig) => {
					if (!listApiConfig) {
						return
					}

					if (listApiConfig.length === 1) {
						// Check if first time init then sync with exist config.
						if (!checkExistKey(listApiConfig[0])) {
							const { apiConfiguration } = await provider.getState()

							await provider.providerSettingsManager.saveConfig(
								listApiConfig[0].name ?? "default",
								apiConfiguration,
							)

							listApiConfig[0].apiProvider = apiConfiguration.apiProvider
						}
					}

					const currentConfigName = getGlobalState("currentApiConfigName")

					if (currentConfigName) {
						if (!(await provider.providerSettingsManager.hasConfig(currentConfigName))) {
							// Current config name not valid, get first config in list.
							const name = listApiConfig[0]?.name
							await updateGlobalState("currentApiConfigName", name)

							if (name) {
								await provider.activateProviderProfile({ name })
								return
							}
						}
					}

					await Promise.all([
						await updateGlobalState("listApiConfigMeta", listApiConfig),
						await provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
					])
				})
				.catch((error) =>
					provider.log(
						`Error list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					),
				)

			// If user already opted in to telemetry, enable telemetry service
			provider.getStateToPostToWebview().then(async (/*oacode_change*/ state) => {
				const { telemetrySetting } = state
				const isOptedIn = telemetrySetting === "enabled"
				TelemetryService.instance.updateTelemetryState(isOptedIn)
				await TelemetryService.instance.updateIdentity(state.apiConfiguration.oacodeToken ?? "") // oacode_change
			})

			provider.isViewLaunched = true
			break
		case "newTask": {
			// Initializing new instance of Cline will make sure that any
			// agentically running promises in old instance don't affect our new
			// task. This essentially creates a fresh slate for the new task.
			
			let processedText = message.text || ""
			
			// Check for prompt block slash commands
			const slashCommandRegex = /^\/([a-zA-Z0-9_-]+)(\s|$)/
			const match = processedText.match(slashCommandRegex)
			
			if (match) {
				const commandName = match[1]
				
				try {
					// Check if this is a prompt block command
					const factory = PromptBlocksFactory.getInstance()
					const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)
					
					const block = await loadUseCase.executeByName(commandName)
					
					if (block) {
						// This is a prompt block - activate it and remove from text
						processedText = processedText.replace(slashCommandRegex, "").trim()
						
						// Use structured logging for development debugging
						import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
							promptBlocksLogger.debug('Prompt block activated via slash command', {
								blockName: block.name,
								category: block.category,
								originalText: message.text,
								processedText: processedText
							})
						}).catch(() => {
							// Fallback to console if logger import fails
							console.log(`[PromptBlocks] Activated block: ${block.name}`)
						})
						
						// TODO: Store in conversation state when available
						// For now, just enhance the current prompt
						const enhanceUseCase = factory.createEnhanceSystemPrompt()
						const activePrompts = [{
							name: block.name,
							variables: {} // Could extract from command parameters later
						}]
						
						// Initialize task with the enhanced prompt context
						await provider.initClineWithTask(processedText, message.images)
						return
					}
				} catch (error) {
					// Use structured logging for error handling
					import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
						import('../infrastructure/errors').then(({ normalizeError }) => {
							const typedError = normalizeError(error, 'SLASH_COMMAND_CHECK_FAILED', {
								commandName,
								operation: 'checkPromptBlock'
							})
							promptBlocksLogger.warn('Failed to check if slash command is prompt block', typedError.toLogObject())
						})
					}).catch(() => {
						// Fallback to console logging
						console.warn(`Error checking prompt block ${commandName}:`, error)
					})
					// Continue with normal processing - this is recoverable
				}
			}
			
			// Initialize task with processed text  
			await provider.initClineWithTask(processedText, message.images)
			break
		}
		// oacode_change start
		case "condense":
			provider.getCurrentCline()?.handleWebviewAskResponse("yesButtonClicked")
			break
		// oacode_change end
		case "customInstructions":
			await provider.updateCustomInstructions(message.text)
			break
		case "alwaysAllowReadOnly":
			await updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowReadOnlyOutsideWorkspace":
			await updateGlobalState("alwaysAllowReadOnlyOutsideWorkspace", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWrite":
			await updateGlobalState("alwaysAllowWrite", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWriteOutsideWorkspace":
			await updateGlobalState("alwaysAllowWriteOutsideWorkspace", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWriteProtected":
			await updateGlobalState("alwaysAllowWriteProtected", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowExecute":
			await updateGlobalState("alwaysAllowExecute", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowBrowser":
			await updateGlobalState("alwaysAllowBrowser", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowMcp":
			await updateGlobalState("alwaysAllowMcp", message.bool)
			await provider.postStateToWebview()
			break
		case "alwaysAllowModeSwitch":
			await updateGlobalState("alwaysAllowModeSwitch", message.bool)
			await provider.postStateToWebview()
			break
		case "allowedMaxRequests":
			await updateGlobalState("allowedMaxRequests", message.value)
			await provider.postStateToWebview()
			break
		case "allowedMaxCost":
			await updateGlobalState("allowedMaxCost", message.value)
			await provider.postStateToWebview()
			break
		case "alwaysAllowSubtasks":
			await updateGlobalState("alwaysAllowSubtasks", message.bool)
			await provider.postStateToWebview()
			break
		case "alwaysAllowUpdateTodoList":
			await updateGlobalState("alwaysAllowUpdateTodoList", message.bool)
			await provider.postStateToWebview()
			break
		case "askResponse":
			provider.getCurrentCline()?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
			break
		case "autoCondenseContext":
			await updateGlobalState("autoCondenseContext", message.bool)
			await provider.postStateToWebview()
			break
		case "autoCondenseContextPercent":
			await updateGlobalState("autoCondenseContextPercent", message.value)
			await provider.postStateToWebview()
			break
		case "terminalOperation":
			if (message.terminalOperation) {
				provider.getCurrentCline()?.handleTerminalOperation(message.terminalOperation)
			}
			break
		case "clearTask":
			// clear task resets the current session and allows for a new task to be started, if this session is a subtask - it allows the parent task to be resumed
			// Check if the current task actually has a parent task
			const currentTask = provider.getCurrentCline()
			if (currentTask && currentTask.parentTask) {
				await provider.finishSubTask(t("common:tasks.canceled"))
			} else {
				// Regular task - just clear it
				await provider.clearTask()
			}
			await provider.postStateToWebview()
			break
		case "didShowAnnouncement":
			await updateGlobalState("lastShownAnnouncementId", provider.latestAnnouncementId)
			await provider.postStateToWebview()
			break
		case "selectImages":
			const images = await selectImages()
			await provider.postMessageToWebview({
				type: "selectedImages",
				images,
				context: message.context,
				messageTs: message.messageTs,
			})
			break
		case "exportCurrentTask":
			const currentTaskId = provider.getCurrentCline()?.taskId
			if (currentTaskId) {
				provider.exportTaskWithId(currentTaskId)
			}
			break
		case "shareCurrentTask":
			const shareTaskId = provider.getCurrentCline()?.taskId
			const clineMessages = provider.getCurrentCline()?.clineMessages
			if (!shareTaskId) {
				vscode.window.showErrorMessage(t("common:errors.share_no_active_task"))
				break
			}

			try {
				const visibility = message.visibility || "organization"
				const result = await CloudService.instance.shareTask(shareTaskId, visibility)

				if (result.success && result.shareUrl) {
					// Show success notification
					const messageKey =
						visibility === "public"
							? "common:info.public_share_link_copied"
							: "common:info.organization_share_link_copied"
					vscode.window.showInformationMessage(t(messageKey))

					// Send success feedback to webview for inline display
					await provider.postMessageToWebview({
						type: "shareTaskSuccess",
						visibility,
						text: result.shareUrl,
					})
				} else {
					// Handle error
					const errorMessage = result.error || "Failed to create share link"
					if (errorMessage.includes("Authentication")) {
						vscode.window.showErrorMessage(t("common:errors.share_auth_required"))
					} else if (errorMessage.includes("sharing is not enabled")) {
						vscode.window.showErrorMessage(t("common:errors.share_not_enabled"))
					} else if (errorMessage.includes("not found")) {
						vscode.window.showErrorMessage(t("common:errors.share_task_not_found"))
					} else {
						vscode.window.showErrorMessage(errorMessage)
					}
				}
			} catch (error) {
				provider.log(`[shareCurrentTask] Unexpected error: ${error}`)
				vscode.window.showErrorMessage(t("common:errors.share_task_failed"))
			}
			break
		case "showTaskWithId":
			provider.showTaskWithId(message.text!)
			break
		case "condenseTaskContextRequest":
			provider.condenseTaskContext(message.text!)
			break
		case "deleteTaskWithId":
			provider.deleteTaskWithId(message.text!)
			break
		case "deleteMultipleTasksWithIds": {
			const ids = message.ids

			if (Array.isArray(ids)) {
				// Process in batches of 20 (or another reasonable number)
				const batchSize = 20
				const results = []

				// Only log start and end of the operation
				console.log(`Batch deletion started: ${ids.length} tasks total`)

				for (let i = 0; i < ids.length; i += batchSize) {
					const batch = ids.slice(i, i + batchSize)

					const batchPromises = batch.map(async (id) => {
						try {
							await provider.deleteTaskWithId(id)
							return { id, success: true }
						} catch (error) {
							// Keep error logging for debugging purposes
							console.log(
								`Failed to delete task ${id}: ${error instanceof Error ? error.message : String(error)}`,
							)
							return { id, success: false }
						}
					})

					// Process each batch in parallel but wait for completion before starting the next batch
					const batchResults = await Promise.all(batchPromises)
					results.push(...batchResults)

					// Update the UI after each batch to show progress
					await provider.postStateToWebview()
				}

				// Log final results
				const successCount = results.filter((r) => r.success).length
				const failCount = results.length - successCount
				console.log(
					`Batch deletion completed: ${successCount}/${ids.length} tasks successful, ${failCount} tasks failed`,
				)
			}
			break
		}
		case "exportTaskWithId":
			provider.exportTaskWithId(message.text!)
			break
		case "importSettings": {
			await importSettingsWithFeedback({
				providerSettingsManager: provider.providerSettingsManager,
				contextProxy: provider.contextProxy,
				customModesManager: provider.customModesManager,
				provider: provider,
			})

			break
		}
		case "exportSettings":
			await exportSettings({
				providerSettingsManager: provider.providerSettingsManager,
				contextProxy: provider.contextProxy,
			})

			break
		case "resetState":
			await provider.resetState()
			break
		case "flushRouterModels":
			const routerNameFlush: RouterName = toRouterName(message.text)
			await flushModels(routerNameFlush)
			break
		case "requestRouterModels":
			const { apiConfiguration } = await provider.getState()

			const routerModels: Partial<Record<RouterName, ModelRecord>> = {
				openrouter: {},
				requesty: {},
				glama: {},
				unbound: {},
				litellm: {},
				"oacode-openrouter": {}, // oacode_change
				ollama: {},
				lmstudio: {},
			}

			const safeGetModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
				try {
					return await getModels(options)
				} catch (error) {
					console.error(
						`Failed to fetch models in webviewMessageHandler requestRouterModels for ${options.provider}:`,
						error,
					)
					throw error // Re-throw to be caught by Promise.allSettled
				}
			}

			// oacode_change start: openrouter auth, oacode provider
			const openRouterApiKey = apiConfiguration.openRouterApiKey || message?.values?.openRouterApiKey
			const openRouterBaseUrl = apiConfiguration.openRouterBaseUrl || message?.values?.openRouterBaseUrl

			const modelFetchPromises: Array<{ key: RouterName; options: GetModelsOptions }> = [
				{
					key: "openrouter",
					options: { provider: "openrouter", apiKey: openRouterApiKey, baseUrl: openRouterBaseUrl },
				},
				{ key: "requesty", options: { provider: "requesty", apiKey: apiConfiguration.requestyApiKey } },
				{ key: "glama", options: { provider: "glama" } },
				{ key: "unbound", options: { provider: "unbound", apiKey: apiConfiguration.unboundApiKey } },
				{
					key: "oacode-openrouter",
					options: { provider: "oacode-openrouter", oacodeToken: apiConfiguration.oacodeToken },
				},
				{ key: "ollama", options: { provider: "ollama", baseUrl: apiConfiguration.ollamaBaseUrl } },
			]
			// oacode_change end

			// Don't fetch Ollama and LM Studio models by default anymore
			// They have their own specific handlers: requestOllamaModels and requestLmStudioModels

			const litellmApiKey = apiConfiguration.litellmApiKey || message?.values?.litellmApiKey
			const litellmBaseUrl = apiConfiguration.litellmBaseUrl || message?.values?.litellmBaseUrl
			if (litellmApiKey && litellmBaseUrl) {
				modelFetchPromises.push({
					key: "litellm",
					options: { provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl },
				})
			}

			const results = await Promise.allSettled(
				modelFetchPromises.map(async ({ key, options }) => {
					const models = await safeGetModels(options)
					return { key, models } // key is RouterName here
				}),
			)

			const fetchedRouterModels: Partial<Record<RouterName, ModelRecord>> = {
				...routerModels,
				// Initialize ollama and lmstudio with empty objects since they use separate handlers
				ollama: {},
				lmstudio: {},
			}

			results.forEach((result, index) => {
				const routerName = modelFetchPromises[index].key // Get RouterName using index

				if (result.status === "fulfilled") {
					fetchedRouterModels[routerName] = result.value.models

					// Ollama and LM Studio settings pages still need these events
					if (routerName === "ollama" && Object.keys(result.value.models).length > 0) {
						provider.postMessageToWebview({
							type: "ollamaModels",
							ollamaModels: Object.keys(result.value.models),
						})
					} else if (routerName === "lmstudio" && Object.keys(result.value.models).length > 0) {
						provider.postMessageToWebview({
							type: "lmStudioModels",
							lmStudioModels: result.value.models,
						})
					}
				} else {
					// Handle rejection: Post a specific error message for this provider
					const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason)
					console.error(`Error fetching models for ${routerName}:`, result.reason)

					fetchedRouterModels[routerName] = {} // Ensure it's an empty object in the main routerModels message

					provider.postMessageToWebview({
						type: "singleRouterModelFetchResponse",
						success: false,
						error: errorMessage,
						values: { provider: routerName },
					})
				}
			})

			provider.postMessageToWebview({
				type: "routerModels",
				routerModels: fetchedRouterModels as Record<RouterName, ModelRecord>,
			})

			break
		case "requestOllamaModels": {
			// Specific handler for Ollama models only
			const { apiConfiguration: ollamaApiConfig } = await provider.getState()
			try {
				// Flush cache first to ensure fresh models
				await flushModels("ollama")

				const ollamaModels = await getModels({
					provider: "ollama",
					baseUrl: ollamaApiConfig.ollamaBaseUrl,
				})

				if (Object.keys(ollamaModels).length > 0) {
					provider.postMessageToWebview({
						type: "ollamaModels",
						ollamaModels: Object.keys(ollamaModels),
					})
				}
			} catch (error) {
				// Silently fail - user hasn't configured Ollama yet
				console.debug("Ollama models fetch failed:", error)
			}
			break
		}
		case "requestLmStudioModels": {
			// Specific handler for LM Studio models only
			const { apiConfiguration: lmStudioApiConfig } = await provider.getState()
			try {
				// Flush cache first to ensure fresh models
				await flushModels("lmstudio")

				const lmStudioModels = await getModels({
					provider: "lmstudio",
					baseUrl: lmStudioApiConfig.lmStudioBaseUrl,
				})

				if (Object.keys(lmStudioModels).length > 0) {
					provider.postMessageToWebview({
						type: "lmStudioModels",
						lmStudioModels: lmStudioModels,
					})
				}
			} catch (error) {
				// Silently fail - user hasn't configured LM Studio yet
				console.debug("LM Studio models fetch failed:", error)
			}
			break
		}
		case "requestOpenAiModels":
			if (message?.values?.baseUrl && message?.values?.apiKey) {
				const openAiModels = await getOpenAiModels(
					message?.values?.baseUrl,
					message?.values?.apiKey,
					message?.values?.openAiHeaders,
				)

				provider.postMessageToWebview({ type: "openAiModels", openAiModels })
			}

			break
		case "requestVsCodeLmModels":
			const vsCodeLmModels = await getVsCodeLmModels()
			// TODO: Cache like we do for OpenRouter, etc?
			provider.postMessageToWebview({ type: "vsCodeLmModels", vsCodeLmModels })
			break
		case "requestHuggingFaceModels":
			try {
				const { getHuggingFaceModelsWithMetadata } = await import("../../api/providers/fetchers/huggingface")
				const huggingFaceModelsResponse = await getHuggingFaceModelsWithMetadata()
				provider.postMessageToWebview({
					type: "huggingFaceModels",
					huggingFaceModels: huggingFaceModelsResponse.models,
				})
			} catch (error) {
				console.error("Failed to fetch Hugging Face models:", error)
				provider.postMessageToWebview({
					type: "huggingFaceModels",
					huggingFaceModels: [],
				})
			}
			break
		case "openImage":
			openImage(message.text!, { values: message.values })
			break
		case "saveImage":
			saveImage(message.dataUri!)
			break
		case "openFile":
			openFile(message.text!, message.values as { create?: boolean; content?: string; line?: number })
			break
		case "openMention":
			openMention(message.text)
			break
		case "openExternal":
			if (message.url) {
				vscode.env.openExternal(vscode.Uri.parse(message.url))
			}
			break
		case "checkpointDiff":
			const result = checkoutDiffPayloadSchema.safeParse(message.payload)

			if (result.success) {
				await provider.getCurrentCline()?.checkpointDiff(result.data)
			}

			break
		case "checkpointRestore": {
			const result = checkoutRestorePayloadSchema.safeParse(message.payload)

			if (result.success) {
				await provider.cancelTask()

				try {
					await pWaitFor(() => provider.getCurrentCline()?.isInitialized === true, { timeout: 3_000 })
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
				}

				try {
					await provider.getCurrentCline()?.checkpointRestore(result.data)
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
				}
			}

			break
		}
		case "cancelTask":
			await provider.cancelTask()
			break
		case "allowedCommands": {
			// Validate and sanitize the commands array
			const commands = message.commands ?? []
			const validCommands = Array.isArray(commands)
				? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			await updateGlobalState("allowedCommands", validCommands)

			// Also update workspace settings.
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("allowedCommands", validCommands, vscode.ConfigurationTarget.Global)

			break
		}
		case "deniedCommands": {
			// Validate and sanitize the commands array
			const commands = message.commands ?? []
			const validCommands = Array.isArray(commands)
				? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			await updateGlobalState("deniedCommands", validCommands)

			// Also update workspace settings.
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("deniedCommands", validCommands, vscode.ConfigurationTarget.Global)

			break
		}
		case "openCustomModesSettings": {
			const customModesFilePath = await provider.customModesManager.getCustomModesFilePath()

			if (customModesFilePath) {
				openFile(customModesFilePath)
			}

			break
		}
		case "openMcpSettings": {
			const mcpSettingsFilePath = await provider.getMcpHub()?.getMcpSettingsFilePath()

			if (mcpSettingsFilePath) {
				openFile(mcpSettingsFilePath)
			}

			break
		}
		case "openProjectMcpSettings": {
			if (!vscode.workspace.workspaceFolders?.length) {
				vscode.window.showErrorMessage(t("common:errors.no_workspace"))
				return
			}

			const workspaceFolder = vscode.workspace.workspaceFolders[0]
			const rooDir = path.join(workspaceFolder.uri.fsPath, ".oacode")
			const mcpPath = path.join(rooDir, "mcp.json")

			try {
				await fs.mkdir(rooDir, { recursive: true })
				const exists = await fileExistsAtPath(mcpPath)

				if (!exists) {
					await safeWriteJson(mcpPath, { mcpServers: {} })
				}

				openFile(mcpPath)
			} catch (error) {
				vscode.window.showErrorMessage(t("mcp:errors.create_json", { error: `${error}` }))
			}

			break
		}
		case "deleteMcpServer": {
			if (!message.serverName) {
				break
			}

			try {
				provider.log(`Attempting to delete MCP server: ${message.serverName}`)
				await provider.getMcpHub()?.deleteServer(message.serverName, message.source as "global" | "project")
				provider.log(`Successfully deleted MCP server: ${message.serverName}`)

				// Refresh the webview state
				await provider.postStateToWebview()
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Failed to delete MCP server: ${errorMessage}`)
				// Error messages are already handled by McpHub.deleteServer
			}
			break
		}
		case "restartMcpServer": {
			try {
				await provider.getMcpHub()?.restartConnection(message.text!, message.source as "global" | "project")
			} catch (error) {
				provider.log(
					`Failed to retry connection for ${message.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleToolAlwaysAllow": {
			try {
				await provider
					.getMcpHub()
					?.toggleToolAlwaysAllow(
						message.serverName!,
						message.source as "global" | "project",
						message.toolName!,
						Boolean(message.alwaysAllow),
					)
			} catch (error) {
				provider.log(
					`Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleToolEnabledForPrompt": {
			try {
				await provider
					.getMcpHub()
					?.toggleToolEnabledForPrompt(
						message.serverName!,
						message.source as "global" | "project",
						message.toolName!,
						Boolean(message.isEnabled),
					)
			} catch (error) {
				provider.log(
					`Failed to toggle enabled for prompt for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleMcpServer": {
			try {
				await provider
					.getMcpHub()
					?.toggleServerDisabled(
						message.serverName!,
						message.disabled!,
						message.source as "global" | "project",
					)
			} catch (error) {
				provider.log(
					`Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "mcpEnabled":
			const mcpEnabled = message.bool ?? true
			const currentMcpEnabled = getGlobalState("mcpEnabled") ?? true

			// Always update the state to ensure consistency
			await updateGlobalState("mcpEnabled", mcpEnabled)

			// Only refresh MCP connections if the value actually changed
			// This prevents expensive MCP server refresh operations when saving unrelated settings
			if (currentMcpEnabled !== mcpEnabled) {
				// Delegate MCP enable/disable logic to McpHub
				const mcpHubInstance = provider.getMcpHub()
				if (mcpHubInstance) {
					await mcpHubInstance.handleMcpEnabledChange(mcpEnabled)
				}
			}

			await provider.postStateToWebview()
			break
		case "enableMcpServerCreation":
			await updateGlobalState("enableMcpServerCreation", message.bool ?? true)
			await provider.postStateToWebview()
			break
		// oacode_change begin
		case "openGlobalKeybindings":
			vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", message.text ?? "oa-code.")
			break
		case "showSystemNotification":
			const isSystemNotificationsEnabled = getGlobalState("systemNotificationsEnabled") ?? true
			if (!isSystemNotificationsEnabled) {
				break
			}
			if (message.notificationOptions) {
				showSystemNotification(message.notificationOptions)
			}
			break
		case "systemNotificationsEnabled":
			const systemNotificationsEnabled = message.bool ?? true
			await updateGlobalState("systemNotificationsEnabled", systemNotificationsEnabled)
			await provider.postStateToWebview()
			break
		case "openInBrowser":
			if (message.url) {
				vscode.env.openExternal(vscode.Uri.parse(message.url))
			}
			break
		// oacode_change end
		case "refreshAllMcpServers": {
			const mcpHub = provider.getMcpHub()
			if (mcpHub) {
				await mcpHub.refreshAllConnections()
			}
			break
		}
		// playSound handler removed - now handled directly in the webview
		case "soundEnabled":
			const soundEnabled = message.bool ?? true
			await updateGlobalState("soundEnabled", soundEnabled)
			await provider.postStateToWebview()
			break
		case "soundVolume":
			const soundVolume = message.value ?? 0.5
			await updateGlobalState("soundVolume", soundVolume)
			await provider.postStateToWebview()
			break
		case "ttsEnabled":
			const ttsEnabled = message.bool ?? true
			await updateGlobalState("ttsEnabled", ttsEnabled)
			setTtsEnabled(ttsEnabled) // Add this line to update the tts utility
			await provider.postStateToWebview()
			break
		case "ttsSpeed":
			const ttsSpeed = message.value ?? 1.0
			await updateGlobalState("ttsSpeed", ttsSpeed)
			setTtsSpeed(ttsSpeed)
			await provider.postStateToWebview()
			break
		case "playTts":
			if (message.text) {
				playTts(message.text, {
					onStart: () => provider.postMessageToWebview({ type: "ttsStart", text: message.text }),
					onStop: () => provider.postMessageToWebview({ type: "ttsStop", text: message.text }),
				})
			}
			break
		case "stopTts":
			stopTts()
			break
		case "diffEnabled":
			const diffEnabled = message.bool ?? true
			await updateGlobalState("diffEnabled", diffEnabled)
			await provider.postStateToWebview()
			break
		case "enableCheckpoints":
			const enableCheckpoints = message.bool ?? true
			await updateGlobalState("enableCheckpoints", enableCheckpoints)
			await provider.postStateToWebview()
			break
		case "browserViewportSize":
			const browserViewportSize = message.text ?? "900x600"
			await updateGlobalState("browserViewportSize", browserViewportSize)
			await provider.postStateToWebview()
			break
		case "remoteBrowserHost":
			await updateGlobalState("remoteBrowserHost", message.text)
			await provider.postStateToWebview()
			break
		case "remoteBrowserEnabled":
			// Store the preference in global state
			// remoteBrowserEnabled now means "enable remote browser connection"
			await updateGlobalState("remoteBrowserEnabled", message.bool ?? false)
			// If disabling remote browser connection, clear the remoteBrowserHost
			if (!message.bool) {
				await updateGlobalState("remoteBrowserHost", undefined)
			}
			await provider.postStateToWebview()
			break
		case "testBrowserConnection":
			// If no text is provided, try auto-discovery
			if (!message.text) {
				// Use testBrowserConnection for auto-discovery
				const chromeHostUrl = await discoverChromeHostUrl()

				if (chromeHostUrl) {
					// Send the result back to the webview
					await provider.postMessageToWebview({
						type: "browserConnectionResult",
						success: !!chromeHostUrl,
						text: `Auto-discovered and tested connection to Chrome: ${chromeHostUrl}`,
						values: { endpoint: chromeHostUrl },
					})
				} else {
					await provider.postMessageToWebview({
						type: "browserConnectionResult",
						success: false,
						text: "No Chrome instances found on the network. Make sure Chrome is running with remote debugging enabled (--remote-debugging-port=9222).",
					})
				}
			} else {
				// Test the provided URL
				const customHostUrl = message.text
				const hostIsValid = await tryChromeHostUrl(message.text)

				// Send the result back to the webview
				await provider.postMessageToWebview({
					type: "browserConnectionResult",
					success: hostIsValid,
					text: hostIsValid
						? `Successfully connected to Chrome: ${customHostUrl}`
						: "Failed to connect to Chrome",
				})
			}
			break
		case "fuzzyMatchThreshold":
			await updateGlobalState("fuzzyMatchThreshold", message.value)
			await provider.postStateToWebview()
			break
		case "updateVSCodeSetting": {
			const { setting, value } = message

			if (setting !== undefined && value !== undefined) {
				if (ALLOWED_VSCODE_SETTINGS.has(setting)) {
					await vscode.workspace.getConfiguration().update(setting, value, true)
				} else {
					vscode.window.showErrorMessage(`Cannot update restricted VSCode setting: ${setting}`)
				}
			}

			break
		}
		case "getVSCodeSetting":
			const { setting } = message

			if (setting) {
				try {
					await provider.postMessageToWebview({
						type: "vsCodeSetting",
						setting,
						value: vscode.workspace.getConfiguration().get(setting),
					})
				} catch (error) {
					console.error(`Failed to get VSCode setting ${message.setting}:`, error)

					await provider.postMessageToWebview({
						type: "vsCodeSetting",
						setting,
						error: `Failed to get setting: ${error.message}`,
						value: undefined,
					})
				}
			}

			break
		case "alwaysApproveResubmit":
			await updateGlobalState("alwaysApproveResubmit", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "requestDelaySeconds":
			await updateGlobalState("requestDelaySeconds", message.value ?? 5)
			await provider.postStateToWebview()
			break
		case "writeDelayMs":
			await updateGlobalState("writeDelayMs", message.value)
			await provider.postStateToWebview()
			break
		case "diagnosticsEnabled":
			await updateGlobalState("diagnosticsEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "terminalOutputLineLimit":
			// Validate that the line limit is a positive number
			const lineLimit = message.value
			if (typeof lineLimit === "number" && lineLimit > 0) {
				await updateGlobalState("terminalOutputLineLimit", lineLimit)
				await provider.postStateToWebview()
			} else {
				vscode.window.showErrorMessage(
					t("common:errors.invalid_line_limit") || "Terminal output line limit must be a positive number",
				)
			}
			break
		case "terminalOutputCharacterLimit":
			// Validate that the character limit is a positive number
			const charLimit = message.value
			if (typeof charLimit === "number" && charLimit > 0) {
				await updateGlobalState("terminalOutputCharacterLimit", charLimit)
				await provider.postStateToWebview()
			} else {
				vscode.window.showErrorMessage(
					t("common:errors.invalid_character_limit") ||
						"Terminal output character limit must be a positive number",
				)
			}
			break
		case "terminalShellIntegrationTimeout":
			await updateGlobalState("terminalShellIntegrationTimeout", message.value)
			await provider.postStateToWebview()
			if (message.value !== undefined) {
				Terminal.setShellIntegrationTimeout(message.value)
			}
			break
		case "terminalShellIntegrationDisabled":
			await updateGlobalState("terminalShellIntegrationDisabled", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setShellIntegrationDisabled(message.bool)
			}
			break
		case "terminalCommandDelay":
			await updateGlobalState("terminalCommandDelay", message.value)
			await provider.postStateToWebview()
			if (message.value !== undefined) {
				Terminal.setCommandDelay(message.value)
			}
			break
		case "terminalPowershellCounter":
			await updateGlobalState("terminalPowershellCounter", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setPowershellCounter(message.bool)
			}
			break
		case "terminalZshClearEolMark":
			await updateGlobalState("terminalZshClearEolMark", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshClearEolMark(message.bool)
			}
			break
		case "terminalZshOhMy":
			await updateGlobalState("terminalZshOhMy", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshOhMy(message.bool)
			}
			break
		case "terminalZshP10k":
			await updateGlobalState("terminalZshP10k", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshP10k(message.bool)
			}
			break
		case "terminalZdotdir":
			await updateGlobalState("terminalZdotdir", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZdotdir(message.bool)
			}
			break
		case "terminalCompressProgressBar":
			await updateGlobalState("terminalCompressProgressBar", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setCompressProgressBar(message.bool)
			}
			break
		case "mode":
			await provider.handleModeSwitch(message.text as Mode)
			break
		case "updateSupportPrompt":
			try {
				if (!message?.values) {
					return
				}

				// Replace all prompts with the new values from the cached state
				await updateGlobalState("customSupportPrompts", message.values)
				await provider.postStateToWebview()
			} catch (error) {
				provider.log(
					`Error update support prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.update_support_prompt"))
			}
			break
		case "updatePrompt":
			if (message.promptMode && message.customPrompt !== undefined) {
				const existingPrompts = getGlobalState("customModePrompts") ?? {}
				const updatedPrompts = { ...existingPrompts, [message.promptMode]: message.customPrompt }
				await updateGlobalState("customModePrompts", updatedPrompts)
				const currentState = await provider.getStateToPostToWebview()
				const stateWithPrompts = {
					...currentState,
					customModePrompts: updatedPrompts,
					hasOpenedModeSelector: currentState.hasOpenedModeSelector ?? false,
				}
				provider.postMessageToWebview({ type: "state", state: stateWithPrompts })

				if (TelemetryService.hasInstance()) {
					// Determine which setting was changed by comparing objects
					const oldPrompt = existingPrompts[message.promptMode] || {}
					const newPrompt = message.customPrompt
					const changedSettings = Object.keys(newPrompt).filter(
						(key) =>
							JSON.stringify((oldPrompt as Record<string, unknown>)[key]) !==
							JSON.stringify((newPrompt as Record<string, unknown>)[key]),
					)

					if (changedSettings.length > 0) {
						TelemetryService.instance.captureModeSettingChanged(changedSettings[0])
					}
				}
			}
			break
		case "deleteMessage": {
			if (provider.getCurrentCline() && typeof message.value === "number" && message.value) {
				await handleMessageModificationsOperation(message.value, "delete")
			}
			break
		}
		case "submitEditedMessage": {
			if (
				provider.getCurrentCline() &&
				typeof message.value === "number" &&
				message.value &&
				message.editedMessageContent
			) {
				await handleMessageModificationsOperation(
					message.value,
					"edit",
					message.editedMessageContent,
					message.images,
				)
			}
			break
		}
		case "screenshotQuality":
			await updateGlobalState("screenshotQuality", message.value)
			await provider.postStateToWebview()
			break
		case "maxOpenTabsContext":
			const tabCount = Math.min(Math.max(0, message.value ?? 20), 500)
			await updateGlobalState("maxOpenTabsContext", tabCount)
			await provider.postStateToWebview()
			break
		case "maxWorkspaceFiles":
			const fileCount = Math.min(Math.max(0, message.value ?? 200), 500)
			await updateGlobalState("maxWorkspaceFiles", fileCount)
			await provider.postStateToWebview()
			break
		case "alwaysAllowFollowupQuestions":
			await updateGlobalState("alwaysAllowFollowupQuestions", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "followupAutoApproveTimeoutMs":
			await updateGlobalState("followupAutoApproveTimeoutMs", message.value)
			await provider.postStateToWebview()
			break
		case "browserToolEnabled":
			await updateGlobalState("browserToolEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "language":
			changeLanguage(message.text ?? "en")
			await updateGlobalState("language", message.text as Language)
			await provider.postStateToWebview()
			break
		case "showRooIgnoredFiles":
			await updateGlobalState("showRooIgnoredFiles", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "hasOpenedModeSelector":
			await updateGlobalState("hasOpenedModeSelector", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "maxReadFileLine":
			await updateGlobalState("maxReadFileLine", message.value)
			await provider.postStateToWebview()
			break
		// oacode_change start
		case "showAutoApproveMenu":
			await updateGlobalState("showAutoApproveMenu", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "showTaskTimeline":
			await updateGlobalState("showTaskTimeline", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "allowVeryLargeReads":
			await updateGlobalState("allowVeryLargeReads", message.bool ?? false)
			await provider.postStateToWebview()
			break
		// oacode_change end
		case "maxImageFileSize":
			await updateGlobalState("maxImageFileSize", message.value)
			await provider.postStateToWebview()
			break
		case "maxTotalImageSize":
			await updateGlobalState("maxTotalImageSize", message.value)
			await provider.postStateToWebview()
			break
		case "maxConcurrentFileReads":
			const valueToSave = message.value // Capture the value intended for saving
			await updateGlobalState("maxConcurrentFileReads", valueToSave)
			await provider.postStateToWebview()
			break
		case "includeDiagnosticMessages":
			// Only apply default if the value is truly undefined (not false)
			const includeValue = message.bool !== undefined ? message.bool : true
			await updateGlobalState("includeDiagnosticMessages", includeValue)
			await provider.postStateToWebview()
			break
		case "maxDiagnosticMessages":
			await updateGlobalState("maxDiagnosticMessages", message.value ?? 50)
			await provider.postStateToWebview()
			break
		case "setHistoryPreviewCollapsed": // Add the new case handler
			await updateGlobalState("historyPreviewCollapsed", message.bool ?? false)
			// No need to call postStateToWebview here as the UI already updated optimistically
			break
		case "toggleApiConfigPin":
			if (message.text) {
				const currentPinned = getGlobalState("pinnedApiConfigs") ?? {}
				const updatedPinned: Record<string, boolean> = { ...currentPinned }

				if (currentPinned[message.text]) {
					delete updatedPinned[message.text]
				} else {
					updatedPinned[message.text] = true
				}

				await updateGlobalState("pinnedApiConfigs", updatedPinned)
				await provider.postStateToWebview()
			}
			break
		case "enhancementApiConfigId":
			await updateGlobalState("enhancementApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		// oacode_change start - commitMessageApiConfigId
		case "commitMessageApiConfigId":
			await updateGlobalState("commitMessageApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		// oacode_change end - commitMessageApiConfigId
		// oacode_change start - terminalCommandApiConfigId
		case "terminalCommandApiConfigId":
			await updateGlobalState("terminalCommandApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		// oacode_change end - terminalCommandApiConfigId
		// oacode_change start - ghostServiceSettings
		case "ghostServiceSettings":
			if (!message.values) {
				return
			}
			// Validate ghostServiceSettings structure
			const ghostServiceSettings = ghostServiceSettingsSchema.parse(message.values)
			await updateGlobalState("ghostServiceSettings", ghostServiceSettings)
			await provider.postStateToWebview()
			vscode.commands.executeCommand("oa-code.ghost.reload")
			break
		// oacode_change end
		case "includeTaskHistoryInEnhance":
			await updateGlobalState("includeTaskHistoryInEnhance", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "condensingApiConfigId":
			await updateGlobalState("condensingApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		case "updateCondensingPrompt":
			// Store the condensing prompt in customSupportPrompts["CONDENSE"] instead of customCondensingPrompt
			const currentSupportPrompts = getGlobalState("customSupportPrompts") ?? {}
			const updatedSupportPrompts = { ...currentSupportPrompts, CONDENSE: message.text }
			await updateGlobalState("customSupportPrompts", updatedSupportPrompts)
			// Also update the old field for backward compatibility during migration
			await updateGlobalState("customCondensingPrompt", message.text)
			await provider.postStateToWebview()
			break
		case "profileThresholds":
			await updateGlobalState("profileThresholds", message.values)
			await provider.postStateToWebview()
			break
		case "autoApprovalEnabled":
			await updateGlobalState("autoApprovalEnabled", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "enhancePrompt":
			if (message.text) {
				try {
					const state = await provider.getState()
					const {
						apiConfiguration,
						customSupportPrompts,
						listApiConfigMeta,
						enhancementApiConfigId,
						includeTaskHistoryInEnhance,
					} = state

					const currentCline = provider.getCurrentCline()
					const result = await MessageEnhancer.enhanceMessage({
						text: message.text,
						apiConfiguration,
						customSupportPrompts,
						listApiConfigMeta,
						enhancementApiConfigId,
						includeTaskHistoryInEnhance,
						currentClineMessages: currentCline?.clineMessages,
						providerSettingsManager: provider.providerSettingsManager,
					})

					if (result.success && result.enhancedText) {
						// Capture telemetry for prompt enhancement
						MessageEnhancer.captureTelemetry(currentCline?.taskId, includeTaskHistoryInEnhance)
						await provider.postMessageToWebview({ type: "enhancedPrompt", text: result.enhancedText })
					} else {
						throw new Error(result.error || "Unknown error")
					}
				} catch (error) {
					provider.log(
						`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					TelemetryService.instance.captureException(error, { context: "enhance_prompt" }) // oacode_change
					vscode.window.showErrorMessage(t("common:errors.enhance_prompt"))
					await provider.postMessageToWebview({ type: "enhancedPrompt" })
				}
			}
			break
		case "getSystemPrompt":
			try {
				const systemPrompt = await generateSystemPrompt(provider, message)

				await provider.postMessageToWebview({
					type: "systemPrompt",
					text: systemPrompt,
					mode: message.mode,
				})
			} catch (error) {
				provider.log(
					`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
			}
			break
		case "copySystemPrompt":
			try {
				const systemPrompt = await generateSystemPrompt(provider, message)

				await vscode.env.clipboard.writeText(systemPrompt)
				await vscode.window.showInformationMessage(t("common:info.clipboard_copy"))
			} catch (error) {
				provider.log(
					`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
			}
			break
		case "searchCommits": {
			const cwd = provider.cwd
			if (cwd) {
				try {
					const commits = await searchCommits(message.query || "", cwd)
					await provider.postMessageToWebview({
						type: "commitSearchResults",
						commits,
					})
				} catch (error) {
					provider.log(
						`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.search_commits"))
				}
			}
			break
		}
		// oacode_change start
		case "showFeedbackOptions": {
			const githubIssuesText = t("common:feedback.githubIssues")
			const discordText = t("common:feedback.discord")
			const customerSupport = t("common:feedback.customerSupport")

			const answer = await vscode.window.showInformationMessage(
				t("common:feedback.description"),
				{ modal: true },
				githubIssuesText,
				discordText,
				customerSupport,
			)

			if (answer === githubIssuesText) {
				await vscode.env.openExternal(vscode.Uri.parse("https://github.com/Oa-Org/oacode/issues"))
			} else if (answer === discordText) {
				await vscode.env.openExternal(vscode.Uri.parse("https://discord.gg/fxrhCFGhkP"))
			} else if (answer === customerSupport) {
				await vscode.env.openExternal(vscode.Uri.parse("https://oacode.ai/support"))
			}
			break
		}
		// oacode_change end
		case "searchFiles": {
			const workspacePath = getWorkspacePath()

			if (!workspacePath) {
				// Handle case where workspace path is not available
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: [],
					requestId: message.requestId,
					error: "No workspace path available",
				})
				break
			}
			try {
				// Call file search service with query from message
				const results = await searchWorkspaceFiles(
					message.query || "",
					workspacePath,
					20, // Use default limit, as filtering is now done in the backend
				)

				// Send results back to webview
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results,
					requestId: message.requestId,
				})
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)

				// Send error response to webview
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: [],
					error: errorMessage,
					requestId: message.requestId,
				})
			}
			break
		}
		case "updateTodoList": {
			const payload = message.payload as { todos?: any[] }
			const todos = payload?.todos
			if (Array.isArray(todos)) {
				await setPendingTodoList(todos)
			}
			break
		}
		case "saveApiConfiguration":
			if (message.text && message.apiConfiguration) {
				try {
					await provider.providerSettingsManager.saveConfig(message.text, message.apiConfiguration)
					const listApiConfig = await provider.providerSettingsManager.listConfig()
					await updateGlobalState("listApiConfigMeta", listApiConfig)
				} catch (error) {
					provider.log(
						`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.save_api_config"))
				}
			}
			break
		case "upsertApiConfiguration":
			if (message.text && message.apiConfiguration) {
				await provider.upsertProviderProfile(message.text, message.apiConfiguration)
			}
			break
		case "renameApiConfiguration":
			if (message.values && message.apiConfiguration) {
				try {
					const { oldName, newName } = message.values

					if (oldName === newName) {
						break
					}

					// Load the old configuration to get its ID.
					const { id } = await provider.providerSettingsManager.getProfile({ name: oldName })

					// Create a new configuration with the new name and old ID.
					await provider.providerSettingsManager.saveConfig(newName, { ...message.apiConfiguration, id })

					// Delete the old configuration.
					await provider.providerSettingsManager.deleteConfig(oldName)

					// Re-activate to update the global settings related to the
					// currently activated provider profile.
					await provider.activateProviderProfile({ name: newName })
				} catch (error) {
					provider.log(
						`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.rename_api_config"))
				}
			}
			break
		case "loadApiConfiguration":
			if (message.text) {
				try {
					await provider.activateProviderProfile({ name: message.text })
				} catch (error) {
					provider.log(
						`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.load_api_config"))
				}
			}
			break
		case "loadApiConfigurationById":
			if (message.text) {
				try {
					await provider.activateProviderProfile({ id: message.text })
				} catch (error) {
					provider.log(
						`Error load api configuration by ID: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.load_api_config"))
				}
			}
			break
		case "deleteApiConfiguration":
			if (message.text) {
				const answer = await vscode.window.showInformationMessage(
					t("common:confirmation.delete_config_profile"),
					{ modal: true },
					t("common:answers.yes"),
				)

				if (answer !== t("common:answers.yes")) {
					break
				}

				const oldName = message.text

				const newName = (await provider.providerSettingsManager.listConfig()).filter(
					(c) => c.name !== oldName,
				)[0]?.name

				if (!newName) {
					vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
					return
				}

				try {
					await provider.providerSettingsManager.deleteConfig(oldName)
					await provider.activateProviderProfile({ name: newName })
				} catch (error) {
					provider.log(
						`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
				}
			}
			break
		case "deleteMessageConfirm":
			if (message.messageTs) {
				await handleDeleteMessageConfirm(message.messageTs)
			}
			break
		case "editMessageConfirm":
			if (message.messageTs && message.text) {
				await handleEditMessageConfirm(message.messageTs, message.text, message.images)
			}
			break
		case "getListApiConfiguration":
			try {
				const listApiConfig = await provider.providerSettingsManager.listConfig()
				await updateGlobalState("listApiConfigMeta", listApiConfig)
				provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
			} catch (error) {
				provider.log(
					`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.list_api_config"))
			}
			break
		case "updateExperimental": {
			if (!message.values) {
				break
			}

			const updatedExperiments = {
				...(getGlobalState("experiments") ?? experimentDefault),
				...message.values,
			}

			await updateGlobalState("experiments", updatedExperiments)

			await provider.postStateToWebview()
			break
		}
		case "updateMcpTimeout":
			if (message.serverName && typeof message.timeout === "number") {
				try {
					await provider
						.getMcpHub()
						?.updateServerTimeout(
							message.serverName,
							message.timeout,
							message.source as "global" | "project",
						)
				} catch (error) {
					provider.log(
						`Failed to update timeout for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.update_server_timeout"))
				}
			}
			break
		case "updateCustomMode":
			if (message.modeConfig) {
				// Check if this is a new mode or an update to an existing mode
				const existingModes = await provider.customModesManager.getCustomModes()
				const isNewMode = !existingModes.some((mode) => mode.slug === message.modeConfig?.slug)

				await provider.customModesManager.updateCustomMode(message.modeConfig.slug, message.modeConfig)
				// Update state after saving the mode
				const customModes = await provider.customModesManager.getCustomModes()
				await updateGlobalState("customModes", customModes)
				await updateGlobalState("mode", message.modeConfig.slug)
				await provider.postStateToWebview()

				// Track telemetry for custom mode creation or update
				if (TelemetryService.hasInstance()) {
					if (isNewMode) {
						// This is a new custom mode
						TelemetryService.instance.captureCustomModeCreated(
							message.modeConfig.slug,
							message.modeConfig.name,
						)
					} else {
						// Determine which setting was changed by comparing objects
						const existingMode = existingModes.find((mode) => mode.slug === message.modeConfig?.slug)
						const changedSettings = existingMode
							? Object.keys(message.modeConfig).filter(
									(key) =>
										JSON.stringify((existingMode as Record<string, unknown>)[key]) !==
										JSON.stringify((message.modeConfig as Record<string, unknown>)[key]),
								)
							: []

						if (changedSettings.length > 0) {
							TelemetryService.instance.captureModeSettingChanged(changedSettings[0])
						}
					}
				}
			}
			break
		case "deleteCustomMode":
			if (message.slug) {
				// Get the mode details to determine source and rules folder path
				const customModes = await provider.customModesManager.getCustomModes()
				const modeToDelete = customModes.find((mode) => mode.slug === message.slug)

				if (!modeToDelete) {
					break
				}

				// Determine the scope based on source (project or global)
				const scope = modeToDelete.source || "global"

				// Determine the rules folder path
				let rulesFolderPath: string
				if (scope === "project") {
					const workspacePath = getWorkspacePath()
					if (workspacePath) {
						rulesFolderPath = path.join(workspacePath, ".roo", `rules-${message.slug}`)
					} else {
						rulesFolderPath = path.join(".roo", `rules-${message.slug}`)
					}
				} else {
					// Global scope - use OS home directory
					const homeDir = os.homedir()
					rulesFolderPath = path.join(homeDir, ".roo", `rules-${message.slug}`)
				}

				// Check if the rules folder exists
				const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)

				// If this is a check request, send back the folder info
				if (message.checkOnly) {
					await provider.postMessageToWebview({
						type: "deleteCustomModeCheck",
						slug: message.slug,
						rulesFolderPath: rulesFolderExists ? rulesFolderPath : undefined,
					})
					break
				}

				// Delete the mode
				await provider.customModesManager.deleteCustomMode(message.slug)

				// Delete the rules folder if it exists
				if (rulesFolderExists) {
					try {
						await fs.rm(rulesFolderPath, { recursive: true, force: true })
						provider.log(`Deleted rules folder for mode ${message.slug}: ${rulesFolderPath}`)
					} catch (error) {
						provider.log(`Failed to delete rules folder for mode ${message.slug}: ${error}`)
						// Notify the user about the failure
						vscode.window.showErrorMessage(
							t("common:errors.delete_rules_folder_failed", {
								rulesFolderPath,
								error: error instanceof Error ? error.message : String(error),
							}),
						)
						// Continue with mode deletion even if folder deletion fails
					}
				}

				// Switch back to default mode after deletion
				await updateGlobalState("mode", defaultModeSlug)
				await provider.postStateToWebview()
			}
			break
		case "exportMode":
			if (message.slug) {
				try {
					// Get custom mode prompts to check if built-in mode has been customized
					const customModePrompts = getGlobalState("customModePrompts") || {}
					const customPrompt = customModePrompts[message.slug]

					// Export the mode with any customizations merged directly
					const result = await provider.customModesManager.exportModeWithRules(message.slug, customPrompt)

					if (result.success && result.yaml) {
						// Get last used directory for export
						const lastExportPath = getGlobalState("lastModeExportPath")
						let defaultUri: vscode.Uri

						if (lastExportPath) {
							// Use the directory from the last export
							const lastDir = path.dirname(lastExportPath)
							defaultUri = vscode.Uri.file(path.join(lastDir, `${message.slug}-export.yaml`))
						} else {
							// Default to workspace or home directory
							const workspaceFolders = vscode.workspace.workspaceFolders
							if (workspaceFolders && workspaceFolders.length > 0) {
								defaultUri = vscode.Uri.file(
									path.join(workspaceFolders[0].uri.fsPath, `${message.slug}-export.yaml`),
								)
							} else {
								defaultUri = vscode.Uri.file(`${message.slug}-export.yaml`)
							}
						}

						// Show save dialog
						const saveUri = await vscode.window.showSaveDialog({
							defaultUri,
							filters: {
								"YAML files": ["yaml", "yml"],
							},
							title: "Save mode export",
						})

						if (saveUri && result.yaml) {
							// Save the directory for next time
							await updateGlobalState("lastModeExportPath", saveUri.fsPath)

							// Write the file to the selected location
							await fs.writeFile(saveUri.fsPath, result.yaml, "utf-8")

							// Send success message to webview
							provider.postMessageToWebview({
								type: "exportModeResult",
								success: true,
								slug: message.slug,
							})

							// Show info message
							vscode.window.showInformationMessage(t("common:info.mode_exported", { mode: message.slug }))
						} else {
							// User cancelled the save dialog
							provider.postMessageToWebview({
								type: "exportModeResult",
								success: false,
								error: "Export cancelled",
								slug: message.slug,
							})
						}
					} else {
						// Send error message to webview
						provider.postMessageToWebview({
							type: "exportModeResult",
							success: false,
							error: result.error,
							slug: message.slug,
						})
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					provider.log(`Failed to export mode ${message.slug}: ${errorMessage}`)

					// Send error message to webview
					provider.postMessageToWebview({
						type: "exportModeResult",
						success: false,
						error: errorMessage,
						slug: message.slug,
					})
				}
			}
			break
		case "importMode":
			try {
				// Get last used directory for import
				const lastImportPath = getGlobalState("lastModeImportPath")
				let defaultUri: vscode.Uri | undefined

				if (lastImportPath) {
					// Use the directory from the last import
					const lastDir = path.dirname(lastImportPath)
					defaultUri = vscode.Uri.file(lastDir)
				} else {
					// Default to workspace or home directory
					const workspaceFolders = vscode.workspace.workspaceFolders
					if (workspaceFolders && workspaceFolders.length > 0) {
						defaultUri = vscode.Uri.file(workspaceFolders[0].uri.fsPath)
					}
				}

				// Show file picker to select YAML file
				const fileUri = await vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri,
					filters: {
						"YAML files": ["yaml", "yml"],
					},
					title: "Select mode export file to import",
				})

				if (fileUri && fileUri[0]) {
					// Save the directory for next time
					await updateGlobalState("lastModeImportPath", fileUri[0].fsPath)

					// Read the file content
					const yamlContent = await fs.readFile(fileUri[0].fsPath, "utf-8")

					// Import the mode with the specified source level
					const result = await provider.customModesManager.importModeWithRules(
						yamlContent,
						message.source || "project", // Default to project if not specified
					)

					if (result.success) {
						// Update state after importing
						const customModes = await provider.customModesManager.getCustomModes()
						await updateGlobalState("customModes", customModes)
						await provider.postStateToWebview()

						// Send success message to webview
						provider.postMessageToWebview({
							type: "importModeResult",
							success: true,
						})

						// Show success message
						vscode.window.showInformationMessage(t("common:info.mode_imported"))
					} else {
						// Send error message to webview
						provider.postMessageToWebview({
							type: "importModeResult",
							success: false,
							error: result.error,
						})

						// Show error message
						vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: result.error }))
					}
				} else {
					// User cancelled the file dialog - reset the importing state
					provider.postMessageToWebview({
						type: "importModeResult",
						success: false,
						error: "cancelled",
					})
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Failed to import mode: ${errorMessage}`)

				// Send error message to webview
				provider.postMessageToWebview({
					type: "importModeResult",
					success: false,
					error: errorMessage,
				})

				// Show error message
				vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: errorMessage }))
			}
			break
		case "checkRulesDirectory":
			if (message.slug) {
				const hasContent = await provider.customModesManager.checkRulesDirectoryHasContent(message.slug)

				provider.postMessageToWebview({
					type: "checkRulesDirectoryResult",
					slug: message.slug,
					hasContent: hasContent,
				})
			}
			break
		case "humanRelayResponse":
			if (message.requestId && message.text) {
				vscode.commands.executeCommand(getCommand("handleHumanRelayResponse"), {
					requestId: message.requestId,
					text: message.text,
					cancelled: false,
				})
			}
			break

		case "humanRelayCancel":
			if (message.requestId) {
				vscode.commands.executeCommand(getCommand("handleHumanRelayResponse"), {
					requestId: message.requestId,
					cancelled: true,
				})
			}
			break

		// oacode_change_start
		case "fetchProfileDataRequest":
			try {
				const { apiConfiguration } = await provider.getState()
				const oacodeToken = apiConfiguration?.oacodeToken

				if (!oacodeToken) {
					provider.log("OaCode token not found in extension state.")
					provider.postMessageToWebview({
						type: "profileDataResponse",
						payload: { success: false, error: "OaCode API token not configured." },
					})
					break
				}

				// Import JWT token utilities
				const { extractUserFromToken, isTokenExpired, getTokenExpiration } = await import('../../utils/oacode-token')

				// Extract user info from JWT token as fallback
				const tokenUserInfo = extractUserFromToken(oacodeToken)
				const tokenExpired = isTokenExpired(oacodeToken)
				const tokenExpiration = getTokenExpiration(oacodeToken)

				// Check if token is expired
				if (tokenExpired) {
					provider.log("OaCode token has expired.")
					provider.postMessageToWebview({
						type: "profileDataResponse",
						payload: { 
							success: false, 
							error: "Authentication token has expired. Please sign in again.",
							tokenExpired: true 
						},
					})
					break
				}

				// Try to fetch fresh profile data from backend
				try {
					const baseUrl = 'https://app.openanalyst.com'
					const response = await axios.get(`${baseUrl}/api/auth/extension/profile`, {
						headers: {
							Authorization: `Bearer ${oacodeToken}`,
							"Content-Type": "application/json",
						},
						timeout: 5000 // 5 second timeout
					})

					// Merge backend data with token data
					provider.postMessageToWebview({
						type: "profileDataResponse",
						payload: { 
							success: true, 
							data: { 
								oacodeToken,
								user: {
									// Prefer backend data, fallback to token data
									...tokenUserInfo,
									...response.data.user,
									name: response.data.user?.name || `${tokenUserInfo?.email?.split('@')[0]}` || 'User',
									email: response.data.user?.email || tokenUserInfo?.email,
									image: response.data.user?.image || null
								},
								...response.data
							}
						},
					})

				} catch (backendError: any) {
					// Backend failed, use token data as fallback
					provider.log(`Backend profile fetch failed: ${backendError.message}. Using token data.`)
					
					if (tokenUserInfo) {
						provider.postMessageToWebview({
							type: "profileDataResponse",
							payload: { 
								success: true, 
								data: { 
									oacodeToken,
									user: {
										name: tokenUserInfo.firstName 
											? `${tokenUserInfo.firstName}${tokenUserInfo.lastName ? ' ' + tokenUserInfo.lastName : ''}`
											: tokenUserInfo.email?.split('@')[0] || 'User',
										email: tokenUserInfo.email,
										image: null // No image available from token
									},
									source: 'token', // Indicate this came from token parsing
									expiresAt: tokenExpiration?.toISOString()
								}
							},
						})
					} else {
						// Both backend and token parsing failed
						const errorMessage = backendError.response?.data?.message || 
							backendError.message || 
							"Failed to fetch profile data from backend."
						provider.log(`Profile fetch error: ${errorMessage}`)
						provider.postMessageToWebview({
							type: "profileDataResponse",
							payload: { success: false, error: errorMessage },
						})
					}
				}

			} catch (error: any) {
				const errorMessage =
					error.response?.data?.message ||
					error.message ||
					"Failed to fetch general profile data from backend."
				provider.log(`Error fetching general profile data: ${errorMessage}`)
				provider.postMessageToWebview({
					type: "profileDataResponse",
					payload: { success: false, error: errorMessage },
				})
			}
			break
		case "fetchBalanceDataRequest": // New handler
			try {
				const { apiConfiguration } = await provider.getState()
				const oacodeToken = apiConfiguration?.oacodeToken

				if (!oacodeToken) {
					provider.log("OaCode token not found in extension state for balance data.")
					provider.postMessageToWebview({
						type: "balanceDataResponse", // New response type
						payload: { success: false, error: "OaCode API token not configured." },
					})
					break
				}

				// Import JWT token utilities  
				const { extractUserFromToken, isTokenExpired } = await import('../../utils/oacode-token')

				// Extract balance from JWT token as fallback
				const tokenUserInfo = extractUserFromToken(oacodeToken)
				const tokenExpired = isTokenExpired(oacodeToken)

				// Check if token is expired
				if (tokenExpired) {
					provider.log("OaCode token has expired for balance request.")
					provider.postMessageToWebview({
						type: "balanceDataResponse",
						payload: { 
							success: false, 
							error: "Authentication token has expired. Please sign in again.",
							tokenExpired: true 
						},
					})
					break
				}

				// Try to fetch fresh balance data from backend
				try {
					const baseUrl = 'https://app.openanalyst.com'
					const response = await axios.get(`${baseUrl}/api/auth/extension/profile`, {
						headers: {
							Authorization: `Bearer ${oacodeToken}`,
							"Content-Type": "application/json",
						},
						timeout: 5000 // 5 second timeout
					})

					provider.postMessageToWebview({
						type: "balanceDataResponse",
						payload: { success: true, data: response.data },
					})

				} catch (backendError: any) {
					// Backend failed, use token balance as fallback
					provider.log(`Backend balance fetch failed: ${backendError.message}. Using token balance.`)
					
					if (tokenUserInfo?.balance !== undefined) {
						provider.postMessageToWebview({
							type: "balanceDataResponse",
							payload: { 
								success: true, 
								data: { 
									balance: tokenUserInfo.balance,
									source: 'token' // Indicate this came from token
								}
							},
						})
					} else {
						// Both backend and token parsing failed
						const errorMessage = backendError.response?.data?.message || 
							backendError.message || 
							"Failed to fetch balance data from backend."
						provider.log(`Balance fetch error: ${errorMessage}`)
						provider.postMessageToWebview({
							type: "balanceDataResponse",
							payload: { success: false, error: errorMessage },
						})
					}
				}

			} catch (error: any) {
				const errorMessage =
					error.response?.data?.message || error.message || "Failed to fetch balance data from backend."
				provider.log(`Error fetching balance data: ${errorMessage}`)
				provider.postMessageToWebview({
					type: "balanceDataResponse", // New response type
					payload: { success: false, error: errorMessage },
				})
			}
			break
		case "shopBuyCredits": // New handler
			try {
				const { apiConfiguration } = await provider.getState()
				const oacodeToken = apiConfiguration?.oacodeToken
				if (!oacodeToken) {
					provider.log("OaCode token not found in extension state for buy credits.")
					break
				}
				const credits = message.values?.credits || 50
				const uriScheme = message.values?.uriScheme || "vscode"
				const uiKind = message.values?.uiKind || "Desktop"
				const source = uiKind === "Web" ? "web" : uriScheme

				const response = await axios.post(
					`https://oacode.ai/payments/topup?origin=extension&source=${source}&amount=${credits}`,
					{},
					{
						headers: {
							Authorization: `Bearer ${oacodeToken}`,
							"Content-Type": "application/json",
						},
						maxRedirects: 0, // Prevent axios from following redirects automatically
						validateStatus: (status) => status < 400, // Accept 3xx status codes
					},
				)
				if (response.status !== 303 || !response.headers.location) {
					return
				}
				await vscode.env.openExternal(vscode.Uri.parse(response.headers.location))
			} catch (error: any) {
				const errorMessage = error?.message || "Unknown error"
				const errorStack = error?.stack ? ` Stack: ${error.stack}` : ""
				provider.log(`Error redirecting to payment page: ${errorMessage}.${errorStack}`)
				provider.postMessageToWebview({
					type: "updateProfileData",
				})
			}
			break

		case "fetchMcpMarketplace": {
			await provider.fetchMcpMarketplace(message.bool)
			break
		}

		case "downloadMcp": {
			if (message.mcpId) {
				await provider.downloadMcp(message.mcpId)
			}
			break
		}

		case "silentlyRefreshMcpMarketplace": {
			await provider.silentlyRefreshMcpMarketplace()
			break
		}

		case "toggleWorkflow": {
			if (message.workflowPath && typeof message.enabled === "boolean" && typeof message.isGlobal === "boolean") {
				await toggleWorkflow(
					message.workflowPath,
					message.enabled,
					message.isGlobal,
					provider.contextProxy,
					provider.context,
				)
				await provider.postRulesDataToWebview()
			}
			break
		}

		case "refreshRules": {
			await provider.postRulesDataToWebview()
			break
		}

		case "toggleRule": {
			if (message.rulePath && typeof message.enabled === "boolean" && typeof message.isGlobal === "boolean") {
				await toggleRule(
					message.rulePath,
					message.enabled,
					message.isGlobal,
					provider.contextProxy,
					provider.context,
				)
				await provider.postRulesDataToWebview()
			}
			break
		}

		case "createRuleFile": {
			if (
				message.filename &&
				typeof message.isGlobal === "boolean" &&
				(message.ruleType === "rule" || message.ruleType === "workflow")
			) {
				try {
					await createRuleFile(message.filename, message.isGlobal, message.ruleType)
				} catch (error) {
					console.error("Error creating rule file:", error)
					vscode.window.showErrorMessage(t("oacode:rules.errors.failedToCreateRuleFile"))
				}
				await provider.postRulesDataToWebview()
			}
			break
		}

		case "deleteRuleFile": {
			if (message.rulePath) {
				try {
					await deleteRuleFile(message.rulePath)
				} catch (error) {
					console.error("Error deleting rule file:", error)
					vscode.window.showErrorMessage(t("oacode:rules.errors.failedToDeleteRuleFile"))
				}
				await provider.postRulesDataToWebview()
			}
			break
		}

		case "reportBug":
			provider.getCurrentCline()?.handleWebviewAskResponse("yesButtonClicked")
			break
		// end oacode_change
		case "telemetrySetting": {
			const telemetrySetting = message.text as TelemetrySetting
			await updateGlobalState("telemetrySetting", telemetrySetting)
			const isOptedIn = telemetrySetting === "enabled"

			TelemetryService.instance.updateTelemetryState(isOptedIn)
			await provider.postStateToWebview()
			break
		}
		case "accountButtonClicked": {
			// Navigate to the account tab.
			provider.postMessageToWebview({ type: "action", action: "accountButtonClicked" })
			break
		}
		case "rooCloudSignIn": {
			try {
				TelemetryService.instance.captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
				await CloudService.instance.login()
			} catch (error) {
				provider.log(`AuthService#login failed: ${error}`)
				vscode.window.showErrorMessage("Sign in failed.")
			}

			break
		}
		case "rooCloudSignOut": {
			try {
				await CloudService.instance.logout()
				await provider.postStateToWebview()
				provider.postMessageToWebview({ type: "authenticatedUser", userInfo: undefined })
			} catch (error) {
				provider.log(`AuthService#logout failed: ${error}`)
				vscode.window.showErrorMessage("Sign out failed.")
			}

			break
		}

		case "saveCodeIndexSettingsAtomic": {
			if (!message.codeIndexSettings) {
				break
			}

			const settings = message.codeIndexSettings

			try {
				// Check if embedder provider has changed
				const currentConfig = getGlobalState("codebaseIndexConfig") || {}
				const embedderProviderChanged =
					currentConfig.codebaseIndexEmbedderProvider !== settings.codebaseIndexEmbedderProvider

				// Save global state settings atomically
				const globalStateConfig = {
					...currentConfig,
					codebaseIndexEnabled: settings.codebaseIndexEnabled,
					codebaseIndexQdrantUrl: settings.codebaseIndexQdrantUrl,
					codebaseIndexEmbedderProvider: settings.codebaseIndexEmbedderProvider,
					codebaseIndexEmbedderBaseUrl: settings.codebaseIndexEmbedderBaseUrl,
					codebaseIndexEmbedderModelId: settings.codebaseIndexEmbedderModelId,
					codebaseIndexEmbedderModelDimension: settings.codebaseIndexEmbedderModelDimension, // Generic dimension
					codebaseIndexOpenAiCompatibleBaseUrl: settings.codebaseIndexOpenAiCompatibleBaseUrl,
					codebaseIndexSearchMaxResults: settings.codebaseIndexSearchMaxResults,
					codebaseIndexSearchMinScore: settings.codebaseIndexSearchMinScore,
				}

				// Save global state first
				await updateGlobalState("codebaseIndexConfig", globalStateConfig)

				// Save secrets directly using context proxy
				if (settings.codeIndexOpenAiKey !== undefined) {
					await provider.contextProxy.storeSecret("codeIndexOpenAiKey", settings.codeIndexOpenAiKey)
				}
				if (settings.codeIndexQdrantApiKey !== undefined) {
					await provider.contextProxy.storeSecret("codeIndexQdrantApiKey", settings.codeIndexQdrantApiKey)
				}
				if (settings.codebaseIndexOpenAiCompatibleApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexOpenAiCompatibleApiKey",
						settings.codebaseIndexOpenAiCompatibleApiKey,
					)
				}
				if (settings.codebaseIndexGeminiApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexGeminiApiKey",
						settings.codebaseIndexGeminiApiKey,
					)
				}
				if (settings.codebaseIndexMistralApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexMistralApiKey",
						settings.codebaseIndexMistralApiKey,
					)
				}

				// Send success response first - settings are saved regardless of validation
				await provider.postMessageToWebview({
					type: "codeIndexSettingsSaved",
					success: true,
					settings: globalStateConfig,
				})

				// Update webview state
				await provider.postStateToWebview()

				// Then handle validation and initialization for the current workspace
				const currentCodeIndexManager = provider.getCurrentWorkspaceCodeIndexManager()
				if (currentCodeIndexManager) {
					// If embedder provider changed, perform proactive validation
					if (embedderProviderChanged) {
						try {
							// Force handleSettingsChange which will trigger validation
							await currentCodeIndexManager.handleSettingsChange()
						} catch (error) {
							// Validation failed - the error state is already set by handleSettingsChange
							provider.log(
								`Embedder validation failed after provider change: ${error instanceof Error ? error.message : String(error)}`,
							)
							// Send validation error to webview
							await provider.postMessageToWebview({
								type: "indexingStatusUpdate",
								values: currentCodeIndexManager.getCurrentStatus(),
							})
							// Exit early - don't try to start indexing with invalid configuration
							break
						}
					} else {
						// No provider change, just handle settings normally
						try {
							await currentCodeIndexManager.handleSettingsChange()
						} catch (error) {
							// Log but don't fail - settings are saved
							provider.log(
								`Settings change handling error: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}

					// Wait a bit more to ensure everything is ready
					await new Promise((resolve) => setTimeout(resolve, 200))

					// Auto-start indexing if now enabled and configured
					if (currentCodeIndexManager.isFeatureEnabled && currentCodeIndexManager.isFeatureConfigured) {
						if (!currentCodeIndexManager.isInitialized) {
							try {
								await currentCodeIndexManager.initialize(provider.contextProxy)
								provider.log(`Code index manager initialized after settings save`)
							} catch (error) {
								provider.log(
									`Code index initialization failed: ${error instanceof Error ? error.message : String(error)}`,
								)
								// Send error status to webview
								await provider.postMessageToWebview({
									type: "indexingStatusUpdate",
									values: currentCodeIndexManager.getCurrentStatus(),
								})
							}
						}
					}
				} else {
					// No workspace open - send error status
					provider.log("Cannot save code index settings: No workspace folder open")
					await provider.postMessageToWebview({
						type: "indexingStatusUpdate",
						values: {
							systemStatus: "Error",
							message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
							processedItems: 0,
							totalItems: 0,
							currentItemUnit: "items",
						},
					})
				}
			} catch (error) {
				provider.log(`Error saving code index settings: ${error.message || error}`)
				await provider.postMessageToWebview({
					type: "codeIndexSettingsSaved",
					success: false,
					error: error.message || "Failed to save settings",
				})
			}
			break
		}

		case "requestIndexingStatus": {
			const manager = provider.getCurrentWorkspaceCodeIndexManager()
			if (!manager) {
				// No workspace open - send error status
				provider.postMessageToWebview({
					type: "indexingStatusUpdate",
					values: {
						systemStatus: "Error",
						message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
						processedItems: 0,
						totalItems: 0,
						currentItemUnit: "items",
						workerspacePath: undefined,
					},
				})
				return
			}

			const status = manager
				? manager.getCurrentStatus()
				: {
						systemStatus: "Standby",
						message: "No workspace folder open",
						processedItems: 0,
						totalItems: 0,
						currentItemUnit: "items",
						workspacePath: undefined,
					}

			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: status,
			})
			break
		}
		case "requestCodeIndexSecretStatus": {
			// Check if secrets are set using the VSCode context directly for async access
			const hasOpenAiKey = !!(await provider.context.secrets.get("codeIndexOpenAiKey"))
			const hasQdrantApiKey = !!(await provider.context.secrets.get("codeIndexQdrantApiKey"))
			const hasOpenAiCompatibleApiKey = !!(await provider.context.secrets.get(
				"codebaseIndexOpenAiCompatibleApiKey",
			))
			const hasGeminiApiKey = !!(await provider.context.secrets.get("codebaseIndexGeminiApiKey"))
			const hasMistralApiKey = !!(await provider.context.secrets.get("codebaseIndexMistralApiKey"))

			provider.postMessageToWebview({
				type: "codeIndexSecretStatus",
				values: {
					hasOpenAiKey,
					hasQdrantApiKey,
					hasOpenAiCompatibleApiKey,
					hasGeminiApiKey,
					hasMistralApiKey,
				},
			})
			break
		}
		case "startIndexing": {
			try {
				const manager = provider.getCurrentWorkspaceCodeIndexManager()
				if (!manager) {
					// No workspace open - send error status
					provider.postMessageToWebview({
						type: "indexingStatusUpdate",
						values: {
							systemStatus: "Error",
							message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
							processedItems: 0,
							totalItems: 0,
							currentItemUnit: "items",
						},
					})
					provider.log("Cannot start indexing: No workspace folder open")
					return
				}
				if (manager.isFeatureEnabled && manager.isFeatureConfigured) {
					if (!manager.isInitialized) {
						await manager.initialize(provider.contextProxy)
					}

					// startIndexing now handles error recovery internally
					manager.startIndexing()

					// If startIndexing recovered from error, we need to reinitialize
					if (!manager.isInitialized) {
						await manager.initialize(provider.contextProxy)
						// Try starting again after initialization
						manager.startIndexing()
					}
				}
			} catch (error) {
				provider.log(`Error starting indexing: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}
		case "clearIndexData": {
			try {
				const manager = provider.getCurrentWorkspaceCodeIndexManager()
				if (!manager) {
					provider.log("Cannot clear index data: No workspace folder open")
					provider.postMessageToWebview({
						type: "indexCleared",
						values: {
							success: false,
							error: t("embeddings:orchestrator.indexingRequiresWorkspace"),
						},
					})
					return
				}
				await manager.clearIndexData()
				provider.postMessageToWebview({ type: "indexCleared", values: { success: true } })
			} catch (error) {
				provider.log(`Error clearing index data: ${error instanceof Error ? error.message : String(error)}`)
				provider.postMessageToWebview({
					type: "indexCleared",
					values: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
				})
			}
			break
		}
		// oacode_change start - add clearUsageData
		case "clearUsageData": {
			try {
				const usageTracker = UsageTracker.getInstance()
				await usageTracker.clearAllUsageData()
				vscode.window.showInformationMessage("Usage data has been successfully cleared.")
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Error clearing usage data: ${errorMessage}`)
				vscode.window.showErrorMessage(`Failed to clear usage data: ${errorMessage}`)
			}
			break
		}
		// oacode_change start - add getUsageData
		case "getUsageData": {
			if (message.text) {
				try {
					const usageTracker = UsageTracker.getInstance()
					const usageData = usageTracker.getAllUsage(message.text)
					await provider.postMessageToWebview({
						type: "usageDataResponse",
						text: message.text,
						values: usageData,
					})
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					provider.log(`Error getting usage data: ${errorMessage}`)
				}
			}
			break
		}
		// oacode_change end - add getUsageData
		// oacode_change start - add toggleTaskFavorite
		case "toggleTaskFavorite":
			if (message.text) {
				await provider.toggleTaskFavorite(message.text)
			}
			break
		// oacode_change start - add fixMermaidSyntax
		case "fixMermaidSyntax":
			if (message.text && message.requestId) {
				try {
					const { apiConfiguration } = await provider.getState()

					const prompt = mermaidFixPrompt(message.values?.error || "Unknown syntax error", message.text)

					const fixedCode = await singleCompletionHandler(apiConfiguration, prompt)

					provider.postMessageToWebview({
						type: "mermaidFixResponse",
						requestId: message.requestId,
						success: true,
						fixedCode: fixedCode?.trim() || null,
					})
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Failed to fix Mermaid syntax"
					provider.log(`Error fixing Mermaid syntax: ${errorMessage}`)

					provider.postMessageToWebview({
						type: "mermaidFixResponse",
						requestId: message.requestId,
						success: false,
						error: errorMessage,
					})
				}
			}
			break
		// oacode_change end
		case "focusPanelRequest": {
			// Execute the focusPanel command to focus the WebView
			await vscode.commands.executeCommand(getCommand("focusPanel"))
			break
		}
		case "filterMarketplaceItems": {
			if (marketplaceManager && message.filters) {
				try {
					await marketplaceManager.updateWithFilteredItems({
						type: message.filters.type as MarketplaceItemType | undefined,
						search: message.filters.search,
						tags: message.filters.tags,
					})
					await provider.postStateToWebview()
				} catch (error) {
					console.error("Marketplace: Error filtering items:", error)
					vscode.window.showErrorMessage("Failed to filter marketplace items")
				}
			}
			break
		}

		case "fetchMarketplaceData": {
			// Fetch marketplace data on demand
			await provider.fetchMarketplaceData()
			break
		}

		case "installMarketplaceItem": {
			if (marketplaceManager && message.mpItem && message.mpInstallOptions) {
				try {
					const configFilePath = await marketplaceManager.installMarketplaceItem(
						message.mpItem,
						message.mpInstallOptions,
					)
					await provider.postStateToWebview()
					console.log(`Marketplace item installed and config file opened: ${configFilePath}`)

					// Send success message to webview
					provider.postMessageToWebview({
						type: "marketplaceInstallResult",
						success: true,
						slug: message.mpItem.id,
					})
				} catch (error) {
					console.error(`Error installing marketplace item: ${error}`)
					// Send error message to webview
					provider.postMessageToWebview({
						type: "marketplaceInstallResult",
						success: false,
						error: error instanceof Error ? error.message : String(error),
						slug: message.mpItem.id,
					})
				}
			}
			break
		}

		case "removeInstalledMarketplaceItem": {
			if (marketplaceManager && message.mpItem && message.mpInstallOptions) {
				try {
					await marketplaceManager.removeInstalledMarketplaceItem(message.mpItem, message.mpInstallOptions)
					await provider.postStateToWebview()

					// Send success message to webview
					provider.postMessageToWebview({
						type: "marketplaceRemoveResult",
						success: true,
						slug: message.mpItem.id,
					})
				} catch (error) {
					console.error(`Error removing marketplace item: ${error}`)

					// Show error message to user
					vscode.window.showErrorMessage(
						`Failed to remove marketplace item: ${error instanceof Error ? error.message : String(error)}`,
					)

					// Send error message to webview
					provider.postMessageToWebview({
						type: "marketplaceRemoveResult",
						success: false,
						error: error instanceof Error ? error.message : String(error),
						slug: message.mpItem.id,
					})
				}
			} else {
				// MarketplaceManager not available or missing required parameters
				const errorMessage = !marketplaceManager
					? "Marketplace manager is not available"
					: "Missing required parameters for marketplace item removal"
				console.error(errorMessage)

				vscode.window.showErrorMessage(errorMessage)

				if (message.mpItem?.id) {
					provider.postMessageToWebview({
						type: "marketplaceRemoveResult",
						success: false,
						error: errorMessage,
						slug: message.mpItem.id,
					})
				}
			}
			break
		}

		case "installMarketplaceItemWithParameters": {
			if (marketplaceManager && message.payload && "item" in message.payload && "parameters" in message.payload) {
				try {
					const configFilePath = await marketplaceManager.installMarketplaceItem(message.payload.item, {
						parameters: message.payload.parameters,
					})
					await provider.postStateToWebview()
					console.log(`Marketplace item with parameters installed and config file opened: ${configFilePath}`)
				} catch (error) {
					console.error(`Error installing marketplace item with parameters: ${error}`)
					vscode.window.showErrorMessage(
						`Failed to install marketplace item: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		}

		case "switchTab": {
			if (message.tab) {
				// Capture tab shown event for all switchTab messages (which are user-initiated)
				if (TelemetryService.hasInstance()) {
					TelemetryService.instance.captureTabShown(message.tab)
				}

				await provider.postMessageToWebview({ type: "action", action: "switchTab", tab: message.tab })
			}
			break
		}
		// oacode_change start
		case "editMessage": {
			await editMessageHandler(provider, message)
			break
		}
		case "fetchOacodeNotifications": {
			await fetchOacodeNotificationsHandler(provider)
			break
		}
		case "dismissNotificationId": {
			if (!message.notificationId) {
				break
			}

			const dismissedNotificationIds = getGlobalState("dismissedNotificationIds") || []

			await updateGlobalState("dismissedNotificationIds", [...dismissedNotificationIds, message.notificationId])
			await provider.postStateToWebview()
			break
		}
		// oacode_change end
		case "insertTextToChatArea":
			provider.postMessageToWebview({ type: "insertTextToChatArea", text: message.text })
			break
		case "requestCommands": {
			try {
				const { getCommands } = await import("../../services/command/commands")
				const commands = await getCommands(provider.cwd || "")

				// Convert to the format expected by the frontend
				const commandList = commands.map((command) => ({
					name: command.name,
					source: command.source,
					filePath: command.filePath,
					description: command.description,
					argumentHint: command.argumentHint,
				}))

				await provider.postMessageToWebview({
					type: "commands",
					commands: commandList,
				})
			} catch (error) {
				provider.log(`Error fetching commands: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				// Send empty array on error
				await provider.postMessageToWebview({
					type: "commands",
					commands: [],
				})
			}
			break
		}
		case "openCommandFile": {
			try {
				if (message.text) {
					const { getCommand } = await import("../../services/command/commands")
					const command = await getCommand(provider.cwd || "", message.text)

					if (command && command.filePath) {
						openFile(command.filePath)
					} else {
						vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: message.text }))
					}
				}
			} catch (error) {
				provider.log(
					`Error opening command file: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.open_command_file"))
			}
			break
		}
		case "deleteCommand": {
			try {
				if (message.text && message.values?.source) {
					const { getCommand } = await import("../../services/command/commands")
					const command = await getCommand(provider.cwd || "", message.text)

					if (command && command.filePath) {
						// Delete the command file
						await fs.unlink(command.filePath)
						provider.log(`Deleted command file: ${command.filePath}`)
					} else {
						vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: message.text }))
					}
				}
			} catch (error) {
				provider.log(`Error deleting command: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(t("common:errors.delete_command"))
			}
			break
		}
		case "createCommand": {
			try {
				const source = message.values?.source as "global" | "project"
				const fileName = message.text // Custom filename from user input

				if (!source) {
					provider.log("Missing source for createCommand")
					break
				}

				// Determine the commands directory based on source
				let commandsDir: string
				if (source === "global") {
					const globalConfigDir = path.join(os.homedir(), ".roo")
					commandsDir = path.join(globalConfigDir, "commands")
				} else {
					// Project commands
					const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
					if (!workspaceRoot) {
						vscode.window.showErrorMessage(t("common:errors.no_workspace_for_project_command"))
						break
					}
					commandsDir = path.join(workspaceRoot, ".roo", "commands")
				}

				// Ensure the commands directory exists
				await fs.mkdir(commandsDir, { recursive: true })

				// Use provided filename or generate a unique one
				let commandName: string
				if (fileName && fileName.trim()) {
					let cleanFileName = fileName.trim()

					// Strip leading slash if present
					if (cleanFileName.startsWith("/")) {
						cleanFileName = cleanFileName.substring(1)
					}

					// Remove .md extension if present BEFORE slugification
					if (cleanFileName.toLowerCase().endsWith(".md")) {
						cleanFileName = cleanFileName.slice(0, -3)
					}

					// Slugify the command name: lowercase, replace spaces with dashes, remove special characters
					commandName = cleanFileName
						.toLowerCase()
						.replace(/\s+/g, "-") // Replace spaces with dashes
						.replace(/[^a-z0-9-]/g, "") // Remove special characters except dashes
						.replace(/-+/g, "-") // Replace multiple dashes with single dash
						.replace(/^-|-$/g, "") // Remove leading/trailing dashes

					// Ensure we have a valid command name
					if (!commandName || commandName.length === 0) {
						commandName = "new-command"
					}
				} else {
					// Generate a unique command name
					commandName = "new-command"
					let counter = 1
					let filePath = path.join(commandsDir, `${commandName}.md`)

					while (
						await fs
							.access(filePath)
							.then(() => true)
							.catch(() => false)
					) {
						commandName = `new-command-${counter}`
						filePath = path.join(commandsDir, `${commandName}.md`)
						counter++
					}
				}

				const filePath = path.join(commandsDir, `${commandName}.md`)

				// Check if file already exists
				if (
					await fs
						.access(filePath)
						.then(() => true)
						.catch(() => false)
				) {
					vscode.window.showErrorMessage(t("common:errors.command_already_exists", { commandName }))
					break
				}

				// Create the command file with template content
				const templateContent = t("common:errors.command_template_content")

				await fs.writeFile(filePath, templateContent, "utf8")
				provider.log(`Created new command file: ${filePath}`)

				// Open the new file in the editor
				openFile(filePath)

				// Refresh commands list
				const { getCommands } = await import("../../services/command/commands")
				const commands = await getCommands(provider.cwd || "")
				const commandList = commands.map((command) => ({
					name: command.name,
					source: command.source,
					filePath: command.filePath,
					description: command.description,
				}))
				await provider.postMessageToWebview({
					type: "commands",
					commands: commandList,
				})
			} catch (error) {
				provider.log(`Error creating command: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(t("common:errors.create_command_failed"))
			}
			break
		}

		case "insertTextIntoTextarea": {
			const text = message.text
			if (text) {
				// Send message to insert text into the chat textarea
				await provider.postMessageToWebview({
					type: "insertTextIntoTextarea",
					text: text,
				})
			}
			break
		}

		// oacode_change - template management handlers
		case "getTemplateList": {
			try {
				const templates = await provider.templateManager.getAvailableTemplates()
				const activeTemplate = provider.templateManager.getActiveTemplateName()
				
				await provider.postMessageToWebview({
					type: "templateList",
					payload: {
						templates,
						activeTemplate
					}
				})
			} catch (error) {
				provider.log(`Error getting template list: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			}
			break
		}

		case "activateTemplate": {
			if (message.templateName) {
				try {
					await provider.templateManager.activateTemplate(message.templateName)
					// Refresh template list
					const templates = await provider.templateManager.getAvailableTemplates()
					const activeTemplate = provider.templateManager.getActiveTemplateName()
					
					await provider.postMessageToWebview({
						type: "templateList",
						payload: {
							templates,
							activeTemplate
						}
					})
				} catch (error) {
					provider.log(`Error activating template: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
					vscode.window.showErrorMessage(`Failed to activate template: ${error instanceof Error ? error.message : String(error)}`)
				}
			}
			break
		}

		case "deactivateTemplate": {
			try {
				await provider.templateManager.deactivateTemplate()
				// Refresh template list
				const templates = await provider.templateManager.getAvailableTemplates()
				const activeTemplate = provider.templateManager.getActiveTemplateName()
				
				await provider.postMessageToWebview({
					type: "templateList",
					payload: {
						templates,
						activeTemplate
					}
				})
			} catch (error) {
				provider.log(`Error deactivating template: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(`Failed to deactivate template: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}

		case "deleteTemplate": {
			if (message.templateName) {
				try {
					await provider.templateManager.deleteTemplate(message.templateName)
					// Refresh template list
					const templates = await provider.templateManager.getAvailableTemplates()
					const activeTemplate = provider.templateManager.getActiveTemplateName()
					
					await provider.postMessageToWebview({
						type: "templateList",
						payload: {
							templates,
							activeTemplate
						}
					})
				} catch (error) {
					provider.log(`Error deleting template: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
					vscode.window.showErrorMessage(`Failed to delete template: ${error instanceof Error ? error.message : String(error)}`)
				}
			}
			break
		}

		case "uploadTemplateFile": {
			if (message.filename && message.content) {
				try {
					// Directly use the TemplateManager for cleaner upload handling
					
					// Validate filename extension
					if (!message.filename.endsWith('.yaml') && !message.filename.endsWith('.yml')) {
						vscode.window.showErrorMessage(`Template files must have .yaml or .yml extension`)
						return
					}

					// Get workspace path
					const workspacePath = getWorkspacePath()
					if (!workspacePath) {
						vscode.window.showErrorMessage(`No workspace found. Please open a workspace to upload templates.`)
						return
					}

					// Validate YAML content
					let parsedContent: any
					try {
						parsedContent = yaml.parse(message.content)
					} catch (yamlError: any) {
						vscode.window.showErrorMessage(`Invalid YAML format: ${yamlError.message || 'Failed to parse YAML'}`)
						return
					}

					// Validate against schema
					const validationResult = customModesSettingsSchema.safeParse(parsedContent)
					if (!validationResult.success) {
						const issues = validationResult.error.issues
							.map((issue: any) => `• ${issue.path.join(".")}: ${issue.message}`)
							.join("\n")
						vscode.window.showErrorMessage(`Template validation failed:\n${issues}`)
						return
					}

					// Create templates directory if it doesn't exist
					const templatesDir = path.join(workspacePath, ".oacode/templates")
					await fs.mkdir(templatesDir, { recursive: true })

					// Write the template file
					const filePath = path.join(templatesDir, message.filename)
					await fs.writeFile(filePath, message.content, "utf-8")

					// Count modes in the template
					const modeCount = validationResult.data.customModes?.length || 0
					const modeNames = validationResult.data.customModes?.map((m: any) => m.name || m.slug).join(", ") || ""

					// Automatically activate the uploaded template
					const templateName = path.basename(message.filename, path.extname(message.filename))
					await provider.templateManager.activateTemplate(templateName)

					// Show success message
					vscode.window.showInformationMessage(
						`Template "${message.filename}" uploaded and activated successfully! Contains ${modeCount} mode(s): ${modeNames}`
					)

					// Refresh template list
					const templates = await provider.templateManager.getAvailableTemplates()
					const activeTemplate = provider.templateManager.getActiveTemplateName()
					
					await provider.postMessageToWebview({
						type: "templateList",
						payload: {
							templates,
							activeTemplate
						}
					})

				} catch (error) {
					console.error(`Error uploading template:`, error)
					vscode.window.showErrorMessage(`Failed to upload template: ${error instanceof Error ? error.message : String(error)}`)
				}
			}
			break
		}

		case "loadPromptBlocks": {
			try {
				const factory = PromptBlocksFactory.getInstance()
				const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)

				const result = await loadUseCase.execute()
				const blocks = result.blocks.map(block => ({
					name: block.name,
					description: block.description,
					category: block.category,
					tags: block.tags,
					priority: block.priority,
					enabled: block.enabled
				}))

				// Debug logging (only in development)
				if (process.env.NODE_ENV === 'development') {
					const config = factory.getConfigurationInfo(provider.context.extensionPath)
					console.log("[PromptBlocks] Loading from paths:", config)
					console.log("[PromptBlocks] Loaded blocks:", result.blocks.length, "blocks")
					console.log("[PromptBlocks] Sending to webview:", blocks.map(b => b.name))
				}

				await provider.postMessageToWebview({
					type: "promptBlocksLoaded",
					blocks
				})
			} catch (error) {
				// Use structured logging for error reporting
				import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
					import('../infrastructure/errors').then(({ normalizeError }) => {
						const typedError = normalizeError(error, 'LOAD_BLOCKS_FAILED', {
							operation: 'loadPromptBlocks'
						})
						promptBlocksLogger.error('Failed to load prompt blocks for webview', typedError.toLogObject())
					})
				}).catch(() => {
					// Fallback to console logging
					console.error("Failed to load prompt blocks:", error)
				})
				
				await provider.postMessageToWebview({
					type: "promptBlocksLoaded",
					blocks: []
				})
			}
			break
		}

		case "addActivePromptBlock": {
			try {
				if (!message.blockName) {
					throw new Error("Block name is required for addActivePromptBlock")
				}

				// Add to temporary storage
				activePromptBlocks.set(message.blockName, {
					variables: message.variables || {}
				})

				// Load the actual blocks and send updated active list
				const factory = PromptBlocksFactory.getInstance()
				const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)

				const activeBlocks = []
				for (const [blockName, config] of activePromptBlocks.entries()) {
					const block = await loadUseCase.executeByName(blockName)
					if (block) {
						activeBlocks.push({
							block: {
								name: block.name,
								description: block.description,
								category: block.category,
								tags: [...block.tags],
								priority: block.priority,
								enabled: block.enabled
							},
							variables: config.variables,
							priority: block.priority
						})
					}
				}

				await provider.postMessageToWebview({
					type: "activePromptBlocksUpdated",
					activeBlocks
				})
			} catch (error) {
				// Use structured logging for error reporting
				import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
					import('../infrastructure/errors').then(({ normalizeError }) => {
						const typedError = normalizeError(error, 'ADD_PROMPT_BLOCK_FAILED', {
							operation: 'addActivePromptBlock',
							blockName: message.blockName
						})
						promptBlocksLogger.error('Failed to add active prompt block', typedError.toLogObject())
					})
				}).catch(() => {
					console.error("Failed to add active prompt block:", error)
				})
			}
			break
		}

		case "removeActivePromptBlock": {
			try {
				if (!message.blockName) {
					throw new Error("Block name is required for removeActivePromptBlock")
				}

				// Remove from temporary storage
				activePromptBlocks.delete(message.blockName)

				// Load updated active list
				const factory = PromptBlocksFactory.getInstance()
				const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)

				const activeBlocks = []
				for (const [blockName, config] of activePromptBlocks.entries()) {
					const block = await loadUseCase.executeByName(blockName)
					if (block) {
						activeBlocks.push({
							block: {
								name: block.name,
								description: block.description,
								category: block.category,
								tags: [...block.tags],
								priority: block.priority,
								enabled: block.enabled
							},
							variables: config.variables,
							priority: block.priority
						})
					}
				}

				await provider.postMessageToWebview({
					type: "activePromptBlocksUpdated",
					activeBlocks
				})
			} catch (error) {
				// Use structured logging for error reporting
				import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
					import('../infrastructure/errors').then(({ normalizeError }) => {
						const typedError = normalizeError(error, 'REMOVE_PROMPT_BLOCK_FAILED', {
							operation: 'removeActivePromptBlock',
							blockName: message.blockName
						})
						promptBlocksLogger.error('Failed to remove active prompt block', typedError.toLogObject())
					})
				}).catch(() => {
					console.error("Failed to remove active prompt block:", error)
				})
			}
			break
		}

		case "getActivePromptBlocks": {
			try {
				// Load active blocks from temporary storage
				const factory = PromptBlocksFactory.getInstance()
				const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)

				const activeBlocks = []
				for (const [blockName, config] of activePromptBlocks.entries()) {
					const block = await loadUseCase.executeByName(blockName)
					if (block) {
						activeBlocks.push({
							block: {
								name: block.name,
								description: block.description,
								category: block.category,
								tags: [...block.tags],
								priority: block.priority,
								enabled: block.enabled
							},
							variables: config.variables,
							priority: block.priority
						})
					}
				}

				await provider.postMessageToWebview({
					type: "activePromptBlocksLoaded",
					activeBlocks
				})
			} catch (error) {
				// Use structured logging for error reporting
				import('../infrastructure/Logger').then(({ promptBlocksLogger }) => {
					import('../infrastructure/errors').then(({ normalizeError }) => {
						const typedError = normalizeError(error, 'GET_PROMPT_BLOCKS_FAILED', {
							operation: 'getActivePromptBlocks'
						})
						promptBlocksLogger.error('Failed to get active prompt blocks', typedError.toLogObject())
					})
				}).catch(() => {
					console.error("Failed to get active prompt blocks:", error)
				})

				await provider.postMessageToWebview({
					type: "activePromptBlocksLoaded",
					activeBlocks: []
				})
			}
			break
		}
	}
}
