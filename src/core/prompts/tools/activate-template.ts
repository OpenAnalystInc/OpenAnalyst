// oacode_change - new file
export function getActivateTemplateDescription(): string {
	return `## activate_template

Activate a YAML template to load its modes into the system.

### Parameters:
- template_name (required): Name of the template to activate

### Usage Examples:

Activate a data analysis template:
\`\`\`xml
<activate_template>
<template_name>data-analysis-template</template_name>
</activate_template>
\`\`\`

Activate a testing template:
\`\`\`xml
<activate_template>
<template_name>testing-modes</template_name>
</activate_template>
\`\`\`

Activate the default demo template:
\`\`\`xml
<activate_template>
<template_name>simple-test-template</template_name>
</activate_template>
\`\`\`

When a template is activated:
- Its modes are loaded and become available in the mode selector
- The template becomes the "active" template
- Previous template modes are replaced with the new ones
- Template modes appear alongside built-in modes in the interface
- You can then switch to any of the template modes using switch_mode

**Workflow Example:**
1. \`list_templates\` - See available templates
2. \`activate_template\` - Activate desired template 
3. \`switch_mode\` - Switch to one of the template modes (e.g. "data-scientist", "qa-tester")

Use \`list_templates\` first to see available templates and their modes.`
}