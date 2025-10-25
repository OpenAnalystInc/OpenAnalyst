import * as vscode from 'vscode'
import * as fs from 'fs/promises'
import * as path from 'path'
import { HistoryItem } from "../../../packages/types/src/history"
import { ChatsMirrorService } from './ChatsMirrorService'

/**
 * Migration status tracking for monitoring and recovery
 * Provides comprehensive state tracking for migration operations
 */
interface MigrationStatus {
	/** Unique identifier for this migration run */
	migrationId: string
	/** Timestamp when migration started */
	startedAt: number
	/** Timestamp when migration completed (null if still running) */
	completedAt: number | null
	/** Total number of chats to migrate */
	totalChats: number
	/** Number of chats successfully migrated */
	migratedChats: number
	/** Number of chats that failed migration */
	failedChats: number
	/** Number of chats skipped (already migrated) */
	skippedChats: number
	/** Current batch being processed */
	currentBatch: number
	/** Total number of batches */
	totalBatches: number
	/** Whether migration completed successfully */
	success: boolean | null
	/** Error message if migration failed */
	errorMessage: string | null
	/** List of chat IDs that failed to migrate */
	failedChatIds: string[]
	/** Resume token for recovery (last successfully processed chat ID) */
	resumeToken: string | null
	/** Migration version for future compatibility */
	version: string
}

/**
 * Progress update information for UI feedback
 * Provides real-time progress information to consumers
 */
interface MigrationProgress {
	/** Current phase of migration */
	phase: 'initializing' | 'processing' | 'completing' | 'completed' | 'failed'
	/** Percentage complete (0-100) */
	percentComplete: number
	/** Current batch being processed */
	currentBatch: number
	/** Total number of batches */
	totalBatches: number
	/** Number of chats processed so far */
	processedChats: number
	/** Total number of chats to process */
	totalChats: number
	/** Estimated time remaining in milliseconds */
	estimatedTimeRemaining: number | null
	/** Current processing rate (chats per minute) */
	processingRate: number
	/** Human-readable status message */
	statusMessage: string
}

/**
 * Batch processing configuration and limits
 * Controls how migration batches are processed
 */
interface BatchConfig {
	/** Number of chats to process per batch */
	batchSize: number
	/** Delay between batches in milliseconds */
	batchDelay: number
	/** Maximum number of retries for failed batches */
	maxRetries: number
	/** Exponential backoff multiplier for retries */
	retryBackoffMultiplier: number
	/** Maximum time to wait for a single batch (milliseconds) */
	batchTimeout: number
}

/**
 * Migration result information
 * Summary of migration operation results
 */
interface MigrationResult {
	/** Whether migration completed successfully */
	success: boolean
	/** Total number of chats processed */
	totalProcessed: number
	/** Number of chats successfully migrated */
	successCount: number
	/** Number of chats that failed */
	failureCount: number
	/** Number of chats skipped */
	skipCount: number
	/** Total time taken in milliseconds */
	duration: number
	/** Error message if migration failed */
	error: string | null
	/** List of failed chat IDs for retry */
	failedChatIds: string[]
}

/**
 * Events emitted during migration for monitoring and progress tracking
 * Provides comprehensive event-driven feedback system
 */
interface MigrationEvents {
	/** Emitted when migration starts */
	'migration-started': (status: MigrationStatus) => void
	/** Emitted when migration progress updates */
	'migration-progress': (progress: MigrationProgress) => void
	/** Emitted when a batch starts processing */
	'batch-started': (batchNumber: number, chatIds: string[]) => void
	/** Emitted when a batch completes */
	'batch-completed': (batchNumber: number, successCount: number, failureCount: number) => void
	/** Emitted when a single chat migration completes */
	'chat-migrated': (chatId: string, success: boolean, error?: string) => void
	/** Emitted when migration completes */
	'migration-completed': (result: MigrationResult) => void
	/** Emitted when migration fails */
	'migration-failed': (error: string, partialResult: Partial<MigrationResult>) => void
}

/**
 * Comprehensive migration service for ChatsMirror with auto-recovery capabilities
 * Handles bulk migration of task history to mirror files with robust error handling,
 * progress tracking, and automatic recovery from failures
 */
export class ChatsMirrorMigration {
	private static readonly MIGRATION_VERSION = '1.0.0'
	private static readonly GLOBALSTATE_KEY = 'chatsMirrorMigrationStatus'
	private static readonly DEFAULT_BATCH_CONFIG: BatchConfig = {
		batchSize: 50,
		batchDelay: 100, // 100ms between batches
		maxRetries: 3,
		retryBackoffMultiplier: 2,
		batchTimeout: 30000 // 30 seconds per batch
	}

	private readonly context: vscode.ExtensionContext
	private readonly outputChannel: vscode.OutputChannel
	private readonly chatsMirrorService: ChatsMirrorService
	private readonly migrationStartedEmitter = new vscode.EventEmitter<MigrationStatus>();
	private readonly migrationProgressEmitter = new vscode.EventEmitter<MigrationProgress>();
	private readonly migrationCompletedEmitter = new vscode.EventEmitter<MigrationResult>();
	private readonly migrationFailedEmitter = new vscode.EventEmitter<{ error: string, partialResult: Partial<MigrationResult> }>();
	private readonly batchConfig: BatchConfig
	
	private currentStatus: MigrationStatus | null = null
	private isRunning: boolean = false
	private cancellationToken: vscode.CancellationTokenSource | null = null
	private processingStartTime: number = 0
	private lastProgressUpdate: number = 0

