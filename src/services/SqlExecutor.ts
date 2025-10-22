import * as vscode from "vscode"

/**
 * Result returned from SQL execution
 */
export interface SqlResult {
	success: boolean
	rows: any[]
	rowCount: number
	executionTime?: number
	error?: string
}

/**
 * Connection information
 */
export interface SqlConnection {
	id: string
	connectionName: string
	connectionType: string
	connectionCredentials: {
		mode: string
		project_id?: string
	}
}

/**
 * Dataset information
 */
export interface SqlDataset {
	datasetId: string
	location?: string
	description?: string
	createdAt?: string
}

/**
 * Table information
 */
export interface SqlTable {
	tableId: string
	description: string
	type: string
	numRows: number
	numBytes: number
	createdAt: string
	lastModified: string
}

/**
 * Table schema information
 */
export interface SqlTableSchema {
	columns: Array<{
		name: string
		type: string
		mode: string
		description: string
	}>
	tableDescription: string
	totalColumns: number
	totalRows: number
	lastModified: string
}

/**
 * Options for SQL execution
 */
export interface SqlExecutionOptions {
	connectionId?: string
	timeout?: number
	showResults?: boolean
}

/**
 * SqlExecutor Service
 *
 * Bridges the chatbot to the open-analyst SQL extension.
 * Handles extension loading, activation, and provides type-safe SQL execution and schema discovery.
 */
export class SqlExecutor {
	private sqlExtension: any
	private readonly extensionId = "openanalyst-team.open-analyst"
	private initialized = false

