import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"

// Load environment variables from .env file
try {
	// Specify path to .env file in the project root directory
	const envPath = path.join(__dirname, "..", ".env")
	dotenvx.config({ path: envPath })
} catch (e) {
	// Silently handle environment loading errors
	console.warn("Failed to load environment variables:", e)
}

import { CloudService } from "@roo-code/cloud"
import { TelemetryService, PostHogTelemetryClient } from "@roo-code/telemetry"

import "./utils/path" // Necessary to have access to String.prototype.toPosix.
import { createOutputChannelLogger, createDualLogger } from "./utils/outputChannelLogger"

import { Package } from "./shared/package"
import { formatLanguage } from "./shared/language"
import { ContextProxy } from "./core/config/ContextProxy"
import { ClineProvider } from "./core/webview/ClineProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { CodeIndexManager } from "./services/code-index/manager"
import { registerCommitMessageProvider } from "./services/commit-message"
import { MdmService } from "./services/mdm/MdmService"
import { ChatsMirrorService } from "./services/mirror/ChatsMirrorService"
import { ChatsMirrorDetection } from "./services/mirror/ChatsMirrorDetection"
import { ChatsMirrorMigration } from "./services/mirror/ChatsMirrorMigration"
import { migrateSettings } from "./utils/migrateSettings"
import { checkAndRunAutoLaunchingTask as checkAndRunAutoLaunchingTask } from "./utils/autoLaunchingTask"
import { autoImportSettings } from "./utils/autoImportSettings"
import { API } from "./extension/api"
import { installHttpInterceptors } from "./core/debug/httpInterceptor"

import {
	handleUri,
	registerCommands,
	registerCodeActions,
	registerTerminalActions,
	CodeActionProvider,
} from "./activate"
import { initializeI18n } from "./i18n"
import { registerGhostProvider } from "./services/ghost" // oacode_change
import { TerminalWelcomeService } from "./services/terminal-welcome/TerminalWelcomeService" // oacode_change

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

/**
 * Perform automatic migration when triggers are detected
 * Executes the migration process and updates the migration flag upon completion
 * Handles errors gracefully to prevent blocking extension startup
 */
async function performAutomaticMigration(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, chatsMirrorService: ChatsMirrorService, detectionService: ChatsMirrorDetection): Promise<void> {
	try {
		outputChannel.appendLine("[ChatsMirrorMigration] Starting automatic migration...")
		
		// Initialize migration service
		const migrationService = new ChatsMirrorMigration(context, outputChannel, chatsMirrorService)
		
		// Start migration with auto-recovery support
		const migrationResult = await migrationService.startMigration(false) // Don't force restart, allow recovery
		
		// Log migration results and show user notifications
		if (migrationResult.success) {
			const successMessage = `Migration completed successfully - ${migrationResult.successCount} chats migrated`
			outputChannel.appendLine(`[ChatsMirrorMigration] ${successMessage}, ${migrationResult.skipCount} skipped`)
			
			// Show success notification to user for large migrations
			if (migrationResult.successCount > 50) {
				vscode.window.showInformationMessage(
					`✅ Chat Mirror Migration Complete: ${migrationResult.successCount} chats successfully migrated to mirror files.`
				)
			}
			
			// Mark migration as completed in detection service
			await detectionService.saveMigrationFlag(true, false)
			outputChannel.appendLine("[ChatsMirrorMigration] Migration flag updated - automatic detection will now pass")
		} else {
			const errorMessage = `Migration completed with errors - ${migrationResult.successCount} succeeded, ${migrationResult.failureCount} failed`
			outputChannel.appendLine(`[ChatsMirrorMigration] ${errorMessage}`)
			outputChannel.appendLine(`[ChatsMirrorMigration] Error: ${migrationResult.error}`)
			
			// Show warning notification to user about partial migration
			if (migrationResult.successCount > 0) {
				vscode.window.showWarningMessage(
					`⚠️ Chat Mirror Migration Partial: ${migrationResult.successCount} succeeded, ${migrationResult.failureCount} failed. Check output channel for details.`
				)
			} else {
				vscode.window.showErrorMessage(
					`❌ Chat Mirror Migration Failed: ${migrationResult.error}. Check output channel for details.`
				)
			}
			
			// Don't mark as completed if there were failures - allows retry on next startup
			outputChannel.appendLine("[ChatsMirrorMigration] Migration flag not updated due to errors - will retry on next startup")
		}
		
		// Clean up migration service
		migrationService.dispose()
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`[ChatsMirrorMigration] Automatic migration failed: ${errorMessage}`)
		
		// Log additional error details for debugging
		if (error instanceof Error && error.stack) {
			outputChannel.appendLine(`[ChatsMirrorMigration] Error stack: ${error.stack}`)
		}
		
		// Don't throw - migration failures should not block extension startup
		outputChannel.appendLine("[ChatsMirrorMigration] Migration failure will not block extension startup - manual migration may be required")
	}
}

