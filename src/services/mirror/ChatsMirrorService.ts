import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { HistoryItem } from "../../../packages/types/src/history"

/**
 * Configuration keys for the chat mirror system
 */
const CONFIG_KEYS = {
	CHATS_FOLDER: 'openAnalyst.chatsFolder',
	MIRROR_ENABLED: 'openAnalyst.enableChatsMirror',
	DEBOUNCE_DELAY: 'openAnalyst.chatsMirrorDebounce'
} as const

/**
 * Default configuration values
 */
const DEFAULTS = {
	FOLDER_NAME: 'OpenAnalystChats',
	DEBOUNCE_MS: 100,
	MIRROR_ENABLED: true,
	MAX_RETRIES: 3,
	BATCH_SIZE: 10
} as const

/**
 * Mirror file format version for future compatibility
 */
const MIRROR_VERSION = 1

/**
 * Simplified chat data structure stored in mirror files
 * Contains only essential metadata for fast UI loading
 */
interface ChatMirrorItem {
	version: number
	id: string
	title: string
	ts: number
	lastUpdated: number
	workspace?: string
	mode?: string
	isFavorited?: boolean
	fileNotFound?: boolean
}

/**
 * Write operation queued for debouncing
 * Data can be null to indicate a delete operation
 */
interface QueuedWriteOperation {
	chatId: string
	data: ChatMirrorItem | null
	timestamp: number
	retryCount: number
}

/**
 * Service initialization status
 */
const enum InitializationStatus {
	NOT_STARTED = 'NOT_STARTED',
	IN_PROGRESS = 'IN_PROGRESS', 
	COMPLETED = 'COMPLETED',
	FAILED = 'FAILED'
}

/**
 * Core service for managing chat mirror files in the local file system
 * Provides a singleton instance that handles all mirror operations with proper debouncing
 * and error handling to ensure data consistency between extension and editor
 */
export class ChatsMirrorService {
	private static instance: ChatsMirrorService | null = null
	private static initializationPromise: Promise<ChatsMirrorService> | null = null

	private readonly context: vscode.ExtensionContext
	private initializationStatus: InitializationStatus = InitializationStatus.NOT_STARTED
	
	// Service state management
	private isEnabled: boolean = DEFAULTS.MIRROR_ENABLED
	private mirrorFolderPath: string | null = null
	private debounceDelay: number = DEFAULTS.DEBOUNCE_MS
	
	// Folder existence caching to reduce file system checks
	private folderExistsCache: boolean = false
	private lastFolderCheckTime: number = 0
	private readonly folderCheckCacheMs = 5000 // Cache folder existence for 5 seconds
	
	// Write queue management for debouncing rapid operations
	private writeQueue: Map<string, QueuedWriteOperation> = new Map()
	private writeTimer: NodeJS.Timeout | null = null
	private readonly maxQueueSize = 1000 // Prevent memory issues with large queues
	
	// Configuration change listener
	private configChangeListener: vscode.Disposable | null = null

	/**
	 * Private constructor to enforce singleton pattern
	 * Use getInstance() to obtain the service instance
	 */
	private constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	/**
	 * Get the singleton instance of ChatsMirrorService
	 * Creates and initializes the instance if it doesn't exist
	 * Thread-safe implementation with promise-based initialization
	 */
	public static async getInstance(context: vscode.ExtensionContext): Promise<ChatsMirrorService> {
		// Return existing instance if available
		if (this.instance && this.instance.initializationStatus === InitializationStatus.COMPLETED) {
			return this.instance
		}

		// Wait for ongoing initialization if in progress
		if (this.initializationPromise) {
			return this.initializationPromise
		}

		// Start new initialization
		this.initializationPromise = this.createAndInitializeInstance(context)
		return this.initializationPromise
	}

	/**
	 * Create and initialize a new service instance
	 * Handles initialization errors and cleanup
	 */
	private static async createAndInitializeInstance(context: vscode.ExtensionContext): Promise<ChatsMirrorService> {
		try {
			// Create instance if it doesn't exist
			if (!this.instance) {
				this.instance = new ChatsMirrorService(context)
			}

			// Initialize the instance
			await this.instance.initialize()
			return this.instance

		} catch (error) {
			// Clean up on initialization failure
			if (this.instance) {
				this.instance.initializationStatus = InitializationStatus.FAILED
			}
			
			console.error('ChatsMirrorService: Initialization failed', error)
			throw error

		} finally {
			// Clear initialization promise
			this.initializationPromise = null
		}
	}

	/**
	 * Initialize the service by loading configuration and setting up file system paths
	 * Sets up configuration listeners for dynamic updates
	 */
	private async initialize(): Promise<void> {
		if (this.initializationStatus === InitializationStatus.COMPLETED) {
			return
		}

		this.initializationStatus = InitializationStatus.IN_PROGRESS

		try {
			// Load initial configuration
			await this.loadConfiguration()
			
			// Resolve mirror folder path
			await this.resolveMirrorPath()
			
			// Setup configuration change listener
			this.setupConfigurationListener()
			
			this.initializationStatus = InitializationStatus.COMPLETED
			console.log('ChatsMirrorService: Initialization completed successfully')

		} catch (error) {
			this.initializationStatus = InitializationStatus.FAILED
			console.error('ChatsMirrorService: Initialization failed', error)
			throw error
		}
	}