	/**
	 * Initialize the SQL extension connection
	 * @throws Error if extension is not installed or cannot be activated
	 */
	async initialize(): Promise<void> {
		if (this.initialized && this.sqlExtension) {
			return
		}

		const ext = vscode.extensions.getExtension(this.extensionId)

		if (!ext) {
			throw new Error(
				"OpenAnalyst SQL extension is not installed. Please install it from the VS Code marketplace.",
			)
		}

		// Wait for activation if not already active
		if (!ext.isActive) {
			try {
				await ext.activate()
			} catch (error) {
				throw new Error(
					`Failed to activate SQL extension: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		this.sqlExtension = ext.exports

		// Validate API is available
		if (!this.sqlExtension?.executeSql) {
			throw new Error("SQL extension API is not available. The extension may be outdated or incompatible.")
		}

		this.initialized = true
	}

	/**
	 * Execute SQL query
	 * @param query - SQL query string to execute
	 * @param options - Optional execution parameters
	 * @returns Promise resolving to execution result
	 */
	async executeSql(query: string, options?: SqlExecutionOptions): Promise<SqlResult> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			const result = await this.sqlExtension.executeSql(query, {
				connectionId: options?.connectionId,
				timeout: options?.timeout,
			})

			// Show results in panel if requested
			if (options?.showResults && result.success) {
				await this.showResults(result.rows, {
					rowCount: result.rowCount,
					executionTime: result.executionTime,
					executedSQL: query,
				})
			}

			return result
		} catch (error: any) {
			return {
				success: false,
				rows: [],
				rowCount: 0,
				error: error.message || "Unknown error occurred during SQL execution",
			}
		}
	}

	/**
	 * Get all available SQL connections
	 * @returns Array of connection objects
	 */
	async getConnections(): Promise<SqlConnection[]> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.getConnections()
		} catch (error) {
			console.error("Failed to get SQL connections:", error)
			return []
		}
	}

	/**
	 * Get BigQuery-specific connection managers
	 * @returns Array of BigQuery connection objects with client info
	 */
	async getBigQueryConnections(): Promise<any[]> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.getBigQueryConnections()
		} catch (error) {
			console.error("Failed to get BigQuery connections:", error)
			return []
		}
	}

	/**
	 * Get the currently active connection
	 * @returns Active connection or undefined
	 */
	async getActiveConnection(): Promise<SqlConnection | undefined> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.getActiveConnection()
		} catch (error) {
			console.error("Failed to get active connection:", error)
			return undefined
		}
	}

	/**
	 * List all datasets in a connection
	 * @param connectionId - Optional connection ID (uses default if not provided)
	 * @returns Promise with datasets array
	 */
	async listDatasets(connectionId?: string): Promise<{
		success: boolean
		datasets: string[]
		connectionId?: string
		error?: string
	}> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return await this.sqlExtension.listDatasets(connectionId)
		} catch (error: any) {
			return {
				success: false,
				datasets: [],
				error: error.message,
			}
		}
	}

	/**
	 * List all tables in a dataset
	 * @param datasetId - Dataset ID
	 * @param connectionId - Optional connection ID
	 * @returns Promise with tables array
	 */
	async listTables(
		datasetId: string,
		connectionId?: string,
	): Promise<{
		success: boolean
		tables: SqlTable[]
		datasetId?: string
		connectionId?: string
		error?: string
	}> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return await this.sqlExtension.listTables(datasetId, connectionId)
		} catch (error: any) {
			return {
				success: false,
				tables: [],
				error: error.message,
			}
		}
	}

	/**
	 * Get table schema with column details
	 * @param tableId - Table ID in format "dataset.table"
	 * @param connectionId - Optional connection ID
	 * @returns Promise with schema details
	 */
	async getTableSchema(
		tableId: string,
		connectionId?: string,
	): Promise<{
		success: boolean
		schema: SqlTableSchema | null
		error?: string
	}> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return await this.sqlExtension.getTableSchema(tableId, connectionId)
		} catch (error: any) {
			return {
				success: false,
				schema: null,
				error: error.message,
			}
		}
	}

	/**
	 * Show query results in the results panel
	 * @param results - Query result rows
	 * @param queryInfo - Metadata about the query
	 */
	async showResults(results: any[], queryInfo: any): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			await this.sqlExtension.showResults(results, queryInfo, "chatbot-query")
		} catch (error) {
			console.error("Failed to show results:", error)
		}
	}

	/**
	 * Check if SQL extension is available and ready
	 * @returns true if extension is ready to execute queries
	 */
	isAvailable(): boolean {
		if (!this.initialized || !this.sqlExtension) {
			return false
		}

		try {
			return this.sqlExtension.isReady()
		} catch (error) {
			return false
		}
	}

	/**
	 * Get a user-friendly status message
	 * @returns Status description string
	 */
	async getStatus(): Promise<string> {
		try {
			if (!this.initialized) {
				await this.initialize()
			}

			const connections = await this.getConnections()

			if (connections.length === 0) {
				return "SQL extension is installed but no connections are configured. Please add a BigQuery connection."
			}

			const bqConnections = await this.getBigQueryConnections()
			const connectedCount = bqConnections.filter((c: any) => c.isConnected).length

			if (connectedCount === 0) {
				return `${connections.length} connection(s) configured but none are connected. Please authenticate.`
			}

			const activeConnection = await this.getActiveConnection()
			if (activeConnection) {
				return `Connected to: ${activeConnection.connectionName} (${activeConnection.connectionType})`
			}

			return `${connectedCount} of ${connections.length} connection(s) ready`
		} catch (error: any) {
			return `SQL extension unavailable: ${error.message}`
		}
	}

	/**
	 * Create a new SQL worksheet
	 * @param name - Optional worksheet name
	 * @param initialSql - Optional initial SQL content
	 * @returns Worksheet object
	 */
	async createWorksheet(name?: string, initialSql?: string): Promise<any> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.createWorksheet(name, initialSql)
		} catch (error: any) {
			throw new Error(`Failed to create worksheet: ${error.message}`)
		}
	}

	/**
	 * List all SQL worksheets
	 * @returns Array of worksheet objects
	 */
	async listWorksheets(): Promise<any[]> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.listWorksheets()
		} catch (error: any) {
			console.error("Failed to list worksheets:", error)
			return []
		}
	}

	/**
	 * Get worksheet by ID with content
	 * @param worksheetId - Worksheet ID
	 * @returns Worksheet object with content
	 */
	async getWorksheet(worksheetId: string): Promise<any> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.getWorksheet(worksheetId)
		} catch (error: any) {
			throw new Error(`Failed to get worksheet: ${error.message}`)
		}
	}

	/**
	 * Write content to a worksheet
	 * @param worksheetId - Worksheet ID
	 * @param content - SQL content
	 * @returns Updated worksheet object
	 */
	async writeWorksheet(worksheetId: string, content: string): Promise<any> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return this.sqlExtension.writeWorksheet(worksheetId, content)
		} catch (error: any) {
			throw new Error(`Failed to write worksheet: ${error.message}`)
		}
	}

	/**
	 * Delete a worksheet
	 * @param worksheetId - Worksheet ID
	 */
	async deleteWorksheet(worksheetId: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			await this.sqlExtension.deleteWorksheet(worksheetId)
		} catch (error: any) {
			throw new Error(`Failed to delete worksheet: ${error.message}`)
		}
	}

	/**
	 * Execute SQL from a worksheet
	 * @param worksheetId - Worksheet ID
	 * @param connectionId - Optional connection ID
	 * @returns Execution result with rows
	 */
	async executeWorksheet(worksheetId: string, connectionId?: string): Promise<SqlResult & { worksheetName?: string }> {
		if (!this.initialized) {
			await this.initialize()
		}

		try {
			return await this.sqlExtension.executeWorksheet(worksheetId, connectionId)
		} catch (error: any) {
			return {
				success: false,
				rows: [],
				rowCount: 0,
				error: error.message,
			}
		}
	}
}

/**
 * Singleton instance of SqlExecutor
 * Use this to avoid creating multiple instances
 */
let sqlExecutorInstance: SqlExecutor | null = null

/**
 * Get or create the SqlExecutor singleton instance
 * @returns SqlExecutor instance
 */
export function getSqlExecutor(): SqlExecutor {
	if (!sqlExecutorInstance) {
		sqlExecutorInstance = new SqlExecutor()
	}
	return sqlExecutorInstance
}
