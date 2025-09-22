/**
 * Prompt Notification Service - PHASE 5.3
 * 
 * This service provides user feedback notifications for prompt activation
 * and deactivation operations. It integrates with the existing system
 * notification infrastructure to provide consistent user feedback.
 * 
 * Key features:
 * - Success notifications for prompt activation/deactivation
 * - Error notifications with helpful error messages
 * - Category conflict notifications
 * - Optional toast-style notifications for better UX
 * 
 * Created in Phase 5.3: Add activation feedback
 */

import { vscode } from "@/utils/vscode"
import { CategoryConflictInfo } from "@/services/PromptActivationService"
import { UnifiedActivationResult } from "@/services/UnifiedPromptActivationHandler"

/**
 * Notification types for different prompt operations
 */
export type PromptNotificationType = 
	| 'activation-success'
	| 'deactivation-success' 
	| 'replacement-success'
	| 'activation-error'
	| 'validation-error'
	| 'conflict-info'

/**
 * Options for prompt notifications
 */
export interface PromptNotificationOptions {
	/** Whether to show system notification */
	showSystemNotification?: boolean
	/** Whether to show console log */
	showConsoleLog?: boolean
	/** Custom title for the notification */
	title?: string
	/** Additional context information */
	context?: Record<string, any>
}

/**
 * Prompt Notification Service Class
 * 
 * PHASE 5.3: Provides consistent user feedback for all prompt operations
 */
export class PromptNotificationService {

	/**
	 * PHASE 5.3 CORE: Show notification for activation result
	 * 
	 * This provides unified feedback for both slash commands and toolbar
	 * activation operations.
	 */
	async showActivationNotification(
		result: UnifiedActivationResult,
		blockName: string,
		source: 'slash-command' | 'toolbar' | 'api',
		options: PromptNotificationOptions = {}
	): Promise<void> {
		
		// Set default options
		const opts = {
			showSystemNotification: true,
			showConsoleLog: true,
			...options
		}

		if (result.success) {
			// PHASE 5.3: Handle success notifications
			const notificationType: PromptNotificationType = result.wasReplacement 
				? 'replacement-success' 
				: 'activation-success'
				
			await this.showNotification(
				notificationType,
				result.userMessage || `✅ Activated ${blockName}`,
				{
					...opts,
					context: {
						blockName,
						source,
						wasReplacement: result.wasReplacement,
						categoryConflict: result.categoryConflict,
						...opts.context
					}
				}
			)
		} else {
			// PHASE 5.3: Handle error notifications
			await this.showNotification(
				'activation-error',
				result.userMessage || result.error || `❌ Failed to activate ${blockName}`,
				{
					...opts,
					context: {
						blockName,
						source,
						error: result.error,
						...opts.context
					}
				}
			)
		}
	}

	/**
	 * PHASE 5.3: Show category conflict information
	 */
	async showCategoryConflictInfo(
		conflictInfo: CategoryConflictInfo,
		options: PromptNotificationOptions = {}
	): Promise<void> {
		
		const message = `🔄 Will replace '${conflictInfo.existingBlock.block.name}' with '${conflictInfo.incomingBlock.name}' in category '${conflictInfo.category}'`
		
		await this.showNotification(
			'conflict-info',
			message,
			{
				showSystemNotification: false, // Don't spam with preview info
				showConsoleLog: true,
				...options,
				context: {
					conflictInfo,
					...options.context
				}
			}
		)
	}

	/**
	 * PHASE 5.3: Show deactivation notification
	 */
	async showDeactivationNotification(
		blockName: string,
		success: boolean,
		source: 'slash-command' | 'toolbar' | 'api',
		error?: string,
		options: PromptNotificationOptions = {}
	): Promise<void> {
		
		const message = success 
			? `✅ Deactivated '${blockName}'`
			: `❌ Failed to deactivate '${blockName}': ${error || 'Unknown error'}`
			
		const notificationType: PromptNotificationType = success 
			? 'deactivation-success' 
			: 'activation-error'

		await this.showNotification(
			notificationType,
			message,
			{
				showSystemNotification: true,
				showConsoleLog: true,
				...options,
				context: {
					blockName,
					source,
					success,
					error,
					...options.context
				}
			}
		)
	}

	/**
	 * PHASE 5.3: Show validation error notification
	 */
	async showValidationError(
		blockName: string,
		reason: string,
		source: 'slash-command' | 'toolbar' | 'api',
		options: PromptNotificationOptions = {}
	): Promise<void> {
		
		const message = `❌ Cannot activate '${blockName}': ${reason}`
		
		await this.showNotification(
			'validation-error',
			message,
			{
				showSystemNotification: true,
				showConsoleLog: true,
				...options,
				context: {
					blockName,
					source,
					reason,
					...options.context
				}
			}
		)
	}

	/**
	 * PHASE 5.3: Core notification method
	 * 
	 * This integrates with the existing system notification infrastructure.
	 */
	private async showNotification(
		type: PromptNotificationType,
		message: string,
		options: PromptNotificationOptions = {}
	): Promise<void> {
		
		try {
			// PHASE 5.3: Console logging with detailed context
			if (options.showConsoleLog !== false) {
				const logPrefix = `[PromptNotificationService] [${type.toUpperCase()}]`
				
				if (type.includes('error')) {
					console.error(`${logPrefix} ${message}`, options.context)
				} else {
					console.log(`${logPrefix} ${message}`, options.context)
				}
			}

			// PHASE 5.3: System notification integration
			if (options.showSystemNotification !== false && this.shouldShowSystemNotification(type)) {
				vscode.postMessage({
					type: "showSystemNotification",
					notificationOptions: {
						title: options.title || this.getDefaultTitle(type),
						message: this.cleanMessageForNotification(message)
					}
				})
			}
		} catch (error) {
			// Fallback: Always log notification errors
			console.error(`[PromptNotificationService] Failed to show notification:`, error, { 
				type, 
				message, 
				options 
			})
		}
	}

	/**
	 * PHASE 5.3: Determine if system notification should be shown
	 */
	private shouldShowSystemNotification(type: PromptNotificationType): boolean {
		// Don't show system notifications for info/debug messages
		if (type === 'conflict-info') return false
		
		// Show for errors and important success messages
		return true
	}

	/**
	 * PHASE 5.3: Get default title for notification type
	 */
	private getDefaultTitle(type: PromptNotificationType): string {
		switch (type) {
			case 'activation-success':
			case 'replacement-success':
				return 'Prompt Activated'
			case 'deactivation-success':
				return 'Prompt Deactivated'
			case 'activation-error':
			case 'validation-error':
				return 'Prompt Error'
			case 'conflict-info':
				return 'Category Conflict'
			default:
				return 'Prompt Notification'
		}
	}

	/**
	 * PHASE 5.3: Clean message for system notification display
	 */
	private cleanMessageForNotification(message: string): string {
		// Remove emoji and clean up message for system notifications
		return message
			.replace(/[🔄✅❌⏳]/g, '') // Remove common emojis
			.replace(/^\s+|\s+$/g, '') // Trim whitespace
			.replace(/\s+/g, ' ') // Normalize whitespace
	}
}

/**
 * PHASE 5.3: Shared instance of the prompt notification service
 * 
 * Both slash commands and toolbar will use this same instance for
 * consistent notification behavior.
 */
export const promptNotificationService = new PromptNotificationService()