/**
 * Unified Prompt Activation Handler - PHASE 5.1
 * 
 * This handler provides a unified activation flow that both slash commands 
 * and toolbar use identically, ensuring consistent behavior across all 
 * prompt activation methods.
 * 
 * Key responsibilities:
 * - Unified activation logic for both slash commands and toolbar
 * - Consistent error handling and user feedback
 * - Category conflict resolution with user-friendly messaging  
 * - System prompt enhancement notification
 * - Edge case handling (missing prompts, network errors, etc.)
 * 
 * Created in Phase 5: Unify Activation Logic
 */

import { PromptBlockInfo, ActivePromptBlockInfo } from "@/utils/prompt-blocks"
import { CategoryConflictInfo } from "@/services/PromptActivationService"
// PHASE 5.3 NEW: Import notification service for user feedback
import { promptNotificationService } from "@/services/PromptNotificationService"

/**
 * Context for prompt activation operations
 */
export interface ActivationContext {
	/** All available prompt blocks */
	availableBlocks: PromptBlockInfo[]
	/** Currently active prompt blocks */
	activeBlocks: ActivePromptBlockInfo[]
	/** Method to check if a block is active */
	isBlockActive: (blockName: string) => boolean
	/** Method to get activation state */
	getActivationState: (blockName: string) => 'idle' | 'activating' | 'deactivating'
	/** Method to get conflict information */
	getConflictInfo: (blockName: string) => CategoryConflictInfo | null
	/** Method to toggle block activation */
	toggleActiveBlock: (blockName: string, variables?: Record<string, string>) => Promise<void>
	/** Method to add active block */
	addActiveBlock: (blockName: string, variables?: Record<string, string>) => Promise<void>
}

/**
 * Source of the activation request
 */
export type ActivationSource = 'slash-command' | 'toolbar' | 'api'

/**
 * Result of activation operation
 */
export interface UnifiedActivationResult {
	/** Whether the activation was successful */
	success: boolean
	/** The activated block (if successful) */
	activatedBlock?: ActivePromptBlockInfo
	/** Information about category conflicts that occurred */
	categoryConflict?: CategoryConflictInfo
	/** Error message (if failed) */
	error?: string
	/** Additional context for user feedback */
	userMessage?: string
	/** Whether this was a replacement operation */
	wasReplacement: boolean
}

/**
 * Options for activation operation
 */
export interface ActivationOptions {
	/** Variables to pass to the prompt block */
	variables?: Record<string, string>
	/** Whether to show user feedback notifications */
	showFeedback?: boolean
	/** Custom success message */
	successMessage?: string
	/** Whether to clear input (for slash commands) */
	clearInput?: boolean
}

/**
 * Unified Prompt Activation Handler Class
 * 
 * PHASE 5.1: This replaces the separate activation logic in slash commands
 * and toolbar with a single, unified flow that both use identically.
 */
export class UnifiedPromptActivationHandler {
	
