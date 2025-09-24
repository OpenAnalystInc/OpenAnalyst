import { ToolArgs } from "./types"

export function getAttemptCompletionDescription(args?: ToolArgs): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.

CRITICAL PLAN MODE RESTRICTION: DO NOT use this tool when you are in Plan Mode and have just created a plan. In Plan Mode, creating a plan is NOT completing the task - it's a preparatory step. Use the exit_plan_mode tool instead to present your plan for approval. Only use attempt_completion after you have executed an approved plan and completed the actual work.

IMPORTANT DISTINCTIONS:
- Planning Phase: Use exit_plan_mode (presents plan for approval)
- Execution Phase: Use attempt_completion (presents completed work)

IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>

Example: Requesting to attempt completion with a result
<attempt_completion>
<result>
I've updated the CSS
</result>
</attempt_completion>`
}
