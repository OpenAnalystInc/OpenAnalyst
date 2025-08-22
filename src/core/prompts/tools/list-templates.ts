// oacode_change - new file
export function getListTemplatesDescription(): string {
	return `## list_templates

List all available YAML templates in the workspace and show their status.

### Usage:
\`\`\`xml
<list_templates>
</list_templates>
\`\`\`

### Example Output:
\`\`\`
Available Templates:

✅ data-modes-template (ACTIVE)
   📊 5 modes: Data Analyst, Data Scientist, Data Engineer, Business Analyst, Research Analyst

📄 testing-modes
   🧪 2 modes: QA Tester, Test Automation Engineer

📄 web-dev-template  
   🌐 3 modes: Frontend Developer, Backend Developer, DevOps Engineer
\`\`\`

Shows:
- All available templates in .oacode/templates/
- Number of modes in each template
- Which template is currently active (marked with ✅)
- Mode names and descriptions for each template
- Template file names

Use this before \`activate_template\` to see available options.`
}