	constructor(
		context: vscode.ExtensionContext,
		outputChannel: vscode.OutputChannel,
		chatsMirrorService: ChatsMirrorService,
		batchConfig?: Partial<BatchConfig>
	) {
		this.context = context
		this.outputChannel = outputChannel
		this.chatsMirrorService = chatsMirrorService
		this.batchConfig = { ...ChatsMirrorMigration.DEFAULT_BATCH_CONFIG, ...batchConfig }
		
		this.logInfo('ChatsMirrorMigration service initialized')
	}

	/**
	 * Event registration for migration monitoring
	 * Allows consumers to register for migration events
	 */
	public readonly onMigrationStarted = this.migrationStartedEmitter.event;
	public readonly onMigrationProgress = this.migrationProgressEmitter.event;
	public readonly onMigrationCompleted = this.migrationCompletedEmitter.event;
	public readonly onMigrationFailed = this.migrationFailedEmitter.event;

	/**
	 * Start migration process with automatic recovery detection
	 * Checks for existing migration state and offers recovery options
	 */
	public async startMigration(forceRestart: boolean = false): Promise<MigrationResult> {
		try {
			// Check if migration is already running
			if (this.isRunning) {
				throw new Error('Migration is already in progress')
			}

			// Check for existing migration state
			const existingStatus = await this.loadMigrationStatus()
			if (existingStatus && !forceRestart) {
				// Offer recovery if previous migration was incomplete
				if (existingStatus.completedAt === null) {
					this.logInfo(`Found incomplete migration from ${new Date(existingStatus.startedAt).toISOString()}`)
					return await this.resumeMigration(existingStatus)
				}
			}

			// Start fresh migration
			return await this.runMigration()

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to start migration: ${errorMessage}`)
			throw error
		}
	}

	/**
	 * Resume migration from previous incomplete state
	 * Implements automatic recovery from migration failures
	 */
	public async resumeMigration(existingStatus?: MigrationStatus): Promise<MigrationResult> {
		try {
			const status = existingStatus || await this.loadMigrationStatus()
			if (!status) {
				throw new Error('No migration status found for recovery')
			}

			this.logInfo(`Resuming migration ${status.migrationId} from ${status.resumeToken || 'beginning'}`)
			this.currentStatus = status
			this.isRunning = true

			// Load task history and filter to unprocessed items
			const taskHistory = await this.getTaskHistoryFromGlobalState()
			const resumeIndex = status.resumeToken ? 
				taskHistory.findIndex(item => item.id === status.resumeToken) + 1 : 0
			
			const remainingChats = taskHistory.slice(resumeIndex)
			
			if (remainingChats.length === 0) {
				this.logInfo('No remaining chats to migrate, marking as completed')
				return await this.completeMigration(status, [])
			}

			// Resume processing from where we left off
			return await this.processChatBatches(remainingChats, status)

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to resume migration: ${errorMessage}`)
			
			// Update status and emit failure event
			if (this.currentStatus) {
				this.currentStatus.success = false
				this.currentStatus.errorMessage = errorMessage
				await this.saveMigrationStatus(this.currentStatus)
			}
			
			this.migrationFailedEmitter.fire({ 
				error: errorMessage, 
				partialResult: this.buildPartialResult() 
			})
			
			throw error
		} finally {
			this.isRunning = false
		}
	}

	/**
	 * Run complete migration process with batch processing and progress notifications
	 * Implements the main migration logic with VSCode progress integration for large datasets
	 */
	private async runMigration(): Promise<MigrationResult> {
		this.processingStartTime = Date.now()
		this.isRunning = true
		this.cancellationToken = new vscode.CancellationTokenSource()

		try {
			// Initialize migration status
			const migrationId = this.generateMigrationId()
			const taskHistory = await this.getTaskHistoryFromGlobalState()
			
			this.currentStatus = {
				migrationId,
				startedAt: this.processingStartTime,
				completedAt: null,
				totalChats: taskHistory.length,
				migratedChats: 0,
				failedChats: 0,
				skippedChats: 0,
				currentBatch: 0,
				totalBatches: Math.ceil(taskHistory.length / this.batchConfig.batchSize),
				success: null,
				errorMessage: null,
				failedChatIds: [],
				resumeToken: null,
				version: ChatsMirrorMigration.MIGRATION_VERSION
			}

			// Save initial status and emit started event
			await this.saveMigrationStatus(this.currentStatus)
			this.migrationStartedEmitter.fire(this.currentStatus!)
			this.logInfo(`Starting migration of ${taskHistory.length} chats in ${this.currentStatus.totalBatches} batches`)

			// Show progress notification for large datasets (>100 chats)
			if (taskHistory.length > 100) {
				return await this.executeWithProgressNotification(taskHistory, this.currentStatus)
			} else {
				// Process smaller datasets without progress notification
				return await this.processChatBatches(taskHistory, this.currentStatus)
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Migration failed: ${errorMessage}`)
			
			// Update status and emit failure event
			if (this.currentStatus) {
				this.currentStatus.success = false
				this.currentStatus.errorMessage = errorMessage
				this.currentStatus.completedAt = Date.now()
				await this.saveMigrationStatus(this.currentStatus)
			}
			
			this.migrationFailedEmitter.fire({ 
				error: errorMessage, 
				partialResult: this.buildPartialResult() 
			})
			
			throw error
		} finally {
			this.isRunning = false
			if (this.cancellationToken) {
				this.cancellationToken.dispose()
				this.cancellationToken = null
			}
		}
	}

	/**
	 * Execute migration with VSCode progress notification for large datasets
	 * Provides user-friendly progress indication for time-consuming operations
	 */
	private async executeWithProgressNotification(taskHistory: HistoryItem[], status: MigrationStatus): Promise<MigrationResult> {
		return await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Migrating Chat History",
			cancellable: true
		}, async (progress, token) => {
			// Handle user cancellation
			token.onCancellationRequested(() => {
				this.logInfo('Migration cancelled by user')
				if (this.cancellationToken) {
					this.cancellationToken.cancel()
				}
			})

			// Setup progress reporting
			let lastReportedPercent = 0
			const reportProgress = (currentPercent: number, message: string) => {
				const increment = currentPercent - lastReportedPercent
				if (increment > 0) {
					progress.report({ 
						increment, 
						message: `${message} (${currentPercent}% complete)`
					})
					lastReportedPercent = currentPercent
				}
			}

			// Initial progress report
			reportProgress(0, `Starting migration of ${taskHistory.length} chats`)

			try {
				// Process chats with progress reporting
				return await this.processChatBatchesWithProgress(taskHistory, status, reportProgress)
			} catch (error) {
				// Show error notification to user
				const errorMessage = error instanceof Error ? error.message : String(error)
				vscode.window.showErrorMessage(`Chat migration failed: ${errorMessage}`)
				throw error
			}
		})
	}

	/**
	 * Process chats in batches with progress reporting for UI integration
	 * Enhanced version with VSCode progress reporting and improved error handling
	 */
	private async processChatBatchesWithProgress(chats: HistoryItem[], status: MigrationStatus, reportProgress: (percent: number, message: string) => void): Promise<MigrationResult> {
		const batches = this.createBatches(chats)
		
		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			// Check for cancellation
			if (this.cancellationToken?.token.isCancellationRequested) {
				throw new Error('Migration was cancelled by user')
			}

			const batch = batches[batchIndex]
			const batchNumber = status.currentBatch + batchIndex + 1
			
			// Update progress before processing batch
			const overallProgress = Math.round((batchIndex / batches.length) * 100)
			reportProgress(overallProgress, `Processing batch ${batchNumber}/${status.totalBatches}`)
			
			try {
				// Process batch with enhanced error handling
				const result = await this.processBatchWithEnhancedErrorHandling(batch, batchNumber)
				
				// Update status with batch results
				status.currentBatch = batchNumber
				status.migratedChats += result.successCount
				status.failedChats += result.failureCount
				status.skippedChats += result.skipCount
				status.failedChatIds.push(...result.failedChatIds)
				
				// Set resume token to last processed chat
				if (batch.length > 0) {
					status.resumeToken = batch[batch.length - 1].id
				}
				
				// Save progress and emit events
				await this.saveMigrationStatus(status)
				this.emitProgressUpdate(status)
				
				// Update progress after batch completion
				const completedProgress = Math.round(((batchIndex + 1) / batches.length) * 100)
				reportProgress(completedProgress, `Completed batch ${batchNumber}/${status.totalBatches}`)
				
				// Add delay between batches to prevent overwhelming the system
				if (batchIndex < batches.length - 1 && this.batchConfig.batchDelay > 0) {
					await this.delay(this.batchConfig.batchDelay)
				}
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.logError(`Batch ${batchNumber} failed: ${errorMessage}`)
				
				// Handle batch failure gracefully - continue with partial migration
				const failedResult = this.handleBatchFailure(batch, batchNumber, errorMessage, status)
				
				// Update status with failed batch information
				status.failedChats += failedResult.failureCount
				status.failedChatIds.push(...failedResult.failedChatIds)
				
				// Continue with next batch rather than failing entire migration
				this.logWarn(`Continuing migration despite batch ${batchNumber} failure - partial migration will be completed`)
			}
		}

		// Final progress report
		reportProgress(100, 'Migration completed')

		// Complete migration
		return await this.completeMigration(status, [])
	}

	/**
	 * Process chats in batches with progress tracking and error handling (original method)
	 * Implements the core batch processing logic with retry capabilities for smaller datasets
	 */
	private async processChatBatches(chats: HistoryItem[], status: MigrationStatus): Promise<MigrationResult> {
		const batches = this.createBatches(chats)
		
		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			// Check for cancellation
			if (this.cancellationToken?.token.isCancellationRequested) {
				throw new Error('Migration was cancelled')
			}

			const batch = batches[batchIndex]
			const batchNumber = status.currentBatch + batchIndex + 1
			
			try {
				// Process batch with retry logic
				const result = await this.processBatchWithRetry(batch, batchNumber)
				
				// Update status with batch results
				status.currentBatch = batchNumber
				status.migratedChats += result.successCount
				status.failedChats += result.failureCount
				status.skippedChats += result.skipCount
				status.failedChatIds.push(...result.failedChatIds)
				
				// Set resume token to last processed chat
				if (batch.length > 0) {
					status.resumeToken = batch[batch.length - 1].id
				}
				
				// Save progress and emit events
				await this.saveMigrationStatus(status)
				this.emitProgressUpdate(status)
				
				// Add delay between batches to prevent overwhelming the system
				if (batchIndex < batches.length - 1 && this.batchConfig.batchDelay > 0) {
					await this.delay(this.batchConfig.batchDelay)
				}
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.logError(`Batch ${batchNumber} failed: ${errorMessage}`)
				
				// Record failed batch
				status.failedChats += batch.length
				status.failedChatIds.push(...batch.map(chat => chat.id))
				
				// Continue with next batch rather than failing entire migration
				this.logWarn(`Continuing migration despite batch failure`)
			}
		}

		// Complete migration
		return await this.completeMigration(status, [])
	}

	/**
	 * Process a single batch with enhanced error handling and individual chat recovery
	 * Improved version that handles individual chat failures more gracefully
	 */
	private async processBatchWithEnhancedErrorHandling(batch: HistoryItem[], batchNumber: number): Promise<MigrationResult> {
		let lastError: Error | null = null
		
		for (let attempt = 1; attempt <= this.batchConfig.maxRetries; attempt++) {
			try {
				// Create timeout promise for batch processing
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Batch processing timeout')), this.batchConfig.batchTimeout)
				})
				
				// Process batch with individual chat error handling
				const processingPromise = this.processBatchWithIndividualErrorHandling(batch, batchNumber)
				const result = await Promise.race([processingPromise, timeoutPromise])
				
				this.logInfo(`Batch ${batchNumber} completed successfully on attempt ${attempt}`)
				return result
				
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				this.logWarn(`Batch ${batchNumber} attempt ${attempt} failed: ${lastError.message}`)
				
				// Apply exponential backoff before retry
				if (attempt < this.batchConfig.maxRetries) {
					const delay = Math.pow(this.batchConfig.retryBackoffMultiplier, attempt - 1) * 1000
					this.logInfo(`Retrying batch ${batchNumber} in ${delay}ms...`)
					await this.delay(delay)
				}
			}
		}
		
		// All retries failed - return partial results instead of throwing
		const errorMessage = `Batch ${batchNumber} failed after ${this.batchConfig.maxRetries} attempts: ${lastError?.message}`
		this.logError(errorMessage)
		
		// Return failed result for this batch to continue with partial migration
		return this.handleBatchFailure(batch, batchNumber, errorMessage, null)
	}

	/**
	 * Handle batch failure gracefully by creating a failed result
	 * Allows partial migration to continue despite individual batch failures
	 */
	private handleBatchFailure(batch: HistoryItem[], batchNumber: number, errorMessage: string, status: MigrationStatus | null): MigrationResult {
		this.logError(`Handling failure for batch ${batchNumber}: ${errorMessage}`)
		
		// Create failed result for this batch
		const failedChatIds = batch.map(chat => chat.id)
		
		return {
			success: false,
			totalProcessed: batch.length,
			successCount: 0,
			failureCount: batch.length,
			skipCount: 0,
			duration: 0,
			error: errorMessage,
			failedChatIds
		}
	}

	/**
	 * Process a single batch with retry logic and timeout handling (original method)
	 * Implements robust error handling for individual batch processing
	 */
	private async processBatchWithRetry(batch: HistoryItem[], batchNumber: number): Promise<MigrationResult> {
		let lastError: Error | null = null
		
		for (let attempt = 1; attempt <= this.batchConfig.maxRetries; attempt++) {
			try {
				// Create timeout promise for batch processing
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Batch processing timeout')), this.batchConfig.batchTimeout)
				})
				
				// Process batch with timeout
				const processingPromise = this.processBatch(batch, batchNumber)
				const result = await Promise.race([processingPromise, timeoutPromise])
				
				this.logInfo(`Batch ${batchNumber} completed successfully on attempt ${attempt}`)
				return result
				
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				this.logWarn(`Batch ${batchNumber} attempt ${attempt} failed: ${lastError.message}`)
				
				// Apply exponential backoff before retry
				if (attempt < this.batchConfig.maxRetries) {
					const delay = Math.pow(this.batchConfig.retryBackoffMultiplier, attempt - 1) * 1000
					this.logInfo(`Retrying batch ${batchNumber} in ${delay}ms...`)
					await this.delay(delay)
				}
			}
		}
		
		// All retries failed
		const errorMessage = `Batch ${batchNumber} failed after ${this.batchConfig.maxRetries} attempts: ${lastError?.message}`
		this.logError(errorMessage)
		throw new Error(errorMessage)
	}

	/**
	 * Process a single batch with individual chat error isolation
	 * Enhanced version that handles each chat migration failure separately
	 */
	private async processBatchWithIndividualErrorHandling(batch: HistoryItem[], batchNumber: number): Promise<MigrationResult> {
		const startTime = Date.now()
		let successCount = 0
		let failureCount = 0
		let skipCount = 0
		const failedChatIds: string[] = []
		
		this.logInfo(`Processing batch ${batchNumber} with ${batch.length} chats using individual error handling`)
		
		for (const chat of batch) {
			try {
				// Process individual chat with proper error isolation
				const result = await this.processSingleChatWithValidation(chat)
				
				switch (result.status) {
					case 'success':
						successCount++
						this.logDebug(`Successfully migrated chat ${chat.id}`)
						break
					case 'skipped':
						skipCount++
						this.logDebug(`Skipped chat ${chat.id} - ${result.reason}`)
						break
					case 'failed':
						failureCount++
						failedChatIds.push(chat.id)
						this.logWarn(`Failed to migrate chat ${chat.id}: ${result.reason}`)
						break
				}
				
			} catch (error) {
				// Catch any unexpected errors in individual chat processing
				failureCount++
				failedChatIds.push(chat.id)
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.logError(`Unexpected error migrating chat ${chat.id}: ${errorMessage}`)
			}
		}
		
		const duration = Date.now() - startTime
		this.logInfo(`Batch ${batchNumber} completed in ${duration}ms - Success: ${successCount}, Failed: ${failureCount}, Skipped: ${skipCount}`)
		
		return {
			success: failureCount === 0,
			totalProcessed: batch.length,
			successCount,
			failureCount,
			skipCount,
			duration,
			error: failureCount > 0 ? `${failureCount} chats failed to migrate` : null,
			failedChatIds
		}
	}

	/**
	 * Process a single chat with comprehensive validation and error handling
	 * Provides detailed result information for individual chat migration
	 */
	private async processSingleChatWithValidation(chat: HistoryItem): Promise<{ status: 'success' | 'skipped' | 'failed', reason?: string }> {
		try {
			// Validate chat data before processing
			const validationResult = this.validateChatData(chat)
			if (!validationResult.isValid) {
				return { status: 'failed', reason: `Invalid chat data: ${validationResult.errors.join(', ')}` }
			}

			// Check if chat already has a mirror file
			const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
			if (mirrorPath) {
				const fileName = this.sanitizeChatId(chat.id) + '.json'
				const filePath = path.join(mirrorPath, fileName)
				
				try {
					await fs.access(filePath)
					// File exists, skip migration
					return { status: 'skipped', reason: 'mirror file already exists' }
				} catch {
					// File doesn't exist, proceed with migration
				}
			}
			
			// Attempt to migrate chat to mirror with proper formatting validation
			await this.migrateChatWithFormatValidation(chat)
			return { status: 'success' }
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return { status: 'failed', reason: errorMessage }
		}
	}

	/**
	 * Migrate a single chat with format validation to ensure proper mirror file creation
	 * Validates the created mirror file meets all format requirements
	 */
	private async migrateChatWithFormatValidation(chat: HistoryItem): Promise<void> {
		try {
			// Create mirror using the ChatsMirrorService
			await this.chatsMirrorService.writeChat(chat)
			
			// Validate the created mirror file format
			const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
			if (mirrorPath) {
				const fileName = this.sanitizeChatId(chat.id) + '.json'
				const filePath = path.join(mirrorPath, fileName)
				
				// Verify the file was created and has proper format
				await this.validateCreatedMirrorFile(filePath, chat.id)
			}
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to migrate chat ${chat.id} with format validation: ${errorMessage}`)
			throw error
		}
	}

	/**
	 * Validate chat data before migration to ensure it meets requirements
	 * Performs comprehensive validation of required fields and data types
	 */
	private validateChatData(chat: HistoryItem): { isValid: boolean, errors: string[] } {
		const errors: string[] = []
		
		// Check required fields
		if (!chat.id || typeof chat.id !== 'string' || chat.id.trim() === '') {
			errors.push('Missing or invalid chat ID')
		}
		
		if (!chat.task || typeof chat.task !== 'string' || chat.task.trim() === '') {
			errors.push('Missing or invalid task field')
		}
		
		if (typeof chat.ts !== 'number' || chat.ts <= 0) {
			errors.push('Missing or invalid timestamp')
		}
		
		// Validate optional fields if present
		if (chat.workspace !== undefined && typeof chat.workspace !== 'string') {
			errors.push('Invalid workspace field type')
		}
		
		if (chat.mode !== undefined && typeof chat.mode !== 'string') {
			errors.push('Invalid mode field type')
		}
		
		return {
			isValid: errors.length === 0,
			errors
		}
	}

	/**
	 * Validate a created mirror file to ensure it has the proper format
	 * Verifies the mirror file structure and content after creation
	 */
	private async validateCreatedMirrorFile(filePath: string, expectedChatId: string): Promise<void> {
		try {
			// Read and parse the created file
			const content = await fs.readFile(filePath, 'utf8')
			const data = JSON.parse(content)
			
			// Validate required mirror format fields
			const requiredFields = ['id', 'title', 'ts', 'lastUpdated']
			for (const field of requiredFields) {
				if (!(field in data)) {
					throw new Error(`Missing required field '${field}' in mirror file`)
				}
			}
			
			// Validate the ID matches expected
			if (data.id !== expectedChatId) {
				throw new Error(`Mirror file ID '${data.id}' does not match expected ID '${expectedChatId}'`)
			}
			
			// Validate field types
			if (typeof data.id !== 'string' || typeof data.title !== 'string') {
				throw new Error('Invalid string field types in mirror file')
			}
			
			if (typeof data.ts !== 'number' || typeof data.lastUpdated !== 'number') {
				throw new Error('Invalid timestamp field types in mirror file')
			}
			
			this.logDebug(`Mirror file validation passed for chat ${expectedChatId}`)
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`Mirror file validation failed: ${errorMessage}`)
		}
	}

	/**
	 * Process a single batch of chats to mirror files (original method)
	 * Handles individual chat migration with detailed error tracking
	 */
	private async processBatch(batch: HistoryItem[], batchNumber: number): Promise<MigrationResult> {
		const startTime = Date.now()
		let successCount = 0
		let failureCount = 0
		let skipCount = 0
		const failedChatIds: string[] = []
		
		this.logInfo(`Processing batch ${batchNumber} with ${batch.length} chats`)
		// Note: Batch-level events could be added here for more granular progress tracking
		
		for (const chat of batch) {
			try {
				// Check if chat already has a mirror file
				const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
				if (mirrorPath) {
					const fileName = this.sanitizeChatId(chat.id) + '.json'
					const filePath = path.join(mirrorPath, fileName)
					
					try {
						await fs.access(filePath)
						// File exists, skip migration
						skipCount++
						this.logDebug(`Skipped chat ${chat.id} - mirror file already exists`)
						continue
					} catch {
						// File doesn't exist, proceed with migration
					}
				}
				
				// Migrate chat to mirror
				await this.chatsMirrorService.writeChat(chat)
				successCount++
				this.logDebug(`Successfully migrated chat ${chat.id}`)
				
				// Chat migration successful - could emit chat-level event here if needed
				
			} catch (error) {
				failureCount++
				failedChatIds.push(chat.id)
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.logError(`Failed to migrate chat ${chat.id}: ${errorMessage}`)
				// Chat migration failed - could emit error event here if needed
			}
		}
		
		const duration = Date.now() - startTime
		this.logInfo(`Batch ${batchNumber} completed in ${duration}ms - Success: ${successCount}, Failed: ${failureCount}, Skipped: ${skipCount}`)
		
		// Batch completed - could emit batch-level completion event here if needed
		
		return {
			success: failureCount === 0,
			totalProcessed: batch.length,
			successCount,
			failureCount,
			skipCount,
			duration,
			error: failureCount > 0 ? `${failureCount} chats failed to migrate` : null,
			failedChatIds
		}
	}

	/**
	 * Complete migration process and update final status
	 * Handles migration completion with comprehensive reporting and cleanup
	 */
	private async completeMigration(status: MigrationStatus, additionalFailures: string[]): Promise<MigrationResult> {
		const endTime = Date.now()
		const duration = endTime - status.startedAt
		
		// Update final status
		status.completedAt = endTime
		status.success = status.failedChats === 0 && additionalFailures.length === 0
		status.failedChatIds.push(...additionalFailures)
		
		// Save final status
		await this.saveMigrationStatus(status)
		
		// Build comprehensive result
		const result: MigrationResult = {
			success: status.success,
			totalProcessed: status.totalChats,
			successCount: status.migratedChats,
			failureCount: status.failedChats,
			skipCount: status.skippedChats,
			duration,
			error: status.success ? null : `Migration completed with ${status.failedChats} failures`,
			failedChatIds: status.failedChatIds
		}
		
		// Log comprehensive completion summary
		this.logMigrationSummary(result, duration)
		
		// Emit completion event for external listeners
		this.migrationCompletedEmitter.fire(result)
		
		// Perform post-migration validation if successful
		if (result.success && result.successCount > 0) {
			await this.performPostMigrationValidation(result)
		}
		
		return result
	}

	/**
	 * Log comprehensive migration summary with detailed statistics
	 * Provides complete overview of migration results for analysis
	 */
	private logMigrationSummary(result: MigrationResult, duration: number): void {
		this.logInfo('=== Migration Summary ===')
		this.logInfo(`Total duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`)
		this.logInfo(`Total processed: ${result.totalProcessed} chats`)
		this.logInfo(`Successfully migrated: ${result.successCount} chats`)
		this.logInfo(`Skipped (already exist): ${result.skipCount} chats`)
		this.logInfo(`Failed migrations: ${result.failureCount} chats`)
		
		if (result.totalProcessed > 0) {
			const successRate = (result.successCount / result.totalProcessed * 100).toFixed(1)
			this.logInfo(`Success rate: ${successRate}%`)
			
			const averageTimePerChat = duration / result.totalProcessed
			this.logInfo(`Average time per chat: ${averageTimePerChat.toFixed(2)}ms`)
		}
		
		// Log failed chat IDs for debugging
		if (result.failedChatIds.length > 0) {
			this.logWarn(`Failed chat IDs: ${result.failedChatIds.slice(0, 10).join(', ')}${result.failedChatIds.length > 10 ? '...' : ''}`)
		}
		
		if (result.success) {
			this.logInfo('✅ Migration completed successfully - all mirror files created with proper formatting')
		} else {
			this.logWarn('⚠️ Migration completed with errors - partial migration available, retry will be attempted on next startup')
		}
		
		this.logInfo('=== End Migration Summary ===')
	}

	/**
	 * Perform post-migration validation to ensure mirror files are properly formatted
	 * Validates a sample of created mirror files to ensure quality
	 */
	private async performPostMigrationValidation(result: MigrationResult): Promise<void> {
		try {
			this.logInfo('Performing post-migration validation of mirror files...')
			
			const mirrorPath = this.chatsMirrorService.getMirrorFolderPath()
			if (!mirrorPath) {
				this.logWarn('Cannot perform post-migration validation - mirror path not available')
				return
			}
			
			// Validate a sample of mirror files (up to 10)
			const sampleSize = Math.min(10, result.successCount)
			if (sampleSize === 0) {
				return
			}
			
			this.logInfo(`Validating ${sampleSize} sample mirror files for format compliance...`)
			
			const files = await fs.readdir(mirrorPath)
			const jsonFiles = files.filter(file => file.endsWith('.json')).slice(0, sampleSize)
			
			let validatedFiles = 0
			let validationErrors = 0
			
			for (const fileName of jsonFiles) {
				try {
					const filePath = path.join(mirrorPath, fileName)
					const chatId = fileName.replace('.json', '')
					await this.validateCreatedMirrorFile(filePath, chatId)
					validatedFiles++
				} catch (error) {
					validationErrors++
					this.logWarn(`Post-migration validation failed for ${fileName}: ${error}`)
				}
			}
			
			const validationRate = (validatedFiles / jsonFiles.length * 100).toFixed(1)
			this.logInfo(`Post-migration validation complete: ${validatedFiles}/${jsonFiles.length} files validated (${validationRate}%)`)
			
			if (validationErrors === 0) {
				this.logInfo('✅ All validated mirror files have proper formatting')
			} else {
				this.logWarn(`⚠️ ${validationErrors} files failed validation - manual review may be required`)
			}
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logWarn(`Post-migration validation failed: ${errorMessage}`)
		}
	}

	/**
	 * Create batches from chat array based on configuration
	 * Divides chats into manageable batches for processing
	 */
	private createBatches(chats: HistoryItem[]): HistoryItem[][] {
		const batches: HistoryItem[][] = []
		
		for (let i = 0; i < chats.length; i += this.batchConfig.batchSize) {
			const batch = chats.slice(i, i + this.batchConfig.batchSize)
			batches.push(batch)
		}
		
		return batches
	}

	/**
	 * Read all existing task history from globalState storage (not SQLite)
	 * NOTE: The requirement mentions SQLite but OpenAnalyst stores task history in VSCode's globalState
	 * This method retrieves the complete task history for migration processing
	 */
	private async getTaskHistoryFromGlobalState(): Promise<HistoryItem[]> {
		try {
			this.logInfo('Reading task history from VSCode globalState (confirmed storage location, not SQLite)')
			
			// Access the globalState directly through the extension context
			const taskHistory = this.context.globalState.get<HistoryItem[]>('taskHistory') || []
			
			this.logInfo(`Successfully loaded ${taskHistory.length} chat entries from globalState for migration`)
			
			// Log summary of task history data for debugging
			if (taskHistory.length > 0) {
				const oldestTask = taskHistory.reduce((oldest, current) => 
					current.ts < oldest.ts ? current : oldest, taskHistory[0])
				const newestTask = taskHistory.reduce((newest, current) => 
					current.ts > newest.ts ? current : newest, taskHistory[0])
				
				this.logInfo(`Task history range: ${new Date(oldestTask.ts).toISOString()} to ${new Date(newestTask.ts).toISOString()}`)
				
				// Log workspace distribution for analysis
				const workspaces = new Set(taskHistory.map(t => t.workspace).filter(Boolean))
				this.logInfo(`Found tasks across ${workspaces.size} workspace(s)`)
			}
			
			return taskHistory
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to read task history from globalState: ${errorMessage}`)
			throw new Error(`Cannot load task history for migration: ${errorMessage}`)
		}
	}

	/**
	 * Save migration status to extension global state
	 * Persists migration state for recovery purposes
	 */
	private async saveMigrationStatus(status: MigrationStatus): Promise<void> {
		try {
			await this.context.globalState.update(ChatsMirrorMigration.GLOBALSTATE_KEY, status)
			this.logDebug(`Saved migration status: ${status.migratedChats}/${status.totalChats} completed`)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`Failed to save migration status: ${errorMessage}`)
			// Don't throw here as this shouldn't stop migration
		}
	}

	/**
	 * Load migration status from extension global state
	 * Retrieves persisted migration state for recovery
	 */
	private async loadMigrationStatus(): Promise<MigrationStatus | null> {
		try {
			const status = this.context.globalState.get<MigrationStatus>(ChatsMirrorMigration.GLOBALSTATE_KEY)
			if (status) {
				this.logDebug(`Loaded migration status: ${status.migrationId} from ${new Date(status.startedAt).toISOString()}`)
			}
			return status || null
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logWarn(`Failed to load migration status: ${errorMessage}`)
			return null
		}
	}

	/**
	 * Clear migration status from global state
	 * Removes persisted migration state (used after successful completion)
	 */
	public async clearMigrationStatus(): Promise<void> {
		try {
			await this.context.globalState.update(ChatsMirrorMigration.GLOBALSTATE_KEY, undefined)
			this.logInfo('Cleared migration status from global state')
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logWarn(`Failed to clear migration status: ${errorMessage}`)
		}
	}

	/**
	 * Check if migration is currently in progress
	 * Provides status information for external consumers
	 */
	public isInProgress(): boolean {
		return this.isRunning
	}

	/**
	 * Get current migration status
	 * Returns current migration state or null if no migration is active
	 */
	public getCurrentStatus(): MigrationStatus | null {
		return this.currentStatus
	}

	/**
	 * Cancel ongoing migration process
	 * Provides graceful cancellation of migration operations
	 */
	public cancelMigration(): void {
		if (this.cancellationToken) {
			this.cancellationToken.cancel()
			this.logInfo('Migration cancellation requested')
		}
	}

	/**
	 * Emit progress update events for UI feedback
	 * Provides real-time progress information with rate limiting
	 */
	private emitProgressUpdate(status: MigrationStatus): void {
		const now = Date.now()
		
		// Rate limit progress updates to avoid overwhelming consumers
		if (now - this.lastProgressUpdate < 500) { // Max 2 updates per second
			return
		}
		
		this.lastProgressUpdate = now
		
		const percentComplete = status.totalChats > 0 ? 
			Math.round((status.migratedChats + status.failedChats + status.skippedChats) / status.totalChats * 100) : 0
		
		const elapsed = now - status.startedAt
		const processedChats = status.migratedChats + status.failedChats + status.skippedChats
		const processingRate = processedChats > 0 ? (processedChats / elapsed) * 60000 : 0 // chats per minute
		
		const remainingChats = status.totalChats - processedChats
		const estimatedTimeRemaining = processingRate > 0 ? (remainingChats / processingRate) * 60000 : null
		
		const progress: MigrationProgress = {
			phase: percentComplete === 100 ? 'completing' : 'processing',
			percentComplete,
			currentBatch: status.currentBatch,
			totalBatches: status.totalBatches,
			processedChats,
			totalChats: status.totalChats,
			estimatedTimeRemaining,
			processingRate,
			statusMessage: this.buildStatusMessage(status, percentComplete)
		}
		
		this.migrationProgressEmitter.fire(progress)
	}

	/**
	 * Build human-readable status message for progress updates
	 * Creates informative status messages for user feedback
	 */
	private buildStatusMessage(status: MigrationStatus, percentComplete: number): string {
		const processedChats = status.migratedChats + status.failedChats + status.skippedChats
		
		if (percentComplete === 100) {
			return `Migration completed - ${status.migratedChats} migrated, ${status.failedChats} failed, ${status.skippedChats} skipped`
		}
		
		return `Processing batch ${status.currentBatch}/${status.totalBatches} - ${processedChats}/${status.totalChats} chats (${percentComplete}%)`
	}

	/**
	 * Build partial result for error reporting
	 * Creates partial result information when migration fails
	 */
	private buildPartialResult(): Partial<MigrationResult> {
		if (!this.currentStatus) {
			return {}
		}
		
		const elapsed = Date.now() - this.currentStatus.startedAt
		
		return {
			totalProcessed: this.currentStatus.migratedChats + this.currentStatus.failedChats + this.currentStatus.skippedChats,
			successCount: this.currentStatus.migratedChats,
			failureCount: this.currentStatus.failedChats,
			skipCount: this.currentStatus.skippedChats,
			duration: elapsed,
			failedChatIds: this.currentStatus.failedChatIds
		}
	}

	/**
	 * Generate unique migration identifier
	 * Creates unique ID for tracking migration instances
	 */
	private generateMigrationId(): string {
		const timestamp = Date.now()
		const random = Math.random().toString(36).substring(2, 8)
		return `migration-${timestamp}-${random}`
	}

	/**
	 * Sanitize chat ID for filename safety
	 * Provides basic filename sanitization to match ChatsMirrorService behavior
	 */
	private sanitizeChatId(chatId: string): string {
		if (!chatId || typeof chatId !== 'string') {
			return 'invalid-chat-id'
		}

		const trimmed = chatId.trim()
		if (trimmed === '') {
			return 'empty-chat-id'
		}

		// Basic sanitization for filename safety
		let sanitized = trimmed
			// Replace filesystem-invalid characters with hyphens
			.replace(/[<>:"|?*\\\/]/g, '-')
			// Replace whitespace with hyphens
			.replace(/\s+/g, '-')
			// Remove control characters
			.replace(/[\x00-\x1F\x7F]/g, '')

		// Clean up multiple consecutive hyphens
		sanitized = sanitized.replace(/-+/g, '-')

		// Remove leading/trailing hyphens
		sanitized = sanitized.replace(/^-+|-+$/g, '')

		// Ensure we have a valid result
		if (!sanitized || sanitized === '') {
			sanitized = `chat-${Date.now()}`
		}

		// Limit length for filesystem compatibility
		if (sanitized.length > 100) {
			sanitized = sanitized.substring(0, 100).replace(/-$/, '')
		}

		return sanitized
	}

	/**
	 * Utility method for creating delays
	 * Provides cancellable delay functionality
	 */
	private async delay(ms: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(resolve, ms)
			
			// Check for cancellation
			const checkCancellation = () => {
				if (this.cancellationToken?.token.isCancellationRequested) {
					clearTimeout(timeout)
					reject(new Error('Operation was cancelled'))
				}
			}
			
			// Check immediately and then periodically
			checkCancellation()
			const interval = setInterval(() => {
				checkCancellation()
			}, 100)
			
			setTimeout(() => {
				clearInterval(interval)
			}, ms)
		})
	}

	/**
	 * Dispose of the migration service and clean up resources
	 * Ensures proper cleanup of event emitters and cancellation tokens
	 */
	public dispose(): void {
		if (this.cancellationToken) {
			this.cancellationToken.dispose()
			this.cancellationToken = null
		}
		
		this.migrationStartedEmitter.dispose();
		this.migrationProgressEmitter.dispose();
		this.migrationCompletedEmitter.dispose();
		this.migrationFailedEmitter.dispose();
		this.isRunning = false
		this.logInfo('ChatsMirrorMigration service disposed')
	}

	// Logging helper methods for consistent output formatting
	private logInfo(message: string): void {
		this.outputChannel.appendLine(`[ChatsMirrorMigration] ${message}`)
	}

	private logWarn(message: string): void {
		this.outputChannel.appendLine(`[ChatsMirrorMigration] WARNING: ${message}`)
	}

	private logError(message: string): void {
		this.outputChannel.appendLine(`[ChatsMirrorMigration] ERROR: ${message}`)
	}

	private logDebug(message: string): void {
		// Only log debug messages in development
		if (process.env.NODE_ENV === 'development') {
			this.outputChannel.appendLine(`[ChatsMirrorMigration] DEBUG: ${message}`)
		}
	}
}