	/**
	 * Load configuration values from VSCode settings
	 * Updates internal state with current user preferences
	 */
	private async loadConfiguration(): Promise<void> {
		const config = vscode.workspace.getConfiguration()
		
		// Load mirror enabled state
		this.isEnabled = config.get<boolean>(CONFIG_KEYS.MIRROR_ENABLED) ?? DEFAULTS.MIRROR_ENABLED
		
		// Load debounce delay with validation
		const configuredDelay = config.get<number>(CONFIG_KEYS.DEBOUNCE_DELAY) ?? DEFAULTS.DEBOUNCE_MS
		this.debounceDelay = Math.max(0, Math.min(5000, configuredDelay)) // Clamp to 0-5000ms
		
		console.log(`ChatsMirrorService: Configuration loaded - enabled: ${this.isEnabled}, debounce: ${this.debounceDelay}ms`)
	}

	/**
	 * Resolve the mirror folder path based on user configuration or default
	 * Creates the folder if it doesn't exist and mirror is enabled
	 */
	private async resolveMirrorPath(): Promise<void> {
		const config = vscode.workspace.getConfiguration()
		const configuredPath = config.get<string>(CONFIG_KEYS.CHATS_FOLDER)

		if (configuredPath && configuredPath.trim() !== '') {
			// Use configured custom path
			this.mirrorFolderPath = path.resolve(configuredPath.trim())
		} else {
			// Use default path in user's home directory
			const homeDir = require('os').homedir()
			this.mirrorFolderPath = path.join(homeDir, DEFAULTS.FOLDER_NAME)
		}

		// Create folder if mirror is enabled
		if (this.isEnabled) {
			await this.ensureMirrorFolder()
		}

		console.log(`ChatsMirrorService: Mirror path resolved to: ${this.mirrorFolderPath}`)
	}

	/**
	 * Ensure the mirror folder exists, creating it if necessary with caching
	 * Uses cached result to reduce file system operations and improves performance
	 * Returns true if folder exists or was created successfully
	 */
	private async ensureMirrorFolder(): Promise<boolean> {
		if (!this.mirrorFolderPath) {
			console.error('ChatsMirrorService: Mirror path not resolved')
			return false
		}

		// Use cached result if still valid
		const now = Date.now()
		if (this.folderExistsCache && (now - this.lastFolderCheckTime) < this.folderCheckCacheMs) {
			return true
		}

		try {
			// Check if folder exists with proper permissions
			await fs.access(this.mirrorFolderPath, fs.constants.F_OK | fs.constants.W_OK)
			
			// Update cache on successful check
			this.folderExistsCache = true
			this.lastFolderCheckTime = now
			
			return true

		} catch (error) {
			// Reset cache on access failure
			this.folderExistsCache = false
			
			// Folder doesn't exist or lacks permissions, try to create it
			try {
				await fs.mkdir(this.mirrorFolderPath, { 
					recursive: true,
					mode: 0o755 // rwxr-xr-x permissions
				})
				
				// Verify creation with write permissions
				await fs.access(this.mirrorFolderPath, fs.constants.F_OK | fs.constants.W_OK)
				
				// Update cache on successful creation
				this.folderExistsCache = true
				this.lastFolderCheckTime = now
				
				console.log(`ChatsMirrorService: Created mirror folder at ${this.mirrorFolderPath}`)
				return true

			} catch (createError) {
				this.folderExistsCache = false
				console.error(`ChatsMirrorService: Failed to create mirror folder at ${this.mirrorFolderPath}:`, createError)
				
				// Provide detailed error information for common issues
				if (createError instanceof Error) {
					if (createError.message.includes('EACCES') || createError.message.includes('EPERM')) {
						console.error('ChatsMirrorService: Permission denied. Check folder permissions and user access rights.')
					} else if (createError.message.includes('ENOSPC')) {
						console.error('ChatsMirrorService: Insufficient disk space to create mirror folder.')
					} else if (createError.message.includes('ENOTDIR')) {
						console.error('ChatsMirrorService: Parent path is not a directory.')
					}
				}
				
				return false
			}
		}
	}

