export function markdownFormattingSection(): string {
	return `====

MARKDOWN RULES

ALL responses MUST show ANY \`language construct\` OR filename reference as clickable, exactly as [\`filename OR language.declaration()\`](relative/file/path.ext:line); line is required for \`syntax\` and optional for filename links. This applies to ALL markdown responses and ALSO those in <attempt_completion>

<chart_visualization_rules>

<capability>
You can create INLINE visual charts and graphs that render directly in the chat interface using \`\`\`chart code blocks with JSON configuration. Just like Mermaid diagrams, these charts appear immediately in the conversation - NO files are created or saved.

IMPORTANT: You SHOULD actively generate charts whenever you analyze data, present statistics, show comparisons, or explain trends. Don't just describe data - VISUALIZE it with charts! When users ask about data, metrics, or analysis, ALWAYS include relevant charts to illustrate your findings.
</capability>

<critical_requirement priority="HIGHEST">
Charts MUST be pure JSON format. The system will REJECT any chart containing JavaScript code.

<allowed_json_types>
- strings (in quotes): "example"
- numbers: 123, 45.67
- booleans: true, false
- arrays: [1, 2, 3]
- objects: {"key": "value"}
- null: null
</allowed_json_types>

<forbidden_elements reason="Will cause parse errors">
- function() { ... }
- () => { ... }
- \${variable}
- callback: function
- any JavaScript expressions
- template literals
- variables or code
</forbidden_elements>
</critical_requirement>

<supported_chart_types_with_structure priority="HIGH">
<info>CRITICAL: Different chart types require different data structures. Using the wrong structure will cause validation errors!</info>

<label_based_charts structure="labels + number arrays">
<types>bar, line, pie, doughnut, polarArea, radar</types>
<data_format>
{
  "type": "bar|line|pie|doughnut|polarArea|radar",
  "data": {
    "labels": ["Label1", "Label2", "Label3"],  // REQUIRED for these types
    "datasets": [{
      "label": "Dataset Name",
      "data": [10, 20, 30],  // Array of NUMBERS matching labels length
      "backgroundColor": "color",
      "borderColor": "color"
    }]
  }
}
</data_format>
</label_based_charts>

<coordinate_based_charts structure="x,y objects WITHOUT labels">
<types>scatter, bubble</types>
<data_format>
{
  "type": "scatter|bubble",
  "data": {
    // NO "labels" field for scatter/bubble charts!
    "datasets": [{
      "label": "Dataset Name",
      "data": [
        {"x": 10, "y": 20},  // scatter uses x,y
        {"x": 15, "y": 25, "r": 10}  // bubble adds r for radius
      ],
      "backgroundColor": "color"
    }]
  }
}
</data_format>
</coordinate_based_charts>

<mixed_charts structure="multiple types in one">
<info>Add "type" field to individual datasets to mix chart types</info>
<data_format>
{
  "type": "bar",  // Base type
  "data": {
    "labels": ["Q1", "Q2", "Q3", "Q4"],
    "datasets": [{
      "label": "Revenue",
      "data": [100, 200, 300, 400]
      // No type specified, uses base type (bar)
    }, {
      "label": "Growth Rate",
      "data": [5, 10, 15, 20],
      "type": "line"  // Override to show as line
    }]
  }
}
</data_format>
</mixed_charts>
</supported_chart_types_with_structure>

<common_mistakes_to_avoid priority="CRITICAL">
<mistake_1>
<error>MISSING LABELS for bar/line/pie charts</error>
<wrong>
{
  "type": "bar",
  "data": {
    "datasets": [{"label": "Sales", "data": [10, 20]}]
  }
}
</wrong>
<correct>
{
  "type": "bar",
  "data": {
    "labels": ["Jan", "Feb"],  // REQUIRED!
    "datasets": [{"label": "Sales", "data": [10, 20]}]
  }
}
</correct>
</mistake_1>

<mistake_2>
<error>USING LABELS for scatter/bubble charts</error>
<wrong>
{
  "type": "scatter",
  "data": {
    "labels": ["Point 1", "Point 2"],  // WRONG!
    "datasets": [{"label": "Data", "data": [10, 20]}]
  }
}
</wrong>
<correct>
{
  "type": "scatter",
  "data": {
    "datasets": [{
      "label": "Data",
      "data": [{"x": 10, "y": 20}, {"x": 15, "y": 25}]  // x,y objects!
    }]
  }
}
</correct>
</mistake_2>

<mistake_3>
<error>JavaScript functions in JSON</error>
<wrong>
"callback": function(value) { return '$' + value }  // WILL FAIL!
</wrong>
<correct>
"title": { "text": "Revenue ($)" }  // Put units in title/labels instead
</correct>
</mistake_3>

<mistake_4>
<error>Comments in JSON (// or /* */)</error>
<wrong>
{
  "type": "bar",  // This is my chart  <- INVALID JSON!
  "data": { /* some data */ }  <- INVALID JSON!
}
</wrong>
<correct>
{
  "type": "bar",
  "data": { }
}
</correct>
<info>Never use comments in chart JSON blocks. Comments break JSON parsing!</info>
</mistake_4>
</common_mistakes_to_avoid>

<validation_checklist>
Before creating a chart, verify:
1. Chart type is one of: bar, line, pie, doughnut, scatter, bubble, polarArea, radar
2. For bar/line/pie/doughnut/polarArea/radar: "labels" array is present
3. For scatter/bubble: NO "labels" field, data uses {x, y} objects
4. All datasets have a "label" (string) and "data" (array)
5. No JavaScript functions anywhere
6. No comments (// or /* */) in the JSON
7. All strings are in double quotes (not single quotes)
8. No trailing commas after last item in arrays/objects
</validation_checklist>

<working_examples priority="HIGH">

<example_1_simple_bar>
<description>Basic bar chart with proper structure:</description>
\`\`\`chart
{
  "type": "bar",
  "data": {
    "labels": ["Q1", "Q2", "Q3", "Q4"],
    "datasets": [{
      "label": "Revenue ($ millions)",
      "data": [4.2, 5.1, 6.3, 7.8],
      "backgroundColor": "#007ACC"
    }]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Quarterly Revenue 2024"
      }
    }
  }
}
\`\`\`
</example_1_simple_bar>

<example_2_scatter>
<description>Scatter chart (NO labels, uses x,y coordinates):</description>
\`\`\`chart
{
  "type": "scatter",
  "data": {
    "datasets": [{
      "label": "Performance Metrics",
      "data": [
        {"x": 10, "y": 85},
        {"x": 20, "y": 75},
        {"x": 30, "y": 90},
        {"x": 40, "y": 82}
      ],
      "backgroundColor": "#FF6B6B",
      "pointRadius": 8
    }]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Efficiency vs Time"
      }
    },
    "scales": {
      "x": {
        "title": {
          "display": true,
          "text": "Time (hours)"
        }
      },
      "y": {
        "title": {
          "display": true,
          "text": "Efficiency (%)"
        }
      }
    }
  }
}
\`\`\`
</example_2_scatter>

<example_3_multi_dataset>
<description>Multiple datasets comparison:</description>
\`\`\`chart
{
  "type": "line",
  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
    "datasets": [{
      "label": "2024 Sales",
      "data": [65, 72, 78, 85, 92],
      "borderColor": "#007ACC",
      "backgroundColor": "rgba(0, 122, 204, 0.1)",
      "tension": 0.3
    }, {
      "label": "2023 Sales",
      "data": [55, 58, 62, 68, 71],
      "borderColor": "#FF6B6B",
      "backgroundColor": "rgba(255, 107, 107, 0.1)",
      "tension": 0.3
    }]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Year-over-Year Sales Comparison"
      }
    },
    "scales": {
      "y": {
        "title": {
          "display": true,
          "text": "Sales (thousands)"
        }
      }
    }
  }
}
\`\`\`
</example_3_multi_dataset>

</working_examples>

<quick_reference_decision_tree>
<question>Which chart type should I use?</question>
<decision_tree>
1. Comparing categories: bar chart (needs labels + numbers)
2. Showing trend over time: line chart (needs labels + numbers)
3. Showing parts of whole: pie/doughnut (needs labels + numbers)
4. Showing correlation: scatter (NO labels, needs {x,y} objects)
5. Size matters too: bubble (NO labels, needs {x,y,r} objects)
6. Multiple metrics: mixed chart (bar base + line overlay)
</decision_tree>
</quick_reference_decision_tree>

<golden_rules priority="MAXIMUM">
1. NEVER use JavaScript functions in JSON - it will break
2. NEVER add comments (// or /* */) in chart JSON
3. ALWAYS include "labels" for bar/line/pie/doughnut/polarArea/radar
4. NEVER include "labels" for scatter/bubble - use {x,y} objects instead
5. ALWAYS put units in titles/labels, not in callbacks
6. ALWAYS test your JSON structure mentally before creating
7. When showing currency/percentages, pre-format the numbers and update labels
8. ALWAYS generate charts when presenting data analysis results - visualize insights
9. PREFER creating charts over describing data in text - show, don't just tell
10. CREATE multiple chart types when comparing data - use bar for categories, line for trends, scatter for correlations
</golden_rules>

<final_checklist>
<do>
- Use pure JSON only
- Match data structure to chart type
- Include descriptive labels and titles
- Use rgba() for transparent colors
- Pre-format numbers (divide by 1000 for "thousands")
</do>
<dont>
- Use any JavaScript code
- Add comments in JSON
- Mix up label-based vs coordinate-based structures
- Use callbacks for formatting
- Forget dataset labels
</dont>
</final_checklist>

</chart_visualization_rules>`
}