/**
 * Perform smart migration detection to determine if migration is needed
 * Checks all triggers and logs detection results for debugging
 * Integrates with migration detection service for comprehensive analysis
 */
async function performMigrationDetection(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, chatsMirrorService: ChatsMirrorService): Promise<void> {
	try {
		outputChannel.appendLine("[ChatsMirrorDetection] Starting smart migration detection...")
		
		// Initialize detection service
		const detectionService = new ChatsMirrorDetection(context, outputChannel, chatsMirrorService)
		
		// Perform comprehensive detection analysis
		const detectionResult = await detectionService.detectMigrationNeed()
		
		// Log summary of detection results
		outputChannel.appendLine(`[ChatsMirrorDetection] Detection completed - migration needed: ${detectionResult.shouldMigrate}`)
		
		if (detectionResult.shouldMigrate) {
			outputChannel.appendLine(`[ChatsMirrorDetection] Migration trigger: ${detectionResult.trigger}`)
			outputChannel.appendLine(`[ChatsMirrorDetection] All triggers: ${detectionResult.triggers.join(', ')}`)
			
			// Automatically trigger migration when detection determines it's needed
			outputChannel.appendLine("[ChatsMirrorDetection] Triggers detected - starting automatic migration...")
			await performAutomaticMigration(context, outputChannel, chatsMirrorService, detectionService)
		} else {
			outputChannel.appendLine("[ChatsMirrorDetection] No migration needed - all systems are synchronized")
		}
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`[ChatsMirrorDetection] Detection failed: ${errorMessage}`)
		// Non-critical error - don't throw, just log
	}
}

/**
 * Initialize the chat mirror service with configuration validation and error handling
 * Checks if mirror functionality is enabled before attempting initialization
 * Provides comprehensive startup logging for debugging and monitoring
 */
