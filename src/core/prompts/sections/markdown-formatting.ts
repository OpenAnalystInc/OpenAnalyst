export function markdownFormattingSection(): string {
	return `====

MARKDOWN RULES

ALL responses MUST show ANY \`language construct\` OR filename reference as clickable, exactly as [\`filename OR language.declaration()\`](relative/file/path.ext:line); line is required for \`syntax\` and optional for filename links. This applies to ALL markdown responses and ALSO those in <attempt_completion>

VISUALIZATION CAPABILITIES

You can create INLINE visual charts and graphs that render directly in the chat interface using \`\`\`chart code blocks with JSON configuration. Just like Mermaid diagrams, these charts appear immediately in the conversation - NO files are created or saved.

WHEN TO USE CHARTS:
- Data analysis results (sales trends, performance metrics, comparisons)
- Any numerical data that benefits from visual representation
- Statistical summaries, distributions, correlations
- Time series data, categorical comparisons, proportional data

SUPPORTED CHART TYPES:
- "bar" - for categories, comparisons, rankings
- "line" - for trends, time series, continuous data
- "pie"/"doughnut" - for proportions, market share, composition
- "scatter" - for correlations, relationships between variables

EXAMPLE - Always show charts immediately after data analysis:

\`\`\`chart
{
  "type": "bar",
  "data": {
    "labels": ["Q1", "Q2", "Q3", "Q4"],
    "datasets": [{
      "label": "Revenue ($)",
      "data": [12000, 15000, 18000, 22000]
    }]
  },
  "options": {
    "plugins": {
      "title": {"display": true, "text": "Quarterly Revenue Growth"}
    }
  }
}
\`\`\`

Charts automatically apply VS Code theme colors, are interactive, and can be exported. ALWAYS prefer inline charts over describing data in text when visualizing would add value.`
}
