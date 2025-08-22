// oacode_change - new file
export function getUploadTemplateDescription(): string {
	return `## upload_template

Upload a YAML template file containing mode configurations to the workspace templates directory.

### Parameters:
- filename (required): Name of the template file (must end with .yaml or .yml)
- content (required): YAML content containing mode configurations
- overwrite (optional): Whether to overwrite existing file (default: false)

### YAML Template Format:
\`\`\`yaml
customModes:
  - slug: "mode-slug"
    name: "Mode Display Name"
    iconName: "codicon-icon-name"
    roleDefinition: "AI role description..."
    whenToUse: "When to use this mode..."
    description: "Short description"
    groups: ["read", "edit", "browser", "command"]
    customInstructions: "Additional instructions..."
\`\`\`

### Usage Examples:

Upload a new template:
\`\`\`xml
<upload_template>
<filename>data-analysis-template.yaml</filename>
<content>customModes:
  - slug: "data-scientist"
    name: "Data Scientist"
    iconName: "codicon-graph"
    roleDefinition: "You are a skilled data scientist specializing in statistical analysis, machine learning, and data visualization."
    whenToUse: "Use this mode for data science tasks, statistical modeling, and machine learning projects."
    description: "Expert in data science and ML"
    groups: ["read", "edit", "browser", "command"]
    customInstructions: "Focus on statistical rigor, reproducible analysis, and clear data visualizations. Always explain your methodology."
  - slug: "business-analyst"
    name: "Business Analyst" 
    iconName: "codicon-organization"
    roleDefinition: "You are a business analyst focused on requirements gathering, process analysis, and business intelligence."
    whenToUse: "Use for business requirements analysis, process improvement, and stakeholder communication."
    description: "Business requirements and process expert"
    groups: ["read", "edit", "browser"]
    customInstructions: "Think in terms of business value, ROI, and stakeholder needs. Create clear documentation and actionable recommendations."
</content>
</upload_template>
\`\`\`

Upload a simple testing template:
\`\`\`xml
<upload_template>
<filename>testing-modes.yaml</filename>
<content>customModes:
  - slug: "qa-tester"
    name: "QA Tester"
    iconName: "codicon-beaker"
    roleDefinition: "You are a quality assurance specialist focused on test planning, execution, and automation."
    whenToUse: "Use for testing tasks, test case creation, and quality assurance activities."
    description: "Quality assurance and testing expert"
    groups: ["read", "edit", "command"]
    customInstructions: "Focus on comprehensive test coverage, edge cases, and automated testing strategies."
</content>
</upload_template>
\`\`\`

Overwrite existing template:
\`\`\`xml
<upload_template>
<filename>existing-template.yaml</filename>
<content>customModes:
  - slug: "updated-mode"
    name: "Updated Mode"
    roleDefinition: "Updated role definition..."
    groups: ["read", "edit"]
</content>
<overwrite>true</overwrite>
</upload_template>
\`\`\`

Templates are stored in the \`.oacode/templates/\` directory and can be activated to load their modes into the interface.`
}