async function initializeChatsMirrorService(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<void> {
	try {
		// Load configuration to check if mirror is enabled
		const config = vscode.workspace.getConfiguration()
		const mirrorEnabled = config.get<boolean>("oa-code.chatsMirror.enabled") ?? true
		const mirrorPath = config.get<string>("oa-code.chatsMirror.folder") ?? ""

		outputChannel.appendLine(`[ChatsMirrorService] Configuration check - enabled: ${mirrorEnabled}, custom path: ${mirrorPath || "default"}`)

		if (!mirrorEnabled) {
			outputChannel.appendLine("[ChatsMirrorService] Mirror functionality is disabled in configuration, skipping initialization")
			return
		}

		// Initialize the chat mirror service singleton
		outputChannel.appendLine("[ChatsMirrorService] Initializing chat mirror service...")
		const chatsMirrorService = await ChatsMirrorService.getInstance(context)
		
		// Service initialization is handled by getInstance, no need to call initialize() again
		
		// Verify service is properly initialized and enabled
		if (chatsMirrorService.isInitialized() && chatsMirrorService.isMirrorEnabled()) {
			const mirrorFolderPath = chatsMirrorService.getMirrorFolderPath()
			outputChannel.appendLine(`[ChatsMirrorService] Successfully initialized - mirror folder: ${mirrorFolderPath}`)
			
			// Log queue statistics for monitoring
			const queueStats = chatsMirrorService.getQueueStatistics()
			outputChannel.appendLine(`[ChatsMirrorService] Initial queue state - size: ${queueStats.queueSize}, processing: ${queueStats.isProcessing}`)

			// Perform smart migration detection to check if migration is needed
			await performMigrationDetection(context, outputChannel, chatsMirrorService)
		} else {
			outputChannel.appendLine("[ChatsMirrorService] Service initialized but mirror functionality is not available")
		}

		// Add service to context subscriptions for proper cleanup
		context.subscriptions.push({
			dispose: () => {
				try {
					chatsMirrorService.dispose()
					outputChannel.appendLine("[ChatsMirrorService] Disposed successfully")
				} catch (error) {
					outputChannel.appendLine(`[ChatsMirrorService] Error during disposal: ${error}`)
				}
			}
		})

	} catch (error) {
		// Log error but don't throw - mirror service failures should not block extension activation
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`[ChatsMirrorService] Failed to initialize: ${errorMessage}`)
		
		// Log additional error details for debugging
		if (error instanceof Error && error.stack) {
			outputChannel.appendLine(`[ChatsMirrorService] Error stack: ${error.stack}`)
		}
	}
}

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Oa-Code")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine(`${Package.name} extension activated - ${JSON.stringify(Package)}`)

	// Install HTTP interceptors for debug capture (only in dev mode)
	installHttpInterceptors()

	// Migrate old settings to new
	await migrateSettings(context, outputChannel)

	// Initialize telemetry service.
	const telemetryService = TelemetryService.createInstance()

	try {
		telemetryService.register(new PostHogTelemetryClient())
	} catch (error) {
		console.warn("Failed to register PostHogTelemetryClient:", error)
	}

	// Create logger for cloud services
	const cloudLogger = createDualLogger(createOutputChannelLogger(outputChannel))

	// oacode_change start: no Roo cloud service
	// Initialize Roo Code Cloud service.
	// const cloudService = await CloudService.createInstance(context, cloudLogger)

	// try {
	// 	if (cloudService.telemetryClient) {
	// 		TelemetryService.instance.register(cloudService.telemetryClient)
	// 	}
	// } catch (error) {
	// 	outputChannel.appendLine(
	// 		`[CloudService] Failed to register TelemetryClient: ${error instanceof Error ? error.message : String(error)}`,
	// 	)
	// }

	// const postStateListener = () => {
	// 	ClineProvider.getVisibleInstance()?.postStateToWebview()
	// }

	// cloudService.on("auth-state-changed", postStateListener)
	// cloudService.on("user-info", postStateListener)
	// cloudService.on("settings-updated", postStateListener)

	// // Add to subscriptions for proper cleanup on deactivate
	// context.subscriptions.push(cloudService)
	// oacode_change end

	// Initialize MDM service
	const mdmService = await MdmService.createInstance(cloudLogger)

	// Initialize i18n for internationalization support
	initializeI18n(context.globalState.get("language") ?? "en-US") // oacode_change

	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration(Package.name).get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	// oacode_change start
	if (!context.globalState.get("firstInstallCompleted")) {
		context.globalState.update("telemetrySetting", "enabled")
	}
	// oacode_change end

	const contextProxy = await ContextProxy.getInstance(context)

	// Initialize code index managers for all workspace folders
	const codeIndexManagers: CodeIndexManager[] = []
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const manager = CodeIndexManager.getInstance(context, folder.uri.fsPath)
			if (manager) {
				codeIndexManagers.push(manager)
				try {
					await manager.initialize(contextProxy)
				} catch (error) {
					outputChannel.appendLine(
						`[CodeIndexManager] Error during background CodeIndexManager configuration/indexing for ${folder.uri.fsPath}: ${error.message || error}`,
					)
				}
				context.subscriptions.push(manager)
			}
		}
	}

	const provider = new ClineProvider(context, outputChannel, "sidebar", contextProxy, mdmService)
	TelemetryService.instance.setProvider(provider)

	// Initialize chat mirror service for syncing task data with file system
	await initializeChatsMirrorService(context, outputChannel)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	// oacode_change start
	if (!context.globalState.get("firstInstallCompleted")) {
		outputChannel.appendLine("First installation detected, opening OpenAnalyst sidebar!")
		try {
			await vscode.commands.executeCommand("oa-code.SidebarProvider.focus")

			outputChannel.appendLine("Opening OpenAnalyst walkthrough")

			// this can crash, see:
			// https://discord.com/channels/1349288496988160052/1395865796026040470
			await vscode.commands.executeCommand(
				"workbench.action.openWalkthrough",
				"oacode.oa-code#oaCodeWalkthrough",
				false,
			)
		} catch (error) {
			outputChannel.appendLine(`Error during first-time setup: ${error.message}`)
		} finally {
			context.globalState.update("firstInstallCompleted", true)
		}
	}
	// oacode_change end

	// Auto-import configuration if specified in settings
	try {
		await autoImportSettings(outputChannel, {
			providerSettingsManager: provider.providerSettingsManager,
			contextProxy: provider.contextProxy,
			customModesManager: provider.customModesManager,
		})
	} catch (error) {
		outputChannel.appendLine(
			`[AutoImport] Error during auto-import: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	await registerCommands({ context, outputChannel, provider })

	// Register BigQuery tools test command
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.testBigQueryTools", async () => {
			const { runBigQueryToolsTest } = await import("./test-runner")
			await runBigQueryToolsTest()
		})
	)

	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerGhostProvider(context, provider) // oacode_change
	registerCommitMessageProvider(context, outputChannel) // oacode_change
	registerCodeActions(context)
	registerTerminalActions(context)

	// Allows other extensions to activate once OpenAnalyst is ready.
	vscode.commands.executeCommand(`${Package.name}.activationCompleted`)

	// Implements the `RooCodeAPI` interface.
	const socketPath = process.env.OA_IPC_SOCKET_PATH ?? process.env.ROO_CODE_IPC_SOCKET_PATH // oacode_change
	const enableLogging = typeof socketPath === "string"

	// Watch the core files and automatically reload the extension host.
	if (process.env.NODE_ENV === "development") {
		const watchPaths = [
			{ path: context.extensionPath, pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/types"), pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/telemetry"), pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "node_modules/@roo-code/cloud"), pattern: "**/*" },
		]

		console.log(
			`♻️♻️♻️ Core auto-reloading: Watching for changes in ${watchPaths.map(({ path }) => path).join(", ")}`,
		)

		// Create a debounced reload function to prevent excessive reloads
		let reloadTimeout: NodeJS.Timeout | undefined
		const DEBOUNCE_DELAY = 1_000

		const debouncedReload = (uri: vscode.Uri) => {
			if (reloadTimeout) {
				clearTimeout(reloadTimeout)
			}

			console.log(`♻️ ${uri.fsPath} changed; scheduling reload...`)

			reloadTimeout = setTimeout(() => {
				console.log(`♻️ Reloading host after debounce delay...`)
				vscode.commands.executeCommand("workbench.action.reloadWindow")
			}, DEBOUNCE_DELAY)
		}

		watchPaths.forEach(({ path: watchPath, pattern }) => {
			const relPattern = new vscode.RelativePattern(vscode.Uri.file(watchPath), pattern)
			const watcher = vscode.workspace.createFileSystemWatcher(relPattern, false, false, false)

			// Listen to all change types to ensure symlinked file updates trigger reloads.
			watcher.onDidChange(debouncedReload)
			watcher.onDidCreate(debouncedReload)
			watcher.onDidDelete(debouncedReload)

			context.subscriptions.push(watcher)
		})

		// Clean up the timeout on deactivation
		context.subscriptions.push({
			dispose: () => {
				if (reloadTimeout) {
					clearTimeout(reloadTimeout)
				}
			},
		})
	}

	await checkAndRunAutoLaunchingTask(context) // oacode_change

	return new API(outputChannel, provider, socketPath, enableLogging)
}

// This method is called when your extension is deactivated.
export async function deactivate() {
	outputChannel.appendLine(`${Package.name} extension deactivated`)
	await McpServerManager.cleanup(extensionContext)
	TelemetryService.instance.shutdown()
	TerminalRegistry.cleanup()
}
