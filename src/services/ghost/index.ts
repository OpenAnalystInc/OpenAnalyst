// oacode_change - new file
import * as vscode from "vscode"
import { GhostProvider } from "./GhostProvider"
import { ClineProvider } from "../../core/webview/ClineProvider"

export const registerGhostProvider = (context: vscode.ExtensionContext, cline: ClineProvider) => {
	const ghost = GhostProvider.initialize(context, cline)

	// Register GhostProvider Commands
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.reload", async () => {
			await ghost.reload()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.codeActionQuickFix", async () => {
			return
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.generateSuggestions", async () => {
			ghost.codeSuggestion()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.cancelSuggestions", async () => {
			ghost.cancelSuggestions()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.applyAllSuggestions", async () => {
			ghost.applyAllSuggestions()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.applyCurrentSuggestions", async () => {
			ghost.applySelectedSuggestions()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.promptCodeSuggestion", async () => {
			await ghost.promptCodeSuggestion()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.goToNextSuggestion", async () => {
			await ghost.selectNextSuggestion()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.goToPreviousSuggestion", async () => {
			await ghost.selectPreviousSuggestion()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.showIncompatibilityExtensionPopup", async () => {
			await ghost.showIncompatibilityExtensionPopup()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.cancelRequest", async () => {
			await ghost.cancelRequest()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.enable", async () => {
			await ghost.enable()
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("oa-code.ghost.disable", async () => {
			await ghost.disable()
		}),
	)

	// Register GhostProvider Code Actions
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider("*", ghost.codeActionProvider, {
			providedCodeActionKinds: Object.values(ghost.codeActionProvider.providedCodeActionKinds),
		}),
	)

	// Register GhostProvider Code Lens
	context.subscriptions.push(vscode.languages.registerCodeLensProvider("*", ghost.codeLensProvider))
}