	/**
	 * Setup listener for configuration changes to update service settings dynamically
	 * Allows real-time configuration updates without service restart
	 */
	private setupConfigurationListener(): void {
		this.configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration(CONFIG_KEYS.MIRROR_ENABLED) ||
				event.affectsConfiguration(CONFIG_KEYS.DEBOUNCE_DELAY) ||
				event.affectsConfiguration(CONFIG_KEYS.CHATS_FOLDER)) {
				
				console.log('ChatsMirrorService: Configuration changed, reloading...')
				
				// Reload configuration
				await this.loadConfiguration()
				
				// Update mirror path if folder configuration changed
				if (event.affectsConfiguration(CONFIG_KEYS.CHATS_FOLDER)) {
					// Invalidate folder cache when path changes
					this.invalidateFolderCache()
					await this.resolveMirrorPath()
				}
			}
		})
	}

	/**
	 * Write a new chat to the mirror system
	 * Creates a new mirror file for the chat with complete data
	 */
	public async writeChat(historyItem: HistoryItem): Promise<void> {
		if (!this.isEnabled || !this.isInitialized()) {
			throw new Error('Mirror service is not enabled or initialized')
		}

		if (!historyItem || !historyItem.id) {
			throw new Error('Invalid history item provided')
		}

		// Skip saving during placeholder phase (api_req_started)
		if (this.isPlaceholderTask(historyItem)) {
			console.log(`ChatsMirrorService: Skipping write for placeholder chat ${historyItem.id}`)
			return
		}

		console.log(`ChatsMirrorService: Writing new chat ${historyItem.id}`)

		// Transform history item to mirror format with validation
		const mirrorItem = this.transformToMirrorFormat(historyItem)
		
		// Write directly to file system
		await this.writeMirrorFile(mirrorItem)
	}

	/**
	 * Update an existing chat in the mirror system
	 * Merges new data with existing mirror data and updates lastUpdated timestamp
	 */
	public async updateChat(historyItem: HistoryItem): Promise<void> {
		if (!this.isEnabled || !this.isInitialized()) {
			throw new Error('Mirror service is not enabled or initialized')
		}

		if (!historyItem || !historyItem.id) {
			throw new Error('Invalid history item provided')
		}

		// Skip updating during placeholder phase (api_req_started)
		if (this.isPlaceholderTask(historyItem)) {
			console.log(`ChatsMirrorService: Skipping update for placeholder chat ${historyItem.id}`)
			return
		}

		console.log(`ChatsMirrorService: Updating chat ${historyItem.id}`)

		try {
			// Try to read existing mirror data first
			const existingMirrorItem = await this.readMirrorFile(historyItem.id)
			
			// Transform new history item data with validation
			const newMirrorItem = this.transformToMirrorFormat(historyItem, true)
			
			// Merge with existing data, preserving creation timestamp and original title
			const updatedMirrorItem: ChatMirrorItem = {
				...existingMirrorItem,
				...newMirrorItem,
				ts: existingMirrorItem.ts, // Preserve original creation time
				title: existingMirrorItem.title, // Keep original title to prevent changes
				lastUpdated: Date.now() // Update modification time
			}

			// Write updated data to file system
			await this.writeMirrorFile(updatedMirrorItem)

		} catch (readError) {
			// If file doesn't exist, treat as new chat creation
			console.log(`ChatsMirrorService: Mirror file for chat ${historyItem.id} not found, creating new`)
			await this.writeChat(historyItem)
		}
	}

	/**
	 * Delete a chat from the mirror system
	 * Removes the corresponding mirror file from the file system
	 */
	public async deleteChat(chatId: string): Promise<void> {
		if (!this.isEnabled || !this.isInitialized()) {
			throw new Error('Mirror service is not enabled or initialized')
		}

		if (!chatId || chatId.trim() === '') {
			throw new Error('Invalid chat ID provided')
		}

		console.log(`ChatsMirrorService: Deleting chat ${chatId}`)

		if (!this.mirrorFolderPath) {
			throw new Error('Mirror folder path not resolved')
		}

		// Generate filename and path
		const fileName = this.sanitizeChatId(chatId) + '.json'
		const filePath = path.join(this.mirrorFolderPath, fileName)

		try {
			// Check if file exists before attempting deletion
			await fs.access(filePath, fs.constants.F_OK)
			
			// Delete the mirror file
			await fs.unlink(filePath)
			
			console.log(`ChatsMirrorService: Successfully deleted mirror file for chat ${chatId}`)

		} catch (error) {
			if (error instanceof Error && error.message.includes('ENOENT')) {
				// File doesn't exist, which is fine for delete operation
				console.log(`ChatsMirrorService: Mirror file for chat ${chatId} already deleted or doesn't exist`)
			} else {
				console.error(`ChatsMirrorService: Failed to delete mirror file for chat ${chatId}:`, error)
				throw error
			}
		}
	}

	/**
	 * Add a chat to the write queue for debounced processing
	 * Prevents excessive file system operations during rapid updates
	 */
	public queueChatWrite(historyItem: HistoryItem): void {
		if (!this.isEnabled || !this.isInitialized()) {
			return
		}

		// Skip queuing during placeholder phase (api_req_started)
		if (this.isPlaceholderTask(historyItem)) {
			console.log(`ChatsMirrorService: Skipping queue write for placeholder chat ${historyItem.id}`)
			return
		}

		// Check queue size limit to prevent memory issues
		if (this.writeQueue.size >= this.maxQueueSize) {
			console.warn(`ChatsMirrorService: Write queue full (${this.maxQueueSize} items), skipping write for chat ${historyItem.id}`)
			return
		}

		// Transform history item to mirror format with validation
		const mirrorItem = this.transformToMirrorFormat(historyItem)
		
		// Add to queue (overwrites existing entry for the same chat)
		this.writeQueue.set(historyItem.id, {
			chatId: historyItem.id,
			data: mirrorItem,
			timestamp: Date.now(),
			retryCount: 0
		})

		// Schedule debounced write
		this.scheduleQueuedWrites()
	}

	/**
	 * Schedule processing of queued write operations with debouncing
	 * Coalesces rapid updates to the same chat into a single write operation
	 */
	private scheduleQueuedWrites(): void {
		// Clear existing timer if present
		if (this.writeTimer) {
			clearTimeout(this.writeTimer)
		}

		// Schedule new timer
		this.writeTimer = setTimeout(() => {
			this.processWriteQueue()
		}, this.debounceDelay)
	}

	/**
	 * Process all queued write operations in batches
	 * Handles errors gracefully and implements retry logic for failed writes
	 */
	private async processWriteQueue(): Promise<void> {
		if (this.writeQueue.size === 0) {
			return
		}

		// Extract operations to process
		const operations = Array.from(this.writeQueue.values())
		this.writeQueue.clear()

		console.log(`ChatsMirrorService: Processing ${operations.length} queued write operations`)

		// Process in batches to avoid overwhelming the file system
		for (let i = 0; i < operations.length; i += DEFAULTS.BATCH_SIZE) {
			const batch = operations.slice(i, i + DEFAULTS.BATCH_SIZE)
			await this.processBatch(batch)
		}
	}

	/**
	 * Process a batch of write operations with parallel execution
	 * Implements retry logic for failed operations
	 */
	private async processBatch(operations: QueuedWriteOperation[]): Promise<void> {
		const writePromises = operations.map(operation => this.writeFileWithRetry(operation))
		
		try {
			await Promise.allSettled(writePromises)
		} catch (error) {
			console.error('ChatsMirrorService: Batch processing failed', error)
		}
	}

	/**
	 * Process a single queued operation with retry logic for transient failures
	 * Handles both write and delete operations with appropriate error handling
	 */
	private async writeFileWithRetry(operation: QueuedWriteOperation): Promise<void> {
		try {
			// Check if this is a delete operation (data is null)
			if (operation.data === null) {
				await this.deleteChat(operation.chatId)
			} else {
				await this.writeMirrorFile(operation.data)
			}
		} catch (error) {
			// Retry logic for transient errors
			if (operation.retryCount < DEFAULTS.MAX_RETRIES) {
				operation.retryCount++
				const operationType = operation.data === null ? 'delete' : 'write'
				console.warn(`ChatsMirrorService: ${operationType} failed for chat ${operation.chatId}, retrying (${operation.retryCount}/${DEFAULTS.MAX_RETRIES})`)
				
				// Re-queue with exponential backoff
				setTimeout(() => {
					this.writeQueue.set(operation.chatId, operation)
					this.scheduleQueuedWrites()
				}, Math.pow(2, operation.retryCount) * 1000) // 2s, 4s, 8s delays
			} else {
				const operationType = operation.data === null ? 'delete' : 'write'
				console.error(`ChatsMirrorService: Failed to ${operationType} chat ${operation.chatId} after ${DEFAULTS.MAX_RETRIES} retries:`, error)
			}
		}
	}

	/**
	 * Read mirror data from a JSON file in the mirror folder
	 * Returns the parsed ChatMirrorItem with validation
	 */
	private async readMirrorFile(chatId: string): Promise<ChatMirrorItem> {
		if (!this.mirrorFolderPath) {
			throw new Error('Mirror folder path not resolved')
		}

		if (!chatId || chatId.trim() === '') {
			throw new Error('Invalid chat ID provided')
		}

		// Generate filename and path
		const fileName = this.sanitizeChatId(chatId) + '.json'
		const filePath = path.join(this.mirrorFolderPath, fileName)

		try {
			// Read the file content
			const fileContent = await fs.readFile(filePath, 'utf8')
			
			// Parse JSON with error handling
			let mirrorItem: any
			try {
				mirrorItem = JSON.parse(fileContent)
			} catch (parseError) {
				throw new Error(`Invalid JSON format in mirror file for chat ${chatId}`)
			}

			// Validate the structure
			if (!this.isValidMirrorItem(mirrorItem)) {
				throw new Error(`Invalid mirror data structure for chat ${chatId}`)
			}

			return mirrorItem as ChatMirrorItem

		} catch (error) {
			if (error instanceof Error && error.message.includes('ENOENT')) {
				throw new Error(`Mirror file not found for chat ${chatId}`)
			}
			throw error
		}
	}

	/**
	 * Write mirror data to a JSON file in the mirror folder
	 * Creates the file with proper error handling and atomic operations
	 */
	private async writeMirrorFile(mirrorItem: ChatMirrorItem): Promise<void> {
		if (!this.mirrorFolderPath) {
			throw new Error('Mirror folder path not resolved')
		}

		if (!mirrorItem) {
			throw new Error('Mirror item is required for write operation')
		}

		// Comprehensive data validation before writing
		const validationResult = this.validateDataBeforeWrite(mirrorItem)
		if (!validationResult.isValid) {
			throw new Error(`Mirror item validation failed: ${validationResult.errors.join(', ')}`)
		}

		// Ensure folder exists before writing
		const folderExists = await this.ensureMirrorFolder()
		if (!folderExists) {
			// Invalidate cache on failure to ensure fresh check next time
			this.invalidateFolderCache()
			throw new Error('Mirror folder is not accessible')
		}

		// Generate safe filename
		const fileName = this.sanitizeChatId(mirrorItem.id) + '.json'
		const filePath = path.join(this.mirrorFolderPath, fileName)

		// Write file atomically using a temporary file
		const tempFilePath = filePath + '.tmp'
		
		try {
			// Serialize with consistent formatting and error handling
			const jsonContent = this.serializeMirrorItem(mirrorItem)
			await fs.writeFile(tempFilePath, jsonContent, 'utf8')
			await fs.rename(tempFilePath, filePath)
			
		} catch (error) {
			// Clean up temporary file on error
			try {
				await fs.unlink(tempFilePath)
			} catch (unlinkError) {
				// Ignore cleanup errors
			}
			throw error
		}
	}

	/**
	 * Transform a HistoryItem to optimized mirror format with comprehensive validation
	 * Extracts only required fields and handles missing or invalid data gracefully
	 * This is the primary transformation method for creating mirror data from extension data
	 */
	public transformToMirrorFormat(historyItem: HistoryItem, preserveTimestamp?: boolean): ChatMirrorItem {
		// Validate input data first
		const validationResult = this.validateHistoryItem(historyItem)
		if (!validationResult.isValid) {
			throw new Error(`Invalid history item data: ${validationResult.errors.join(', ')}`)
		}

		// Extract and sanitize the required ID field
		const sanitizedId = this.sanitizeDataField(historyItem.id, 'string')
		if (!sanitizedId) {
			throw new Error('History item must have a valid ID')
		}

		// Extract and sanitize the title field with fallback
		const sanitizedTitle = this.extractTitle(historyItem)
		
		// Extract and validate timestamps
		const timestamps = this.extractTimestamps(historyItem, preserveTimestamp)
		
		// Extract optional workspace information
		const sanitizedWorkspace = this.extractWorkspace(historyItem)
		
		// Extract optional mode information
		const sanitizedMode = this.extractMode(historyItem)
		
		// Extract boolean flags with defaults
		const booleanFlags = this.extractBooleanFlags(historyItem)

		// Create the mirror item with validated and sanitized data
		const mirrorItem: ChatMirrorItem = {
			version: MIRROR_VERSION,
			id: sanitizedId,
			title: sanitizedTitle,
			ts: timestamps.creation,
			lastUpdated: timestamps.lastUpdated
		}

		// Add optional fields only if they have meaningful values
		if (sanitizedWorkspace) {
			mirrorItem.workspace = sanitizedWorkspace
		}
		if (sanitizedMode) {
			mirrorItem.mode = sanitizedMode
		}
		if (booleanFlags.isFavorited) {
			mirrorItem.isFavorited = booleanFlags.isFavorited
		}
		if (booleanFlags.fileNotFound) {
			mirrorItem.fileNotFound = booleanFlags.fileNotFound
		}

		return mirrorItem
	}

	/**
	 * Legacy method for backward compatibility - delegates to transformToMirrorFormat
	 * @deprecated Use transformToMirrorFormat instead for better error handling
	 */
	private transformHistoryItemToMirror(historyItem: HistoryItem): ChatMirrorItem {
		return this.transformToMirrorFormat(historyItem)
	}

	/**
	 * Comprehensive validation of HistoryItem data before transformation
	 * Returns detailed validation results with specific error messages
	 */
	private validateHistoryItem(historyItem: any): { isValid: boolean; errors: string[] } {
		const errors: string[] = []

		// Check if the item exists and is an object
		if (!historyItem || typeof historyItem !== 'object') {
			errors.push('History item must be a valid object')
			return { isValid: false, errors }
		}

		// Validate required ID field
		if (!historyItem.id || typeof historyItem.id !== 'string' || historyItem.id.trim() === '') {
			errors.push('History item must have a valid string ID')
		}

		// Validate timestamp field
		if (typeof historyItem.ts !== 'number' || historyItem.ts <= 0) {
			errors.push('History item must have a valid timestamp (ts)')
		}

		// Validate optional fields if they exist
		if (historyItem.task !== undefined && typeof historyItem.task !== 'string') {
			errors.push('Task field must be a string if provided')
		}

		if (historyItem.workspace !== undefined && typeof historyItem.workspace !== 'string') {
			errors.push('Workspace field must be a string if provided')
		}

		if (historyItem.mode !== undefined && typeof historyItem.mode !== 'string') {
			errors.push('Mode field must be a string if provided')
		}

		if (historyItem.isFavorited !== undefined && typeof historyItem.isFavorited !== 'boolean') {
			errors.push('IsFavorited field must be a boolean if provided')
		}

		if (historyItem.fileNotfound !== undefined && typeof historyItem.fileNotfound !== 'boolean') {
			errors.push('FileNotfound field must be a boolean if provided')
		}

		return { isValid: errors.length === 0, errors }
	}

	/**
	 * Generic data field sanitization with type checking
	 * Cleans and validates data fields before including in mirror data
	 */
	private sanitizeDataField(value: any, expectedType: 'string' | 'number' | 'boolean'): any {
		if (value === null || value === undefined) {
			return null
		}

		switch (expectedType) {
			case 'string':
				if (typeof value === 'string') {
					const trimmed = value.trim()
					// Remove control characters and excessive whitespace
					return trimmed.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ')
				}
				// Convert other types to string if meaningful
				if (typeof value === 'number' || typeof value === 'boolean') {
					return String(value)
				}
				return null

			case 'number':
				if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
					return value
				}
				// Try to parse string numbers
				if (typeof value === 'string') {
					const parsed = Number(value)
					return !isNaN(parsed) && isFinite(parsed) ? parsed : null
				}
				return null

			case 'boolean':
				if (typeof value === 'boolean') {
					return value
				}
				// Handle string boolean representations
				if (typeof value === 'string') {
					const lower = value.toLowerCase().trim()
					if (lower === 'true' || lower === '1' || lower === 'yes') return true
					if (lower === 'false' || lower === '0' || lower === 'no') return false
				}
				return null

			default:
				return null
		}
	}

	/**
	 * Check if a history item is in the placeholder phase (api_req_started)
	 * Returns true if the task should not be saved to mirror yet
	 */
	private isPlaceholderTask(historyItem: HistoryItem): boolean {
		const taskTitle = this.sanitizeDataField(historyItem.task, 'string')
		
		// Check for placeholder indicators
		if (!taskTitle || taskTitle === 'api_req_started' || taskTitle.includes('Loading...')) {
			return true
		}
		
		// Check if task content looks like a placeholder (very short or API-related)
		if (taskTitle.length < 3 || taskTitle.match(/^(api|req|request|loading|placeholder)(_|\s|$)/i)) {
			return true
		}
		
		return false
	}

	/**
	 * Extract and sanitize title from history item with intelligent fallbacks
	 * Creates meaningful titles from available data
	 */
	private extractTitle(historyItem: HistoryItem): string {
		// Try to use the task field first
		const taskTitle = this.sanitizeDataField(historyItem.task, 'string')
		if (taskTitle && taskTitle.length > 0) {
			// Limit title length and clean up formatting
			const cleanTitle = taskTitle.substring(0, 200).trim()
			return cleanTitle || `Task ${historyItem.id}`
		}

		// Fallback to ID-based title
		const sanitizedId = this.sanitizeDataField(historyItem.id, 'string')
		if (sanitizedId) {
			return `Task ${sanitizedId.substring(0, 50)}`
		}

		// Ultimate fallback
		return `Untitled Task`
	}

	/**
	 * Extract and validate timestamp information with optional preservation
	 * Handles creation and update timestamps appropriately
	 */
	private extractTimestamps(historyItem: HistoryItem, preserveTimestamp?: boolean): { creation: number; lastUpdated: number } {
		const creationTime = this.sanitizeDataField(historyItem.ts, 'number')
		if (!creationTime || creationTime <= 0) {
			throw new Error('Invalid creation timestamp in history item')
		}

		// For preserved timestamps (updates), use current time as lastUpdated
		// For new items, use creation time for both
		const lastUpdated = preserveTimestamp ? Date.now() : creationTime

		return {
			creation: creationTime,
			lastUpdated: lastUpdated
		}
	}

	/**
	 * Extract and sanitize workspace information
	 * Returns clean workspace path or null
	 */
	private extractWorkspace(historyItem: HistoryItem): string | null {
		const workspace = this.sanitizeDataField(historyItem.workspace, 'string')
		if (!workspace || workspace.length === 0) {
			return null
		}

		// Clean up workspace paths and limit length
		const cleanWorkspace = workspace.substring(0, 500).trim()
		
		// Basic path sanitization (remove dangerous characters but keep path separators)
		const sanitizedWorkspace = cleanWorkspace.replace(/[<>"|?*\x00-\x1F]/g, '')
		
		return sanitizedWorkspace.length > 0 ? sanitizedWorkspace : null
	}

	/**
	 * Extract and sanitize mode information
	 * Returns clean mode string or null
	 */
	private extractMode(historyItem: HistoryItem): string | null {
		const mode = this.sanitizeDataField(historyItem.mode, 'string')
		if (!mode || mode.length === 0) {
			return null
		}

		// Clean up mode string and limit length
		const cleanMode = mode.substring(0, 50).trim().toLowerCase()
		
		// Only allow alphanumeric characters, hyphens, and underscores for modes
		const sanitizedMode = cleanMode.replace(/[^a-z0-9\-_]/g, '')
		
		return sanitizedMode.length > 0 ? sanitizedMode : null
	}

	/**
	 * Extract boolean flags with proper defaults
	 * Handles boolean fields safely with type checking
	 */
	private extractBooleanFlags(historyItem: HistoryItem): { isFavorited: boolean | undefined; fileNotFound: boolean | undefined } {
		const isFavorited = this.sanitizeDataField(historyItem.isFavorited, 'boolean')
		const fileNotFound = this.sanitizeDataField(historyItem.fileNotfound, 'boolean')

		return {
			isFavorited: isFavorited === true ? true : undefined,
			fileNotFound: fileNotFound === true ? true : undefined
		}
	}

	/**
	 * Validate that an object is a valid ChatMirrorItem
	 * Checks all required fields and data types
	 */
	private isValidMirrorItem(obj: any): obj is ChatMirrorItem {
		return (
			obj &&
			typeof obj === 'object' &&
			typeof obj.version === 'number' &&
			typeof obj.id === 'string' &&
			obj.id.trim() !== '' &&
			typeof obj.title === 'string' &&
			typeof obj.ts === 'number' &&
			typeof obj.lastUpdated === 'number' &&
			(obj.workspace === undefined || typeof obj.workspace === 'string') &&
			(obj.mode === undefined || typeof obj.mode === 'string') &&
			(obj.isFavorited === undefined || typeof obj.isFavorited === 'boolean') &&
			(obj.fileNotFound === undefined || typeof obj.fileNotFound === 'boolean')
		)
	}

	/**
	 * Serialize a ChatMirrorItem to JSON string with consistent formatting
	 * Provides standardized JSON output for all mirror files
	 */
	private serializeMirrorItem(mirrorItem: ChatMirrorItem): string {
		try {
			// Create a clean copy with only the required fields
			const cleanItem: ChatMirrorItem = {
				version: mirrorItem.version,
				id: mirrorItem.id,
				title: mirrorItem.title,
				ts: mirrorItem.ts,
				lastUpdated: mirrorItem.lastUpdated
			}

			// Add optional fields only if they have meaningful values
			if (mirrorItem.workspace && mirrorItem.workspace.trim() !== '') {
				cleanItem.workspace = mirrorItem.workspace
			}
			if (mirrorItem.mode && mirrorItem.mode.trim() !== '') {
				cleanItem.mode = mirrorItem.mode
			}
			if (mirrorItem.isFavorited === true) {
				cleanItem.isFavorited = mirrorItem.isFavorited
			}
			if (mirrorItem.fileNotFound === true) {
				cleanItem.fileNotFound = mirrorItem.fileNotFound
			}

			// Serialize with consistent formatting
			return JSON.stringify(cleanItem, null, 2)

		} catch (error) {
			throw new Error(`Failed to serialize mirror item for chat ${mirrorItem.id}: ${error}`)
		}
	}

	/**
	 * Queue a write operation for a new chat
	 * Uses the debounced write queue to prevent excessive file operations
	 */
	public queueWriteChat(historyItem: HistoryItem): void {
		if (!this.isEnabled || !this.isInitialized()) {
			console.warn('ChatsMirrorService: Cannot queue write, service not enabled or initialized')
			return
		}

		// Skip queuing during placeholder phase (api_req_started)
		if (this.isPlaceholderTask(historyItem)) {
			console.log(`ChatsMirrorService: Skipping queue write for placeholder chat ${historyItem.id}`)
			return
		}

		console.log(`ChatsMirrorService: Queuing write for new chat ${historyItem.id}`)
		this.queueChatWrite(historyItem)
	}

	/**
	 * Queue an update operation for an existing chat
	 * Uses the debounced write queue with special handling for updates
	 */
	public queueUpdateChat(historyItem: HistoryItem): void {
		if (!this.isEnabled || !this.isInitialized()) {
			console.warn('ChatsMirrorService: Cannot queue update, service not enabled or initialized')
			return
		}

		// Skip queuing during placeholder phase (api_req_started)
		if (this.isPlaceholderTask(historyItem)) {
			console.log(`ChatsMirrorService: Skipping queue update for placeholder chat ${historyItem.id}`)
			return
		}

		console.log(`ChatsMirrorService: Queuing update for chat ${historyItem.id}`)
		
		// For updates, we want to preserve creation timestamp, so we mark it as an update
		const mirrorItem = this.transformToMirrorFormat(historyItem, true)
		
		this.writeQueue.set(historyItem.id, {
			chatId: historyItem.id,
			data: mirrorItem,
			timestamp: Date.now(),
			retryCount: 0
		})

		this.scheduleQueuedWrites()
	}

	/**
	 * Queue a delete operation for a chat
	 * Adds a special delete marker to the queue for processing
	 */
	public queueDeleteChat(chatId: string): void {
		if (!this.isEnabled || !this.isInitialized()) {
			console.warn('ChatsMirrorService: Cannot queue delete, service not enabled or initialized')
			return
		}

		if (!chatId || chatId.trim() === '') {
			console.warn('ChatsMirrorService: Cannot queue delete, invalid chat ID')
			return
		}

		console.log(`ChatsMirrorService: Queuing delete for chat ${chatId}`)
		
		// Create a special delete marker in the queue
		const deleteMarker: QueuedWriteOperation = {
			chatId: chatId,
			data: null as any, // null indicates delete operation
			timestamp: Date.now(),
			retryCount: 0
		}

		this.writeQueue.set(chatId, deleteMarker)
		this.scheduleQueuedWrites()
	}

	/**
	 * Comprehensive filename sanitization for chat IDs and file system safety
	 * Handles cross-platform file naming restrictions and security considerations
	 */
	private sanitizeChatId(chatId: string): string {
		if (!chatId || typeof chatId !== 'string') {
			return 'invalid-chat-id'
		}

		const trimmed = chatId.trim()
		if (trimmed === '') {
			return 'empty-chat-id'
		}

		// Step 1: Remove or replace dangerous characters
		let sanitized = trimmed
			// Remove control characters and non-printable characters
			.replace(/[\x00-\x1F\x7F\x80-\x9F]/g, '')
			// Replace filesystem-invalid characters with hyphens
			.replace(/[<>:"|?*\\\/]/g, '-')
			// Replace whitespace with hyphens
			.replace(/\s+/g, '-')
			// Remove other potentially problematic characters
			.replace(/[#%&{}$!'`"@+]/g, '')

		// Step 2: Handle reserved filenames (Windows)
		const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
		if (reservedNames.test(sanitized)) {
			sanitized = `file-${sanitized}`
		}

		// Step 3: Clean up multiple consecutive hyphens
		sanitized = sanitized.replace(/-+/g, '-')

		// Step 4: Remove leading/trailing hyphens and dots
		sanitized = sanitized.replace(/^[-.]|[-.]$/g, '')

		// Step 5: Enforce length limits (most filesystems support 255 chars, but we'll be conservative)
		if (sanitized.length > 100) {
			sanitized = sanitized.substring(0, 100)
			// Remove trailing hyphen if truncation created one
			sanitized = sanitized.replace(/-$/, '')
		}

		// Step 6: Ensure we have a valid result
		if (!sanitized || sanitized === '') {
			// Generate a safe fallback based on current timestamp
			sanitized = `chat-${Date.now()}`
		}

		// Step 7: Final validation - ensure no dots only (hidden files)
		if (/^\.+$/.test(sanitized)) {
			sanitized = `file-${sanitized}`
		}

		return sanitized
	}

	/**
	 * Enhanced data validation before any write operations
	 * Performs pre-write validation to prevent data corruption
	 */
	private validateDataBeforeWrite(mirrorItem: ChatMirrorItem): { isValid: boolean; errors: string[] } {
		const errors: string[] = []

		// Validate the mirror item structure
		if (!this.isValidMirrorItem(mirrorItem)) {
			errors.push('Mirror item structure is invalid')
		}

		// Validate ID for filename safety
		if (!mirrorItem.id || typeof mirrorItem.id !== 'string') {
			errors.push('Mirror item ID is required and must be a string')
		} else {
			const sanitizedId = this.sanitizeChatId(mirrorItem.id)
			if (sanitizedId !== mirrorItem.id && sanitizedId !== mirrorItem.id.replace(/[<>:"|?*\\\/\s]/g, '-')) {
				errors.push('Mirror item ID contains characters that cannot be safely converted to filename')
			}
		}

		// Validate title length and content
		if (!mirrorItem.title || typeof mirrorItem.title !== 'string') {
			errors.push('Mirror item title is required and must be a string')
		} else if (mirrorItem.title.length > 1000) {
			errors.push('Mirror item title is too long (max 1000 characters)')
		}

		// Validate timestamps
		if (typeof mirrorItem.ts !== 'number' || mirrorItem.ts <= 0) {
			errors.push('Mirror item timestamp (ts) must be a positive number')
		}

		if (typeof mirrorItem.lastUpdated !== 'number' || mirrorItem.lastUpdated <= 0) {
			errors.push('Mirror item lastUpdated must be a positive number')
		}

		// Validate optional fields
		if (mirrorItem.workspace !== undefined) {
			if (typeof mirrorItem.workspace !== 'string') {
				errors.push('Workspace field must be a string if provided')
			} else if (mirrorItem.workspace.length > 1000) {
				errors.push('Workspace path is too long (max 1000 characters)')
			}
		}

		if (mirrorItem.mode !== undefined) {
			if (typeof mirrorItem.mode !== 'string') {
				errors.push('Mode field must be a string if provided')
			} else if (mirrorItem.mode.length > 100) {
				errors.push('Mode string is too long (max 100 characters)')
			}
		}

		return { isValid: errors.length === 0, errors }
	}

	/**
	 * Check if the service is properly initialized and ready for operations
	 * Returns true if service can handle mirror operations
	 */
	public isInitialized(): boolean {
		return this.initializationStatus === InitializationStatus.COMPLETED
	}

	/**
	 * Check if mirror functionality is currently enabled
	 * Returns false if disabled in configuration
	 */
	public isMirrorEnabled(): boolean {
		return this.isEnabled && this.isInitialized()
	}

	/**
	 * Get the current mirror folder path
	 * Returns null if not resolved or service not initialized
	 */
	public getMirrorFolderPath(): string | null {
		return this.mirrorFolderPath
	}

	/**
	 * Get current write queue statistics for monitoring
	 * Useful for debugging and performance monitoring
	 */
	public getQueueStatistics(): { queueSize: number; isProcessing: boolean } {
		return {
			queueSize: this.writeQueue.size,
			isProcessing: this.writeTimer !== null
		}
	}

	/**
	 * Invalidate the folder existence cache to force next access check
	 * Used when configuration changes or after failed operations
	 */
	private invalidateFolderCache(): void {
		this.folderExistsCache = false
		this.lastFolderCheckTime = 0
		console.log('ChatsMirrorService: Folder existence cache invalidated')
	}

	/**
	 * Get folder cache status for debugging and monitoring
	 * Returns current cache state and last check time
	 */
	public getFolderCacheStatus(): { cached: boolean; lastCheck: number; cacheAge: number } {
		const now = Date.now()
		return {
			cached: this.folderExistsCache,
			lastCheck: this.lastFolderCheckTime,
			cacheAge: this.lastFolderCheckTime > 0 ? now - this.lastFolderCheckTime : -1
		}
	}

	/**
	 * Delete a chat mirror file with graceful error handling
	 * This is the public API for deleting chat mirrors from external services
	 * Handles cases where mirror file doesn't exist without throwing errors
	 */
	public async deleteChatMirror(chatId: string): Promise<void> {
		try {
			// Validate input
			if (!chatId || chatId.trim() === '') {
				console.warn('ChatsMirrorService: Invalid chat ID provided for deletion')
				return
			}

			// Check if service is enabled and initialized
			if (!this.isEnabled || !this.isInitialized()) {
				console.log(`ChatsMirrorService: Service not enabled or initialized, skipping deletion of chat ${chatId}`)
				return
			}

			// Perform the deletion using existing method
			await this.deleteChat(chatId)
			console.log(`ChatsMirrorService: Successfully deleted mirror for chat ${chatId}`)

		} catch (error) {
			// Log error but don't throw - deletion failures should not block main task operations
			console.error(`ChatsMirrorService: Failed to delete mirror for chat ${chatId}:`, error)
		}
	}

	/**
	 * Dispose of the service and clean up resources
	 * Should be called when the extension is deactivated
	 */
	public dispose(): void {
		// Clear write timer
		if (this.writeTimer) {
			clearTimeout(this.writeTimer)
			this.writeTimer = null
		}

		// Clear write queue
		this.writeQueue.clear()

		// Dispose configuration listener
		if (this.configChangeListener) {
			this.configChangeListener.dispose()
			this.configChangeListener = null
		}

		// Clear folder cache
		this.invalidateFolderCache()

		console.log('ChatsMirrorService: Disposed')
	}
}