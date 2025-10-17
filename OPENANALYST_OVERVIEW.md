# What is OpenAnalyst?

**What's at the core of OpenAnalyst and how can you use it?**

OpenAnalyst is an intelligent, AI-powered VS Code extension that transforms how data teams work. It merges AI-driven autonomous coding with reusable templates and specialized agents, enabling teams to collaborate, standardize workflows, and deliver insights faster than traditional methods.

Whether you're a data scientist, analyst, or business intelligence professional, OpenAnalyst helps you build shareable, transparent workflows that eliminate setup bottlenecks and accelerate time-to-insight—from weeks to hours.

## Key Features

- **Specialized AI agents** for every data role
- **Template-driven collaboration** via shareable configurations
- **Natural language to code** with 35+ intelligent tools
- **Instant team onboarding** through auto-import settings
- **Inline visualizations** that render directly in your workspace

## Under the Hood

OpenAnalyst is powered by advanced LLMs (Claude, GPT-4, Gemini, and 15+ providers) with a unique multi-agent architecture. Each agent is a specialized expert—Data Analyst, Data Scientist, Data Engineer, Business Analyst, or Research Analyst—with domain-specific instructions and tool access.

It's designed to autonomously execute multi-step tasks, delegate to specialized agents when needed, and capture the entire process for team learning and iteration. OpenAnalyst also supports template-based knowledge sharing, making organizational standards instantly accessible to every team member.

---

## Who Can Use OpenAnalyst?

**Data Teams & Analytics Organizations**: Who need to standardize workflows, share best practices, and onboard new members without weeks of training.

**Startups and Lean Teams**: Requiring powerful AI assistance for data work without building custom infrastructure or lengthy prompt engineering.

**Cross-Functional Teams**: (Product, marketing, operations) who want to collaborate on data-driven decisions with consistent methodologies.

**Enterprise Data Departments**: Looking to encode institutional knowledge, ensure compliance with data governance rules, and accelerate insight delivery across dozens of analysts.

---

## OpenAnalyst Tools and Features

### Templates in OpenAnalyst

**Templates turn tribal knowledge into shareable assets.**

OpenAnalyst Templates let you:

- **Define specialized agents** with custom roles, instructions, and tool permissions
- **Share reusable prompts** for common analyses (cohort analysis, churn prediction, A/B testing)
- **Encode organizational rules** (PII handling, approved libraries, reporting formats)
- **Export and import configurations** in one click via JSON
- **Auto-load team standards** on startup with zero manual setup

**Use Cases**:
- A data team lead creates a "fintech-analysis" template with 5 specialized agents and 20 reusable prompts
- New team member joins, imports `company-config.json`, and is productive on day one
- Marketing team shares a "campaign-analysis" template across regional offices for consistency

Templates make OpenAnalyst your **team's shared knowledge base**, accessible to every member with standards automatically enforced.

---

### Agents in OpenAnalyst

**Agents turn generic AI into domain experts.**

OpenAnalyst Agents let you:

- **Deploy specialists** for specific tasks (Data Analyst for exploration, Data Scientist for modeling, Data Engineer for pipelines)
- **Delegate complex workflows** where an Orchestrator agent coordinates multiple specialists
- **Restrict tool access** per role (e.g., Business Analysts can't modify production code, only documentation)
- **Follow proven methodologies** encoded in each agent's custom instructions
- **Switch contexts instantly** by changing agents mid-task

**Use Cases**:
- A Data Analyst agent explores customer data and creates inline visualizations
- When ML modeling is needed, it delegates to a Data Scientist agent via `new_task`
- A Business Analyst agent calculates ROI while a Research Analyst gathers competitive intelligence
- All results synthesized by the Orchestrator into a comprehensive report

Agents blend specialization, autonomy, and collaboration—making OpenAnalyst your **AI data team**.

---

### Configuration Transfer in OpenAnalyst

**Configuration Transfer turns hours of setup into seconds.**

With Configuration Transfer, you can:

- **Export entire workspace settings** including API keys, custom agents, and provider configs to JSON
- **Import configurations** from teammates, merging settings without overwriting local customizations
- **Auto-import on startup** by setting `autoImportSettingsPath` in VS Code settings
- **Version control configs** in Git for team-wide updates and rollbacks
- **Share templates** via YAML files containing agents, prompts, and rules

**Use Cases**:
- A team lead exports their optimized setup: `oa-code-settings.json`
- 10 team members import it simultaneously—everyone has identical configurations in 30 seconds
- Company updates data governance rules, pushes new template to Git, everyone auto-imports on next launch
- Consultant delivers project with template included for client team continuity

Configuration Transfer ensures **zero-friction collaboration** and **instant standardization** across your entire data organization.

---

### Inline Visualizations in OpenAnalyst

**Inline visualizations eliminate context switching.**

OpenAnalyst connects directly to your code and renders charts in your workspace with no file exports.

With Inline Visualizations, you can:

- **Create charts instantly** using ` ```chart ` code blocks that render like Mermaid diagrams
- **Iterate faster** by seeing visualizations immediately after analysis runs
- **Stay in flow** without switching between IDE, notebook, and image viewers
- **Share visual insights** embedded directly in chat history
- **Support all major chart types**: bar, line, pie, scatter, heatmaps

**Use Cases**:
- A Data Analyst runs cohort analysis and creates a retention heatmap—rendered inline in 2 seconds
- A Data Scientist compares model performance with side-by-side ROC curves in the chat window
- A product team reviews A/B test results with bar charts generated on-demand during the conversation

Inline Visualizations make OpenAnalyst your **fastest path from question to insight**.

---

### Task Orchestration in OpenAnalyst

**Task Orchestration breaks complexity into manageable steps.**

OpenAnalyst's Orchestrator mode lets you:

- **Decompose complex projects** into subtasks assigned to specialized agents
- **Run parallel analyses** with multiple agents working simultaneously
- **Track hierarchical workflows** with visual subtask trees (`@parent@child` syntax)
- **Aggregate results automatically** from all subtasks into final deliverable
- **Resume interrupted work** from checkpoints without losing context

**Use Cases**:
- Market analysis project: Research Analyst finds competitors → Data Analyst analyzes survey data → Business Analyst calculates ROI → All synthesized into executive summary
- ML pipeline: Data Engineer builds ETL → Data Scientist trains model → Data Analyst creates evaluation dashboard
- Quarterly reporting: 5 agents run parallel analyses on different metrics, Orchestrator compiles into single report

Task Orchestration turns OpenAnalyst into your **AI project manager** for data work.

---

## Why OpenAnalyst is Different

### Traditional Method
```
New employee joins data team
↓
Reads 50 pages of documentation
↓
Manually configures IDE, installs libraries
↓
Learns company conventions through trial and error
↓
Writes first useful analysis after 2-3 weeks
```

### OpenAnalyst Method
```
New employee joins data team
↓
Imports company-analytics.json (30 seconds)
↓
Activates team template with 5 specialized agents
↓
AI follows company standards automatically
↓
Delivers first insight within 1 hour
```

---

## Getting Started

1. **Install OpenAnalyst** extension in VS Code
2. **Import your team's config** (if available) or start fresh
3. **Activate a template** from the example library or create your own
4. **Select an agent** (Data Analyst recommended for first use)
5. **Ask your question** in natural language and let OpenAnalyst work

**Example first task**:
> "Load sales_data.csv, analyze Q4 trends by region, and create a bar chart comparing top 5 performing regions"

OpenAnalyst will:
- Read your data file
- Generate Python/pandas code
- Run the analysis
- Create an inline bar chart
- Explain key findings

All in minutes, not hours.

---

## Open Source & Extensible

OpenAnalyst is **fully open source** with:
- No vendor lock-in (bring your own API keys)
- Support for local models (Ollama, LMStudio)
- MCP (Model Context Protocol) integration for custom tools
- Active community contributions
- Transparent codebase you can audit and extend

Built on the evolution of **Cline → Roo Code → KiloCode**, OpenAnalyst combines the best of each while pioneering **template-driven collaboration** for data teams.

---

## Learn More

- **GitHub**: [OpenAnalystInc/OpenAnalyst](https://github.com/OpenAnalystInc/OpenAnalyst)
- **Website**: [openanalyst.com](https://openanalyst.com)
- **Discord**: Join our community for support and templates
- **Documentation**: Full guides for templates, agents, and workflows

---

**OpenAnalyst: Empowering data teams to deliver insights faster through AI collaboration, not replacement.**
