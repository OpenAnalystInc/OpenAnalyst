// oacode_change - new file
export function getDeleteTemplateDescription(): string {
	return `## delete_template

Permanently delete a YAML template file from the workspace.

### Parameters:
- template_name (required): Name of the template to delete

### Usage:
\`\`\`xml
<delete_template>
<template_name>my-template</template_name>
</delete_template>
\`\`\`

**Warning:** This action is permanent and will:
- Delete the template file from .oacode/templates/
- If the template is active, deactivate it first
- Remove all modes from that template
- Require confirmation before proceeding

Use list_templates to see available templates before deleting.`
}