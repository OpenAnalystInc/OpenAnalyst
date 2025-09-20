// Prompt blocks utilities for webview integration

import { vscode } from "@/utils/vscode"

// Mirror the core domain interfaces for webview use
export interface PromptBlockInfo {
	name: string
	description: string
	category: "analysis" | "visualization" | "reporting" | "methodology"
	tags: string[]
	priority: number
	enabled: boolean
}

export interface ActivePromptBlockInfo {
	block: PromptBlockInfo
	variables?: Record<string, string>
	priority?: number
}

/**
 * Extended slash command interface to support prompt blocks
 */
export interface PromptBlockSlashCommand {
	name: string
	description?: string
	section: "prompts" | "default" | "custom"
	category?: string
	promptBlock?: PromptBlockInfo
}

/**
 * Request available prompt blocks from the extension
 */
export async function loadAvailablePromptBlocks(): Promise<PromptBlockInfo[]> {
	return new Promise((resolve) => {
		const listener = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "promptBlocksLoaded") {
				window.removeEventListener("message", listener)
				resolve(message.blocks || [])
			}
		}

		window.addEventListener("message", listener)
		
		// Request prompt blocks from extension
		vscode.postMessage({
			type: "loadPromptBlocks"
		})

		// Timeout fallback
		setTimeout(() => {
			window.removeEventListener("message", listener)
			resolve([])
		}, 5000)
	})
}

/**
 * Request to add a prompt block to active prompts
 */
export function addActivePromptBlock(blockName: string, variables?: Record<string, string>): void {
	vscode.postMessage({
		type: "addActivePromptBlock",
		blockName,
		variables
	})
}

/**
 * Request to remove a prompt block from active prompts
 */
export function removeActivePromptBlock(blockName: string): void {
	vscode.postMessage({
		type: "removeActivePromptBlock",
		blockName
	})
}

/**
 * Request current active prompt blocks
 */
export async function getActivePromptBlocks(): Promise<ActivePromptBlockInfo[]> {
	return new Promise((resolve) => {
		const listener = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "activePromptBlocksLoaded") {
				window.removeEventListener("message", listener)
				resolve(message.activeBlocks || [])
			}
		}

		window.addEventListener("message", listener)
		
		vscode.postMessage({
			type: "getActivePromptBlocks"
		})

		// Timeout fallback
		setTimeout(() => {
			window.removeEventListener("message", listener)
			resolve([])
		}, 3000)
	})
}

/**
 * Convert prompt blocks to slash commands
 */
export function promptBlocksToSlashCommands(blocks: PromptBlockInfo[]): PromptBlockSlashCommand[] {
	return blocks.map(block => ({
		name: block.name,
		description: block.description,
		section: "prompts" as const,
		category: block.category,
		promptBlock: block
	}))
}

/**
 * Get category display name with icon
 */
export function getCategoryDisplayName(category: string): string {
	switch (category) {
		case "analysis": return "📊 Analysis"
		case "visualization": return "📈 Visualization"  
		case "reporting": return "📋 Reporting"
		case "methodology": return "🔬 Methodology"
		default: return category
	}
}

/**
 * Group slash commands by section for better organization
 */
export function groupSlashCommands(commands: PromptBlockSlashCommand[]): Record<string, PromptBlockSlashCommand[]> {
	return commands.reduce((groups, command) => {
		const section = command.section || "default"
		if (!groups[section]) {
			groups[section] = []
		}
		groups[section].push(command)
		return groups
	}, {} as Record<string, PromptBlockSlashCommand[]>)
}