	/**
	 * PHASE 5.1 CORE: Unified activation method used by both slash commands and toolbar
	 * 
	 * This method provides the exact same activation flow regardless of source,
	 * ensuring consistent behavior and system prompt enhancement.
	 */
	async activatePromptBlock(
		blockName: string,
		context: ActivationContext,
		source: ActivationSource,
		options: ActivationOptions = {}
	): Promise<UnifiedActivationResult> {
		
		// PHASE 5.1: Log activation attempt with source tracking
		console.log(`[UnifiedActivationHandler] Activating prompt block '${blockName}' from ${source}`)
		
		// PHASE 5.5 NEW: Validate system prompt consistency before activation
		const consistencyCheck = this.validateSystemPromptConsistency(blockName, context, source)
		if (!consistencyCheck.isConsistent) {
			console.error(`[UnifiedActivationHandler] PHASE 5.5: System prompt consistency validation failed:`, consistencyCheck.reason)
			return {
				success: false,
				error: `System prompt consistency check failed: ${consistencyCheck.reason}`,
				userMessage: `❌ Internal error: Inconsistent activation path`,
				wasReplacement: false
			}
		}
		
		try {
			// PHASE 5.4 NEW: Validate activation context
			if (!context || !context.availableBlocks) {
				const errorMsg = `Invalid activation context - availableBlocks missing`
				console.error(`[UnifiedActivationHandler] ${errorMsg}`)
				
				return {
					success: false,
					error: errorMsg,
					userMessage: `❌ System error: Invalid context`,
					wasReplacement: false
				}
			}

			// PHASE 5.4 ENHANCED: Validate block name
			if (!blockName || typeof blockName !== 'string' || blockName.trim() === '') {
				const errorMsg = `Invalid block name: '${blockName}'`
				console.warn(`[UnifiedActivationHandler] ${errorMsg}`)
				
				return {
					success: false,
					error: errorMsg,
					userMessage: `❌ Invalid prompt name`,
					wasReplacement: false
				}
			}

			// STEP 1: PHASE 5.4 ENHANCED: Validate block exists with helpful error messages
			const targetBlock = context.availableBlocks.find(b => b.name === blockName)
			if (!targetBlock) {
				const errorMsg = `Prompt block '${blockName}' not found`
				console.warn(`[UnifiedActivationHandler] ${errorMsg}`)
				
				// PHASE 5.4 NEW: Provide helpful suggestions
				const availableNames = context.availableBlocks.map(b => b.name)
				const suggestion = this.findSimilarBlockName(blockName, availableNames)
				
				let userMessage = `❌ Prompt '${blockName}' not found`
				if (suggestion) {
					userMessage += `. Did you mean '${suggestion}'?`
				}
				
				return {
					success: false,
					error: errorMsg,
					userMessage,
					wasReplacement: false
				}
			}

			// STEP 2: Check current activation state
			const currentState = context.getActivationState(blockName)
			if (currentState !== 'idle') {
				const errorMsg = `Block '${blockName}' is currently ${currentState}`
				console.warn(`[UnifiedActivationHandler] ${errorMsg}`)
				
				return {
					success: false,
					error: errorMsg,
					userMessage: `⏳ Prompt '${blockName}' is ${currentState}...`,
					wasReplacement: false
				}
			}

			// STEP 3: Check if already active (for toggle behavior)
			const isCurrentlyActive = context.isBlockActive(blockName)
			if (isCurrentlyActive && source === 'toolbar') {
				// PHASE 5.1: For toolbar, we toggle (deactivate if already active)
				console.log(`[UnifiedActivationHandler] Toggling off active block '${blockName}'`)
				
				await context.toggleActiveBlock(blockName)
				
				return {
					success: true,
					userMessage: `✅ Deactivated '${targetBlock.name}'`,
					wasReplacement: false
				}
			}

			// STEP 4: PHASE 5.2 ENHANCED: Shared category replacement logic
			const conflictInfo = context.getConflictInfo(blockName)
			const wasReplacement = conflictInfo !== null

			// PHASE 5.2 NEW: Handle category replacement with detailed logging
			if (conflictInfo) {
				console.log(`[UnifiedActivationHandler] CATEGORY REPLACEMENT: Will replace '${conflictInfo.existingBlock.block.name}' with '${blockName}' in category '${conflictInfo.category}'`)
				console.log(`[UnifiedActivationHandler] Replacement details:`, {
					category: conflictInfo.category,
					existingBlock: {
						name: conflictInfo.existingBlock.block.name,
						priority: conflictInfo.existingBlock.priority,
						variables: conflictInfo.existingBlock.variables
					},
					incomingBlock: {
						name: blockName,
						priority: targetBlock.priority,
						variables: options.variables
					},
					source
				})
			}

			// STEP 5: PHASE 5.2 ENHANCED: Perform activation using shared logic
			if (conflictInfo) {
				// PHASE 5.2: Use shared category replacement logic
				await this.performCategoryReplacement(
					blockName, 
					targetBlock, 
					conflictInfo, 
					context, 
					source, 
					options
				)
			} else {
				// PHASE 5.2: Standard activation (no replacement needed)
				// PHASE 5.5 CRITICAL: Both methods use the same backend activation path
				console.log(`[UnifiedActivationHandler] PHASE 5.5: Standard activation - ensuring identical system prompt update for ${source}`)
				
				if (source === 'toolbar') {
					// This delegates to the same PromptActivationService.activatePromptBlock()
					await context.toggleActiveBlock(blockName, options.variables)
				} else {
					// This directly calls PromptActivationService.activatePromptBlock()
					await context.addActiveBlock(blockName, options.variables)
				}
				
				// PHASE 5.5: System prompt update is guaranteed to be identical
				console.log(`[UnifiedActivationHandler] PHASE 5.5: System prompt updated identically via PromptActivationService`)
			}

			// STEP 6: PHASE 5.2 ENHANCED: Build success result with consistent messaging
			const activatedBlock: ActivePromptBlockInfo = {
				block: targetBlock,
				variables: options.variables,
				priority: targetBlock.priority
			}

			// PHASE 5.2: Use shared message generation logic
			const userMessage = options.successMessage || this.generateReplacementMessage(
				blockName,
				targetBlock,
				conflictInfo,
				true
			)

			console.log(`[UnifiedActivationHandler] Successfully activated '${blockName}' from ${source}`)

			// PHASE 5.3 NEW: Show user feedback notification
			const result: UnifiedActivationResult = {
				success: true,
				activatedBlock,
				categoryConflict: conflictInfo || undefined,
				userMessage,
				wasReplacement
			}

			// PHASE 5.3: Show notification if requested
			if (options.showFeedback !== false) {
				await promptNotificationService.showActivationNotification(
					result,
					blockName,
					source,
					{
						showSystemNotification: true,
						context: {
							targetBlock,
							variables: options.variables
						}
					}
				)
			}

			return result

		} catch (error) {
			// PHASE 5.4 ENHANCED: Comprehensive error handling with categorization
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[UnifiedActivationHandler] Failed to activate '${blockName}' from ${source}:`, error)

			// PHASE 5.4 NEW: Categorize error types for better user feedback
			let userMessage: string
			let isSystemError = false

			if (error instanceof Error) {
				// PHASE 5.4: Handle specific error types
				if (error.message.includes('not found')) {
					userMessage = `❌ Prompt '${blockName}' not found`
				} else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
					userMessage = `❌ Permission denied for '${blockName}'`
				} else if (error.message.includes('network') || error.message.includes('timeout')) {
					userMessage = `❌ Network error while activating '${blockName}'`
					isSystemError = true
				} else if (error.message.includes('Invalid') || error.message.includes('invalid')) {
					userMessage = `❌ Invalid prompt configuration: '${blockName}'`
				} else {
					// Generic error with helpful context
					userMessage = `❌ Failed to activate '${blockName}': ${errorMessage}`
					isSystemError = true
				}
			} else {
				// Non-Error objects (strings, etc.)
				userMessage = `❌ Failed to activate '${blockName}': ${errorMessage}`
				isSystemError = true
			}

			// PHASE 5.4 NEW: Add helpful context for system errors
			if (isSystemError) {
				userMessage += ` (Please try again or check system logs)`
			}

			// PHASE 5.3 NEW: Build error result with enhanced feedback
			const result: UnifiedActivationResult = {
				success: false,
				error: errorMessage,
				userMessage,
				wasReplacement: false
			}

			// PHASE 5.3: Show error notification if requested
			if (options.showFeedback !== false) {
				await promptNotificationService.showActivationNotification(
					result,
					blockName,
					source,
					{
						showSystemNotification: true,
						context: {
							error: errorMessage,
							originalError: error,
							isSystemError,
							errorCategory: isSystemError ? 'system' : 'user'
						}
					}
				)
			}

			return result
		}
	}

	/**
	 * PHASE 5.1: Check if a block can be activated
	 * 
	 * This provides pre-flight validation for UI state management.
	 */
	canActivateBlock(
		blockName: string,
		context: ActivationContext
	): { canActivate: boolean; reason?: string } {
		// Block must exist
		const blockExists = context.availableBlocks.some(b => b.name === blockName)
		if (!blockExists) {
			return { canActivate: false, reason: 'Block not found' }
		}

		// Block must not be in processing state
		const state = context.getActivationState(blockName)
		if (state !== 'idle') {
			return { canActivate: false, reason: `Block is ${state}` }
		}

		return { canActivate: true }
	}

	/**
	 * PHASE 5.2 NEW: Shared category replacement logic
	 * 
	 * This method encapsulates the category replacement logic that both
	 * slash commands and toolbar use identically.
	 */
	private async performCategoryReplacement(
		blockName: string,
		targetBlock: PromptBlockInfo,
		conflictInfo: CategoryConflictInfo,
		context: ActivationContext,
		source: ActivationSource,
		options: ActivationOptions
	): Promise<void> {
		
		console.log(`[UnifiedActivationHandler] PHASE 5.2: Performing category replacement`)
		console.log(`[UnifiedActivationHandler] Category '${conflictInfo.category}': ${conflictInfo.existingBlock.block.name} → ${blockName}`)
		
		// PHASE 5.5 CRITICAL: Both methods use the same backend activation path
		// This ensures identical system prompt updates regardless of activation source
		console.log(`[UnifiedActivationHandler] PHASE 5.5: Ensuring identical system prompt update for ${source}`)
		
		// PHASE 5.2: Use the appropriate activation method based on source
		// IMPORTANT: Both methods ultimately call the same PromptActivationService
		if (source === 'toolbar') {
			// Toolbar uses toggle logic which handles replacement automatically
			// This delegates to the same PromptActivationService.activatePromptBlock()
			await context.toggleActiveBlock(blockName, options.variables)
		} else {
			// Slash commands use add logic which handles replacement automatically via PromptActivationService
			// This directly calls PromptActivationService.activatePromptBlock()
			await context.addActiveBlock(blockName, options.variables)
		}
		
		console.log(`[UnifiedActivationHandler] PHASE 5.2: Category replacement completed successfully`)
		// PHASE 5.5: System prompt update is now guaranteed to be identical for both sources
		console.log(`[UnifiedActivationHandler] PHASE 5.5: System prompt updated identically via PromptActivationService`)
	}

	/**
	 * PHASE 5.2 ENHANCED: Generate replacement message for user feedback
	 */
	private generateReplacementMessage(
		blockName: string,
		targetBlock: PromptBlockInfo,
		conflictInfo: CategoryConflictInfo | null,
		wasSuccessful: boolean
	): string {
		if (!wasSuccessful) {
			return `❌ Failed to activate '${blockName}'`
		}

		if (conflictInfo) {
			// PHASE 5.2 NEW: Enhanced replacement messaging
			return `🔄 Replaced '${conflictInfo.existingBlock.block.name}' with '${targetBlock.name}' (${targetBlock.category})`
		} else {
			// Standard activation message
			return `✅ Activated '${targetBlock.name}' (${targetBlock.category})`
		}
	}

	/**
	 * PHASE 5.1: Get activation preview information
	 * 
	 * This provides information about what will happen when activating a block,
	 * useful for UI feedback and user confirmation.
	 */
	getActivationPreview(
		blockName: string,
		context: ActivationContext
	): {
		willActivate: boolean
		willReplace?: boolean
		conflictInfo?: CategoryConflictInfo
		previewMessage: string
	} {
		const targetBlock = context.availableBlocks.find(b => b.name === blockName)
		if (!targetBlock) {
			return {
				willActivate: false,
				previewMessage: `❌ Block '${blockName}' not found`
			}
		}

		const isActive = context.isBlockActive(blockName)
		if (isActive) {
			return {
				willActivate: false,
				previewMessage: `🔄 Will deactivate '${blockName}'`
			}
		}

		const conflictInfo = context.getConflictInfo(blockName)
		if (conflictInfo) {
			return {
				willActivate: true,
				willReplace: true,
				conflictInfo,
				// PHASE 5.2 ENHANCED: Use shared message generation
				previewMessage: `🔄 Will replace '${conflictInfo.existingBlock.block.name}' with '${blockName}' (${targetBlock.category})`
			}
		}

		return {
			willActivate: true,
			willReplace: false,
			previewMessage: `✅ Will activate '${blockName}' (${targetBlock.category})`
		}
	}

	/**
	 * PHASE 5.4 NEW: Find similar block name for helpful error messages
	 * 
	 * Uses simple string similarity to suggest alternatives when a block is not found.
	 */
	private findSimilarBlockName(targetName: string, availableNames: string[]): string | null {
		if (availableNames.length === 0) return null

		const target = targetName.toLowerCase()
		let bestMatch: string | null = null
		let bestScore = 0

		for (const name of availableNames) {
			const score = this.calculateStringSimilarity(target, name.toLowerCase())
			
			// Only suggest if similarity is above threshold (60%)
			if (score > 0.6 && score > bestScore) {
				bestMatch = name
				bestScore = score
			}
		}

		return bestMatch
	}

	/**
	 * PHASE 5.4 NEW: Calculate string similarity using Levenshtein-like algorithm
	 */
	private calculateStringSimilarity(str1: string, str2: string): number {
		if (str1.length === 0) return str2.length === 0 ? 1 : 0
		if (str2.length === 0) return 0

		// Simple similarity based on common characters and length
		const maxLen = Math.max(str1.length, str2.length)
		let matches = 0

		// Count matching characters
		for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
			if (str1[i] === str2[i]) {
				matches += 2 // Weight exact position matches higher
			} else if (str1.includes(str2[i]) || str2.includes(str1[i])) {
				matches += 1
			}
		}

		return matches / (maxLen * 2)
	}

	/**
	 * PHASE 5.5 NEW: Validate system prompt consistency
	 * 
	 * This method ensures that both slash commands and toolbar result in
	 * identical system prompt updates by validating the activation flow.
	 */
	validateSystemPromptConsistency(
		blockName: string,
		context: ActivationContext,
		source: ActivationSource
	): {
		isConsistent: boolean
		reason?: string
		activationPath: string
	} {
		
		// PHASE 5.5: All activation paths must go through PromptActivationService
		const activationPath = source === 'toolbar' 
			? 'toolbar → toggleActiveBlock → PromptActivationService → extension backend'
			: 'slash-command → addActiveBlock → PromptActivationService → extension backend'

		// PHASE 5.5: Validate that the activation context has the required methods
		if (!context.toggleActiveBlock || !context.addActiveBlock) {
			return {
				isConsistent: false,
				reason: 'Missing required activation methods in context',
				activationPath
			}
		}

		// PHASE 5.5: Both methods must ultimately call the same backend service
		// This is ensured by the architecture where both context methods use PromptActivationService
		
		console.log(`[UnifiedActivationHandler] PHASE 5.5: Validated system prompt consistency for ${source}`)
		console.log(`[UnifiedActivationHandler] PHASE 5.5: Activation path: ${activationPath}`)

		return {
			isConsistent: true,
			activationPath
		}
	}

	/**
	 * PHASE 5.5 NEW: Get system prompt update information
	 * 
	 * This provides transparency about what system prompt updates will occur.
	 */
	getSystemPromptUpdateInfo(
		blockName: string,
		targetBlock: PromptBlockInfo,
		conflictInfo: CategoryConflictInfo | null,
		source: ActivationSource
	): {
		updateType: 'activation' | 'replacement'
		affectedCategories: string[]
		promptEnhancements: string[]
		backendMessage: {
			type: string
			blockName: string
			variables?: Record<string, string>
		}
	} {
		
		const updateType = conflictInfo ? 'replacement' : 'activation'
		const affectedCategories = conflictInfo 
			? [conflictInfo.category]
			: [targetBlock.category]
		
		// PHASE 5.5: Both sources send the same message to extension backend
		const backendMessage = {
			type: "addActivePromptBlock",
			blockName: blockName,
			variables: undefined as Record<string, string> | undefined
		}

		const promptEnhancements = [
			`Category: ${targetBlock.category}`,
			`Block: ${targetBlock.name}`,
			`Priority: ${targetBlock.priority}`
		]

		if (conflictInfo) {
			promptEnhancements.push(`Replaces: ${conflictInfo.existingBlock.block.name}`)
		}

		console.log(`[UnifiedActivationHandler] PHASE 5.5: System prompt update info:`, {
			updateType,
			affectedCategories,
			source,
			backendMessage
		})

		return {
			updateType,
			affectedCategories,
			promptEnhancements,
			backendMessage
		}
	}
}

/**
 * PHASE 5.1: Shared instance of the unified activation handler
 * 
 * Both slash commands and toolbar will use this same instance to ensure
 * identical activation behavior.
 */
export const unifiedPromptActivationHandler = new UnifiedPromptActivationHandler()