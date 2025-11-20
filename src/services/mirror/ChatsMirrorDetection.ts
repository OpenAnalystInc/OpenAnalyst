import * as vscode from 'vscode'
import * as fs from 'fs/promises'
import * as path from 'path'
import { HistoryItem } from "../../../packages/types/src/history"
import { ChatsMirrorService } from './ChatsMirrorService'

/**
 * Migration trigger reasons for tracking why migration is needed
 * Provides detailed information about what triggered migration detection
 */
export enum MigrationTrigger {
	NONE = 'none',
	FOLDER_MISSING = 'folder_missing',
	COUNT_MISMATCH = 'count_mismatch',
	INTEGRITY_FAILURE = 'integrity_failure',
	FORCED_RESET = 'forced_reset'
}

/**
 * Detection result information providing comprehensive migration analysis
 * Contains all information needed to decide if migration should be triggered
 */
export interface DetectionResult {
	/** Whether migration should be triggered */
	shouldMigrate: boolean
	/** Primary reason for migration trigger */
	trigger: MigrationTrigger
	/** Detailed reasons for migration (can be multiple) */
	triggers: MigrationTrigger[]
	/** Number of chats in task history */
	taskHistoryCount: number
	/** Number of mirror files found */
	mirrorFileCount: number
	/** Whether the mirror folder exists */
	folderExists: boolean
	/** List of integrity issues found */
	integrityIssues: string[]
	/** Timestamp when detection was performed */
	detectionTimestamp: number
	/** Whether this is the first time detection has run */
	isFirstRun: boolean
	/** Previous migration flag state */
	previousMigrationFlag: boolean
}

/**
 * Folder integrity analysis results
 * Provides detailed information about mirror folder health
 */
interface FolderIntegrityResult {
	/** Whether folder passed integrity checks */
	isValid: boolean
	/** Total number of files in folder */
	totalFiles: number
	/** Number of valid JSON mirror files */
	validMirrorFiles: number
	/** Number of invalid/corrupted files */
	invalidFiles: number
	/** List of specific integrity issues */
	issues: string[]
	/** List of files that failed validation */
	failedFiles: string[]
}

/**
 * Migration status flag stored in globalState
 * Tracks whether migration has been completed successfully
 */
export interface MigrationFlag {
	/** Whether migration has been completed */
	completed: boolean
	/** Timestamp when migration was last completed */
	completedAt: number
	/** Version of migration system when completed */
	version: string
	/** Whether to skip automatic detection */
	skipAutoDetection: boolean
}

/**
 * Smart migration detection service with comprehensive trigger analysis
 * Automatically detects when ChatsMirror migration is needed based on multiple criteria
 * Provides detailed logging and analysis for troubleshooting migration issues
 */
export class ChatsMirrorDetection {
	private static readonly MIGRATION_FLAG_KEY = 'chatsMirrorMigrationCompleted'
	private static readonly MIGRATION_VERSION = '1.0.0'
	private static readonly MAX_INTEGRITY_CHECK_FILES = 1000 // Limit for performance

	private readonly context: vscode.ExtensionContext
	private readonly outputChannel: vscode.OutputChannel
	private readonly chatsMirrorService: ChatsMirrorService

	constructor(
		context: vscode.ExtensionContext,
		outputChannel: vscode.OutputChannel,
		chatsMirrorService: ChatsMirrorService
	) {
		this.context = context
		this.outputChannel = outputChannel
		this.chatsMirrorService = chatsMirrorService

		this.logInfo('ChatsMirrorDetection service initialized')
	}

