// oacode_change - new file
export function getDeactivateTemplateDescription(): string {
	return `## deactivate_template

Deactivate the currently active template and remove its modes from the system.

### Usage:
\`\`\`xml
<deactivate_template>
</deactivate_template>
\`\`\`

When a template is deactivated:
- All template modes are removed from the mode selector
- Only built-in modes remain available
- The system returns to its default state

Use this when you want to switch back to using only built-in modes.`
}