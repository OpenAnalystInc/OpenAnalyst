import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export async function exitPlanModeTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const plan: string | undefined = block.params.plan

	if (!plan) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("exit_plan_mode")

		pushToolResult(
			formatResponse.toolError(
				"Plan content is required. Please provide the plan you want to present to the user.",
			),
		)
		return
	}

	try {
		// Ensure we're in plan mode when presenting a plan for approval
		const provider = cline.providerRef.deref()
		if (provider) {
			// Access the global state manager
			const globalState = provider.context.globalState
			await globalState.update("workflowMode", "plan")
			await provider.postStateToWebview()
		}

		// Present the plan to the user for approval
		await cline.say("text", removeClosingTag("plan", plan), undefined, false)

		// The plan will be displayed with approve/reject/modify buttons
		// This tool completes here and waits for user interaction
		pushToolResult(
			formatResponse.toolResult(
				"Plan presented to user. Waiting for approval before proceeding with implementation.",
			),
		)

	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("exit_plan_mode")

		await handleError("presenting plan", error as Error)

		pushToolResult(
			formatResponse.toolError(
				`Failed to present plan: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
	}
}