	/**
	 * Perform comprehensive migration detection on startup
	 * Checks all triggers and determines if migration is needed
	 * This is the main entry point for detection logic
	 */
	public async detectMigrationNeed(): Promise<DetectionResult> {
		const detectionStart = Date.now()
		this.logInfo('Starting smart migration detection...')

		try {
			// Load current migration flag state
			const migrationFlag = await this.loadMigrationFlag()
			const isFirstRun = migrationFlag === null
			
			this.logInfo(`Migration flag state - completed: ${migrationFlag?.completed ?? false}, first run: ${isFirstRun}`)

			// Initialize result object
			const result: DetectionResult = {
				shouldMigrate: false,
				trigger: MigrationTrigger.NONE,
				triggers: [],
				taskHistoryCount: 0,
				mirrorFileCount: 0,
				folderExists: false,
				integrityIssues: [],
				detectionTimestamp: detectionStart,
				isFirstRun,
				previousMigrationFlag: migrationFlag?.completed ?? false
			}

			// Skip detection if auto-detection is disabled (unless first run)
			if (migrationFlag?.skipAutoDetection && !isFirstRun) {
				this.logInfo('Auto-detection is disabled, skipping migration detection')
				return result
			}

			// Check if migration was already completed and should be skipped
			if (migrationFlag?.completed && !isFirstRun) {
				this.logInfo('Migration already completed, performing verification checks only')
			}

			// Perform all detection checks
			await this.checkAllTriggers(result)

			// Determine if migration should be triggered
			this.determineMigrationNeed(result, migrationFlag)

			// Log detection results
			await this.logDetectionResults(result, Date.now() - detectionStart)

			// Note: Migration flag will be reset by the migration service after successful completion
			// We don't reset it here to avoid clearing the flag if migration fails

			return result

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Migration detection failed: ${errorMessage}`)
			
			// Return a safe default result that doesn't trigger migration
			return {
				shouldMigrate: false,
				trigger: MigrationTrigger.NONE,
				triggers: [],
				taskHistoryCount: 0,
				mirrorFileCount: 0,
				folderExists: false,
				integrityIssues: [`Detection error: ${errorMessage}`],
				detectionTimestamp: detectionStart,
				isFirstRun: false,
				previousMigrationFlag: false
			}
		}
	}

	/**
	 * Perform all trigger checks and populate detection result
	 * Executes all migration triggers in sequence with error isolation
	 */
	private async checkAllTriggers(result: DetectionResult): Promise<void> {
		// Trigger 1: Check if OpenAnalystChats folder exists
		await this.checkFolderExistence(result)

		// Trigger 2: Compare task history count vs mirror file count
		await this.checkCountMismatch(result)

		// Trigger 3: Validate mirror folder integrity
		await this.checkFolderIntegrity(result)
	}

	/**
	 * Trigger 1: Check if OpenAnalystChats folder exists
	 * Detects if the mirror folder is missing entirely
	 */
	private async checkFolderExistence(result: DetectionResult): Promise<void> {
		try {
			this.logDebug('Checking mirror folder existence...')

			// Check if mirror service is enabled and initialized
			if (!this.chatsMirrorService.isMirrorEnabled()) {
				this.logInfo('Mirror service is disabled, skipping folder existence check')
				return
			}

			// Get mirror folder path
			const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
			if (!mirrorPath) {
				this.logWarn('Mirror folder path not available, treating as missing')
				result.folderExists = false
				result.triggers.push(MigrationTrigger.FOLDER_MISSING)
				return
			}

			// Check if folder exists
			try {
				const stats = await fs.stat(mirrorPath)
				result.folderExists = stats.isDirectory()
				
				if (!result.folderExists) {
					this.logWarn(`Mirror path exists but is not a directory: ${mirrorPath}`)
					result.triggers.push(MigrationTrigger.FOLDER_MISSING)
				} else {
					this.logDebug(`Mirror folder exists: ${mirrorPath}`)
				}
			} catch (error) {
				// Folder doesn't exist or is inaccessible
				result.folderExists = false
				result.triggers.push(MigrationTrigger.FOLDER_MISSING)
				this.logInfo(`Mirror folder does not exist: ${mirrorPath}`)
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Error checking folder existence: ${errorMessage}`)
			result.integrityIssues.push(`Folder existence check failed: ${errorMessage}`)
		}
	}

	/**
	 * Trigger 2: Compare task history count vs mirror file count
	 * Detects mismatches between stored task history and mirror files
	 */
	private async checkCountMismatch(result: DetectionResult): Promise<void> {
		try {
			this.logDebug('Checking count mismatch between task history and mirror files...')

			// Get task history count
			result.taskHistoryCount = await this.getTaskHistoryCount()
			this.logDebug(`Task history contains ${result.taskHistoryCount} items`)

			// Get mirror file count (only if folder exists)
			if (result.folderExists) {
				result.mirrorFileCount = await this.getMirrorFileCount()
				this.logDebug(`Mirror folder contains ${result.mirrorFileCount} files`)

				// Compare counts with tolerance for normal differences
				const countDifference = Math.abs(result.taskHistoryCount - result.mirrorFileCount)
				const toleranceThreshold = Math.max(1, Math.floor(result.taskHistoryCount * 0.1)) // 10% tolerance
				
				if (countDifference > toleranceThreshold) {
					this.logWarn(`Count mismatch detected - TaskHistory: ${result.taskHistoryCount}, Mirror: ${result.mirrorFileCount}, Difference: ${countDifference}`)
					result.triggers.push(MigrationTrigger.COUNT_MISMATCH)
				} else {
					this.logDebug(`Count check passed - difference ${countDifference} is within tolerance ${toleranceThreshold}`)
				}
			} else {
				// Folder doesn't exist, so mirror count is effectively 0
				result.mirrorFileCount = 0
				if (result.taskHistoryCount > 0) {
					this.logInfo(`Task history has ${result.taskHistoryCount} items but mirror folder doesn't exist`)
					// Don't add COUNT_MISMATCH since FOLDER_MISSING already covers this
				}
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Error checking count mismatch: ${errorMessage}`)
			result.integrityIssues.push(`Count mismatch check failed: ${errorMessage}`)
		}
	}

	/**
	 * Trigger 3: Validate mirror folder integrity
	 * Performs comprehensive validation of mirror files and folder structure
	 */
	private async checkFolderIntegrity(result: DetectionResult): Promise<void> {
		try {
			this.logDebug('Checking mirror folder integrity...')

			// Skip integrity check if folder doesn't exist
			if (!result.folderExists) {
				this.logDebug('Skipping integrity check - folder does not exist')
				return
			}

			// Perform detailed integrity analysis
			const integrityResult = await this.performIntegrityAnalysis()
			
			// Add issues to result
			result.integrityIssues.push(...integrityResult.issues)

			// Update mirror file count with validated count
			result.mirrorFileCount = integrityResult.validMirrorFiles

			// Determine if integrity issues require migration
			if (!integrityResult.isValid) {
				this.logWarn(`Mirror folder integrity check failed: ${integrityResult.issues.length} issues found`)
				result.triggers.push(MigrationTrigger.INTEGRITY_FAILURE)
				
				// Log detailed integrity issues
				integrityResult.issues.forEach((issue, index) => {
					this.logWarn(`  Issue ${index + 1}: ${issue}`)
				})
			} else {
				this.logDebug(`Mirror folder integrity check passed: ${integrityResult.validMirrorFiles} valid files`)
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Error checking folder integrity: ${errorMessage}`)
			result.integrityIssues.push(`Integrity check failed: ${errorMessage}`)
			result.triggers.push(MigrationTrigger.INTEGRITY_FAILURE)
		}
	}

	/**
	 * Perform detailed integrity analysis of mirror folder
	 * Validates file format, content, and naming conventions
	 */
	private async performIntegrityAnalysis(): Promise<FolderIntegrityResult> {
		const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
		if (!mirrorPath) {
			throw new Error('Mirror folder path not available')
		}

		const result: FolderIntegrityResult = {
			isValid: true,
			totalFiles: 0,
			validMirrorFiles: 0,
			invalidFiles: 0,
			issues: [],
			failedFiles: []
		}

		try {
			// Read directory contents
			const files = await fs.readdir(mirrorPath)
			result.totalFiles = files.length

			// Limit analysis for performance (check most recent files first)
			const filesToCheck = files
				.filter(file => file.endsWith('.json'))
				.slice(0, ChatsMirrorDetection.MAX_INTEGRITY_CHECK_FILES)

			this.logDebug(`Analyzing ${filesToCheck.length} JSON files out of ${files.length} total files`)

			// Check each JSON file
			for (const fileName of filesToCheck) {
				try {
					const filePath = path.join(mirrorPath, fileName)
					const isValid = await this.validateMirrorFile(filePath)
					
					if (isValid) {
						result.validMirrorFiles++
					} else {
						result.invalidFiles++
						result.failedFiles.push(fileName)
						result.issues.push(`Invalid mirror file: ${fileName}`)
					}
				} catch (error) {
					result.invalidFiles++
					result.failedFiles.push(fileName)
					const errorMessage = error instanceof Error ? error.message : String(error)
					result.issues.push(`Failed to validate ${fileName}: ${errorMessage}`)
				}
			}

			// Check for non-JSON files (potential issues)
			const nonJsonFiles = files.filter(file => !file.endsWith('.json'))
			if (nonJsonFiles.length > 0) {
				result.issues.push(`Found ${nonJsonFiles.length} non-JSON files in mirror folder`)
			}

			// Determine overall validity
			const validFileRatio = result.totalFiles > 0 ? result.validMirrorFiles / result.totalFiles : 1
			const minimumValidRatio = 0.8 // 80% of files should be valid

			if (validFileRatio < minimumValidRatio) {
				result.isValid = false
				result.issues.push(`Low valid file ratio: ${(validFileRatio * 100).toFixed(1)}% (minimum: ${(minimumValidRatio * 100)}%)`)
			}

			// Check for too many invalid files
			if (result.invalidFiles > 10) {
				result.isValid = false
				result.issues.push(`Too many invalid files: ${result.invalidFiles}`)
			}

		} catch (error) {
			result.isValid = false
			const errorMessage = error instanceof Error ? error.message : String(error)
			result.issues.push(`Failed to analyze mirror folder: ${errorMessage}`)
		}

		return result
	}

	/**
	 * Validate a single mirror file for proper format and content
	 * Checks JSON structure and required fields
	 */
	private async validateMirrorFile(filePath: string): Promise<boolean> {
		try {
			// Read and parse JSON
			const content = await fs.readFile(filePath, 'utf8')
			const data = JSON.parse(content)

			// Check required fields for mirror format
			const requiredFields = ['id', 'title', 'ts', 'lastUpdated']
			for (const field of requiredFields) {
				if (!(field in data)) {
					return false
				}
			}

			// Validate field types
			if (typeof data.id !== 'string' || data.id.trim() === '') {
				return false
			}

			if (typeof data.title !== 'string' || data.title.trim() === '') {
				return false
			}

			if (typeof data.ts !== 'number' || data.ts <= 0) {
				return false
			}

			if (typeof data.lastUpdated !== 'number' || data.lastUpdated <= 0) {
				return false
			}

			return true

		} catch (error) {
			// Any error means invalid file
			return false
		}
	}

	/**
	 * Get total count of items in task history
	 * Safely retrieves task history from globalState
	 */
	private async getTaskHistoryCount(): Promise<number> {
		try {
			const taskHistory = this.context.globalState.get<HistoryItem[]>('taskHistory') || []
			return taskHistory.length
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to get task history count: ${errorMessage}`)
			return 0
		}
	}

	/**
	 * Get count of valid mirror files in the mirror folder
	 * Counts only .json files that represent chat mirrors
	 */
	private async getMirrorFileCount(): Promise<number> {
		try {
			const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
			if (!mirrorPath) {
				return 0
			}

			const files = await fs.readdir(mirrorPath)
			// Count only JSON files (mirror files should all be .json)
			const jsonFiles = files.filter(file => file.endsWith('.json'))
			return jsonFiles.length

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to get mirror file count: ${errorMessage}`)
			return 0
		}
	}

	/**
	 * Determine if migration should be triggered based on detection results
	 * Applies business logic to decide when migration is needed
	 */
	private determineMigrationNeed(result: DetectionResult, migrationFlag: MigrationFlag | null): void {
		// Migration is needed if any triggers fired
		result.shouldMigrate = result.triggers.length > 0

		// Set primary trigger (first/most important one)
		if (result.triggers.length > 0) {
			result.trigger = result.triggers[0]
		}

		// Special case: If migration was completed but triggers fired, it means something went wrong
		if (migrationFlag?.completed && result.shouldMigrate) {
			this.logWarn('Migration was previously completed but triggers fired - data may have been corrupted or deleted')
		}

		// Log decision reasoning
		if (result.shouldMigrate) {
			this.logInfo(`Migration needed - triggers: ${result.triggers.join(', ')}`)
		} else {
			this.logInfo('No migration needed - all checks passed')
		}
	}

	/**
	 * Reset migration flag when triggers fire
	 * Clears the completed flag to allow migration to run again
	 */
	private async resetMigrationFlag(triggers: MigrationTrigger[]): Promise<void> {
		try {
			this.logInfo(`Resetting migration flag due to triggers: ${triggers.join(', ')}`)
			
			// Clear the migration flag to allow migration to run
			await this.context.globalState.update(ChatsMirrorDetection.MIGRATION_FLAG_KEY, undefined)
			
			this.logInfo('Migration flag reset - migration can now be triggered')

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to reset migration flag: ${errorMessage}`)
		}
	}

	/**
	 * Load migration flag from globalState
	 * Retrieves current migration completion status
	 */
	private async loadMigrationFlag(): Promise<MigrationFlag | null> {
		try {
			const flag = this.context.globalState.get<MigrationFlag>(ChatsMirrorDetection.MIGRATION_FLAG_KEY)
			return flag || null
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logWarn(`Failed to load migration flag: ${errorMessage}`)
			return null
		}
	}

	/**
	 * Save migration flag to globalState
	 * Updates migration completion status
	 */
	public async saveMigrationFlag(completed: boolean, skipAutoDetection: boolean = false): Promise<void> {
		try {
			const flag: MigrationFlag = {
				completed,
				completedAt: Date.now(),
				version: ChatsMirrorDetection.MIGRATION_VERSION,
				skipAutoDetection
			}

			await this.context.globalState.update(ChatsMirrorDetection.MIGRATION_FLAG_KEY, flag)
			this.logInfo(`Migration flag saved - completed: ${completed}, skipAutoDetection: ${skipAutoDetection}`)

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to save migration flag: ${errorMessage}`)
		}
	}

	/**
	 * Force reset migration flag for manual triggering
	 * Allows manual override of migration detection
	 */
	public async forceResetMigrationFlag(): Promise<void> {
		await this.resetMigrationFlag([MigrationTrigger.FORCED_RESET])
	}

	/**
	 * Get current migration flag status
	 * Returns current migration completion state
	 */
	public async getMigrationFlagStatus(): Promise<MigrationFlag | null> {
		return await this.loadMigrationFlag()
	}

	/**
	 * Check if migration detection should be skipped
	 * Returns true if auto-detection is disabled
	 */
	public async shouldSkipDetection(): Promise<boolean> {
		const flag = await this.loadMigrationFlag()
		return flag?.skipAutoDetection ?? false
	}

	/**
	 * Enable or disable automatic migration detection
	 * Allows fine-grained control over detection behavior
	 */
	public async setAutoDetectionEnabled(enabled: boolean): Promise<void> {
		const currentFlag = await this.loadMigrationFlag() || {
			completed: false,
			completedAt: 0,
			version: ChatsMirrorDetection.MIGRATION_VERSION,
			skipAutoDetection: false
		}

		currentFlag.skipAutoDetection = !enabled
		
		const flag: MigrationFlag = {
			...currentFlag,
			skipAutoDetection: !enabled
		}

		await this.context.globalState.update(ChatsMirrorDetection.MIGRATION_FLAG_KEY, flag)
		this.logInfo(`Auto-detection ${enabled ? 'enabled' : 'disabled'}`)
	}

	/**
	 * Log comprehensive detection results for debugging
	 * Provides detailed information about detection process and results
	 */
	private async logDetectionResults(result: DetectionResult, duration: number): Promise<void> {
		this.logInfo('=== Migration Detection Results ===')
		this.logInfo(`Detection completed in ${duration}ms`)
		this.logInfo(`Should migrate: ${result.shouldMigrate}`)
		this.logInfo(`Primary trigger: ${result.trigger}`)
		this.logInfo(`All triggers: ${result.triggers.length > 0 ? result.triggers.join(', ') : 'none'}`)
		this.logInfo(`Task history count: ${result.taskHistoryCount}`)
		this.logInfo(`Mirror file count: ${result.mirrorFileCount}`)
		this.logInfo(`Folder exists: ${result.folderExists}`)
		this.logInfo(`Is first run: ${result.isFirstRun}`)
		this.logInfo(`Previous migration flag: ${result.previousMigrationFlag}`)

		if (result.integrityIssues.length > 0) {
			this.logWarn(`Integrity issues found (${result.integrityIssues.length}):`)
			result.integrityIssues.forEach((issue, index) => {
				this.logWarn(`  ${index + 1}. ${issue}`)
			})
		}

		this.logInfo('=== End Detection Results ===')
	}

	// Logging helper methods for consistent output formatting
	private logInfo(message: string): void {
		this.outputChannel.appendLine(`[ChatsMirrorDetection] ${message}`)
	}

	private logWarn(message: string): void {
		this.outputChannel.appendLine(`[ChatsMirrorDetection] WARNING: ${message}`)
	}

	private logError(message: string): void {
		this.outputChannel.appendLine(`[ChatsMirrorDetection] ERROR: ${message}`)
	}

	private logDebug(message: string): void {
		// Only log debug messages in development
		if (process.env.NODE_ENV === 'development') {
			this.outputChannel.appendLine(`[ChatsMirrorDetection] DEBUG: ${message}`)
		}
	}
}