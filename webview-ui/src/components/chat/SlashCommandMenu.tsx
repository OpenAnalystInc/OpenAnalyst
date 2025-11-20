import React, { useCallback, useRef, useEffect } from "react"
import { SlashCommand, getMatchingSlashCommands } from "@/utils/slash-commands"
import { useExtensionState } from "@/context/ExtensionStateContext" // oacode_change
import { usePromptBlocks } from "@/context/PromptBlocksContext"
import { getCategoryDisplayName } from "@/utils/prompt-blocks"

interface SlashCommandMenuProps {
	onSelect: (command: SlashCommand) => void
	selectedIndex: number
	setSelectedIndex: (index: number) => void
	onMouseDown: () => void
	query: string
	customModes?: any[]
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
	onSelect,
	selectedIndex,
	setSelectedIndex,
	onMouseDown,
	query,
	customModes,
}) => {
	const { localWorkflows, globalWorkflows } = useExtensionState() // oacode_change
	const { availableBlocks } = usePromptBlocks()

	// Debug: Test with fake blocks to verify the conversion works
	const testBlocks = __DEV__ ? [
		{ name: "test-eda", description: "Test EDA block", category: "analysis" as const, tags: [], priority: 80, enabled: true }
	] : []
	const blocksToUse = availableBlocks.length > 0 ? availableBlocks : testBlocks
	const menuRef = useRef<HTMLDivElement>(null)

	const handleClick = useCallback(
		(command: SlashCommand) => {
			onSelect(command)
		},
		[onSelect],
	)

	// Auto-scroll logic remains the same...
	useEffect(() => {
		if (menuRef.current) {
			const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement
			if (selectedElement) {
				const menuRect = menuRef.current.getBoundingClientRect()
				const selectedRect = selectedElement.getBoundingClientRect()

				if (selectedRect.bottom > menuRect.bottom) {
					menuRef.current.scrollTop += selectedRect.bottom - menuRect.bottom
				} else if (selectedRect.top < menuRect.top) {
					menuRef.current.scrollTop -= menuRect.top - selectedRect.top
				}
			}
		}
	}, [selectedIndex])

	// Filter commands based on query
	const filteredCommands = getMatchingSlashCommands(query, customModes, localWorkflows, globalWorkflows, blocksToUse) // oacode_change

	// Debug logging (only in development)
	if (__DEV__) {
		console.log("[SlashCommands] Available blocks:", blocksToUse?.length || 0, blocksToUse?.map(b => b.name))
		console.log("[SlashCommands] Filtered commands:", filteredCommands.length, filteredCommands.map(c => `${c.name}${c.section === 'prompts' ? ' (prompt)' : ''}`))
	}

	return (
		<div
			className="absolute bottom-[calc(100%-10px)] left-[15px] right-[15px] overflow-x-hidden z-[1000]"
			onMouseDown={onMouseDown}>
			<div
				ref={menuRef}
				className="bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-editorGroup-border)] rounded-[3px] shadow-[0_4px_10px_rgba(0,0,0,0.25)] flex flex-col max-h-[200px] overflow-y-auto" // Corrected rounded and shadow
			>
				{filteredCommands.length > 0 ? (
					filteredCommands.map((command, index) => (
						<div
							key={command.name}
							className={`py-2 px-3 cursor-pointer flex flex-col border-b border-[var(--vscode-editorGroup-border)] ${
								// Corrected padding
								index === selectedIndex
									? "bg-[var(--vscode-quickInputList-focusBackground)] text-[var(--vscode-quickInputList-focusForeground)]"
									: "" // Removed bg-transparent
							} hover:bg-[var(--vscode-list-hoverBackground)]`}
							onClick={() => handleClick(command)}
							onMouseEnter={() => setSelectedIndex(index)}>
							<div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
								/{command.name}
								{command.section === "prompts" && command.category && (
									<span className="text-xs text-[var(--vscode-descriptionForeground)]">
										{getCategoryDisplayName(command.category)}
									</span>
								)}
							</div>
							<div className="text-[0.85em] text-[var(--vscode-descriptionForeground)] whitespace-normal overflow-hidden text-ellipsis">
								{command.description}
							</div>
						</div>
					))
				) : (
					<div className="py-2 px-3 cursor-default flex flex-col">
						{" "}
						{/* Corrected padding, removed border, changed cursor */}
						<div className="text-[0.85em] text-[var(--vscode-descriptionForeground)]">
							No matching commands found
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export default SlashCommandMenu
