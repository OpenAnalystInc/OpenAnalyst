# OpenAnalyst Changelog

All notable changes to the OpenAnalyst extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Feature: Extended Templates with Prompts and Rules

Date: 2025-01-27 • Author: @harsh
Files: packages/types/src/mode.ts, src/core/templates/_, src/adapters/templates/_, src/core/config/TemplateManager.ts, src/core/prompts/sections/custom-instructions.ts

**WHY**

- Templates only supported Agents/modes, limiting configuration bundling capabilities
- Rules from templates didn't load immediately on template activation causing system prompt gaps
- No hot reload mechanism for prompts/rules from templates requiring manual refreshes
- Users needed unified configuration bundles for complete AI behavior customization

**Functionality**

- Templates now support three sections: Agents (existing), Prompts (new), and Rules (new)
- Hot reload works for all three block types with file system watching
- Template blocks appear in toolbar with source tracking ('template' badge)
- Rules from templates can be toggled in UI like file-based rules
- System prompt immediately includes template rules and prompts on activation
- Clean Architecture implementation with ports/adapters pattern

**BEFORE**

```yaml
# Templates only supported Agents
Agents:
    - slug: "data-analyst"
      name: "Data Analyst"
      roleDefinition: "..."
```

**AFTER**

```yaml
# Full configuration bundle with all three types
Agents:
    - slug: "data-analyst"
      name: "Data Analyst"
      roleDefinition: "..."

Prompts:
    - name: "eda-analysis"
      category: "analysis"
      content: "Perform exploratory data analysis..."
      variables: ["dataset_name"]

Rules:
    - name: "no-emojis"
      content: "Never use emojis in code"
      enabled: true
```

**Tests**

- Unit tests for ExtendedTemplate domain entity validation
- Unit tests for YAML parsing with invalid content
- Integration tests for hot reload flow
- Contract tests for repository and injector ports
- E2E tests for toolbar integration with template blocks

**Notes**

- Perf: Templates cached for 5 minutes, file watches debounced at 300ms
- Security: YAML content sanitized, no path traversal via template names
- Backwards compatible: Existing templates with only Agents continue working
- Migration: None required, new sections are optional
- Rollback: Disable extended template feature flag if needed

### Feature: Plan Mode Strategic Planning System

Date: 2025-01-22
Updated: 2025-09-23
Files: src/core/planmode/, src/adapters/planmode/, src/core/tools/exitPlanModeTool.ts, src/shared/tools.ts, src/core/assistant-message/presentAssistantMessage.ts, src/core/task/Task.ts, src/core/webview/ClineProvider.ts, webview-ui/src/components/chat/PlanMessage.tsx, webview-ui/src/components/chat/ChatRow.tsx

**WHY**

- Users requested strategic planning capability similar to Claude Code where AI creates comprehensive plans before execution.
- Need for structured approach to complex development tasks with phases and deliverables.
- Requirement for strict AI adherence to approved plans as binding contracts.
- Plans should be reusable blocks stored in filesystem for future similar requests.
- **CRITICAL ISSUE**: Original implementation failed - AI was completing tasks immediately instead of waiting for plan approval.

**ENHANCEMENT (2025-09-23)**

- Previous approach used system prompt instructions which were sometimes ignored.
- Now uses system reminders (higher priority) + ExitPlanMode tool (clear action).
- Problem: Tasks were being completed despite Plan Mode instructions.
- Solution: Implemented tool-based workflow for better control.

**Original Functionality**

- Implements Clean Architecture: Domain entities (PlanMode, ApprovedPlan) → Use cases (ApprovePlan, RejectPlan, ModifyPlan) → Adapters (VSCodePlanRepository, FileSystemPlanBlockStorage) → Framework (VS Code).
- Three workflow modes: PLAN (read-only research), CHAT/AGENT (execution following approved plan).
- System prompt injection enforces mode-specific behavior and includes approved plan content as binding contract.
- Plans displayed inline in chat with rounded corner UI, approve/modify/reject buttons with modal dialogs.
- Plan block storage system with 98% semantic matching threshold for reuse.
- Progress tracking with visual indicators showing phase completion and percentage.
- VS Code globalState persistence ensures plans survive extension restarts.
- Automatic plan detection in chat messages using content analysis patterns.

**Enhanced Functionality**

- **ExitPlanMode Tool**: New tool (`src/core/tools/exitPlanModeTool.ts`) that presents plans instead of completing tasks.
- **System Reminder**: Replaced verbose Plan Mode instructions with system reminder format that has absolute priority.
- **Tool-Based Workflow**: AI receives clear action (call exit_plan_mode tool) instead of just restrictions.
- **Workflow Persistence**: Fixed automatic fallback to 'chat' mode in ClineProvider.ts that was resetting Plan Mode.
- **Priority Override**: System reminders supercede all other instructions, preventing AI from ignoring Plan Mode.
- Translation support with planMode.json namespace.

**BEFORE**

```ts
// No strategic planning capability
switch (message.type) {
  case "text":
    return (
      <div>
        <Markdown markdown={message.text} partial={message.partial} />
      </div>
    )
}
```

**AFTER**

```ts
// Plan detection and specialized rendering
case "text":
  const isPlanContent = message.text && detectPlanContent(message.text)
  if (isPlanContent) {
    return (
      <div>
        <PlanMessage
          content={message.text}
          isApproved={false}
          approvedPlan={approvedPlan}
          workflowMode={workflowMode}
        />
      </div>
    )
  }
  return (
    <div>
      <Markdown markdown={message.text} partial={message.partial} />
    </div>
  )
```

**Tests**

- Domain entity validation tests for PlanMode and ApprovedPlan.
- Use case tests with mock repositories and storage adapters.
- Plan detection algorithm tests with various content patterns.
- Component rendering tests for PlanMessage with different states.

**Notes**

- Security: No sensitive data in plan storage, all user inputs validated.
- Performance: Lazy imports for plan mode modules, efficient plan detection regex.
- UX: Consistent VS Code theming, accessible modals, keyboard navigation support.
- Migration: Backward compatible, new fields optional in existing interfaces.

### Feature: Prompt Blocks System

Date: 2024-09-15
Files: src/core/blocks/, src/adapters/blocks/, webview-ui/src/components/chat/ActivePrompts.tsx, webview-ui/src/context/PromptBlocksContext.tsx

**WHY**

- Users needed specialized guidance for different data analysis tasks (EDA, visualization, reporting, methodology).
- Required a modular system to enhance system prompts with domain-specific expertise without hard-coding.
- Needed slash command integration for quick activation of analysis patterns.

**Functionality**

- Implements Clean Architecture with domain/use-cases/adapters separation.
- Provides 4 default prompt blocks: `/eda-analysis`, `/chart-visualization`, `/statistical-reporting`, `/data-methodology`.
- Slash command recognition and processing in chat interface.
- Priority-based block resolution: workspace � global � defaults.
- Category-based conflict resolution (max 1 block per category: analysis, visualization, reporting, methodology).
- React components for active blocks display with color-coded category pills.
- YAML-based configuration with validation and error handling.
- File system watching with 5-minute TTL caching.

**BEFORE**

```ts
// No specialized prompt guidance
await provider.initClineWithTask(message.text, message.images)
```

**AFTER**

```ts
// Slash command detection and prompt block activation
const slashCommandRegex = /^\/([a-zA-Z0-9_-]+)(\s|$)/
const match = processedText.match(slashCommandRegex)

if (match) {
	const commandName = match[1]
	const factory = PromptBlocksFactory.getInstance()
	const loadUseCase = factory.createLoadPromptBlocks(provider.context.extensionPath)
	const block = await loadUseCase.executeByName(commandName)

	if (block) {
		processedText = processedText.replace(slashCommandRegex, "").trim()
		console.log(`[PromptBlocks] Activated block: ${block.name}`)
		await provider.initClineWithTask(processedText, message.images)
		return
	}
}
```

**Tests**

- Core domain model unit tests for PromptBlock entity validation.
- File system repository tests for priority resolution and caching.
- YAML parser tests for block validation and error handling.
- Integration tests for slash command processing and UI components.
- TypeScript compilation validation with strict mode enabled.

**Notes**

- **Architecture**: Follows Clean Architecture with ports/adapters pattern. Core logic is framework-free.
- **Performance**: Lazy loading of blocks, 5-minute TTL caching, file system watching for changes.
- **Security**: YAML validation prevents code injection, no secret logging, path traversal protection.
- **UX**: Category-colored pills in UI, autocomplete in slash command menu, graceful error handling.
- **Extensibility**: Plugin architecture allows easy addition of new block types and categories.
- **Migration**: No breaking changes to existing modes.json or chat functionality.

---

## Infrastructure: Production-Grade Command Registry System

Date: 2024-09-15
Files: src/core/commands/, src/activate/registerCommands.ts, src/extension.ts

**WHY**

- Existing command registration lacked production-grade standards and proper architecture.
- Needed Clean Architecture separation with domain modeling and type safety.
- Required structured error handling, logging, and command lifecycle management.
- Missing validation, context requirements, and execution statistics.

**Functionality**

- Implements Clean Architecture with Command domain model and validation.
- Provides strongly-typed CommandId union type with namespace.category.action pattern.
- Command metadata includes category, priority, context requirements, and keybindings.
- Production-grade use case with execution context, error handling, and statistics.
- VS Code adapter with concrete command handlers and factory pattern.
- Hybrid registration system maintaining backward compatibility.
- Structured logging with correlation IDs and execution tracking.

**BEFORE**

```ts
// Direct VS Code command registration without validation or structure
export const registerCommands = (options: RegisterCommandOptions) => {
	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}
```

**AFTER**

```ts
// Production-grade command registry with Clean Architecture
export const registerCommands = async (options: RegisterCommandOptions) => {
	try {
		// Initialize production-grade command registry
		commandRegistry = new VSCodeCommandRegistry(context)
		await commandRegistry.initialize()

		// Register legacy commands for backward compatibility
		for (const [id, callback] of Object.entries(getCommandsMap(options))) {
			const command = getCommand(id as CommandId)
			context.subscriptions.push(vscode.commands.registerCommand(command, callback))
		}
	} catch (error) {
		// Graceful fallback to legacy system
	}
}

// Command domain model with validation
export class Command {
	static create(metadata: CommandMetadata): Command {
		// Validate command ID format, category matching, etc.
		return new Command(metadata)
	}
}
```

**Tests**

- Command domain model validation tests for ID format and metadata.
- Use case tests for command registration, execution, and error handling.
- Handler factory tests for command creation and caching.
- Integration tests for VS Code command registry adapter.

**Notes**

- **Architecture**: Follows Clean Architecture with ports/adapters pattern. Domain logic is framework-free.
- **Migration**: Hybrid approach maintains backward compatibility while introducing new system.
- **Performance**: Handler caching, lazy initialization, async execution with progress tracking.
- **Security**: Command validation prevents injection, execution context sanitization.
- **Observability**: Structured logging with correlation IDs, execution statistics, error tracking.
- **Extensibility**: Factory pattern enables easy addition of new command handlers.

---

## Development Infrastructure

### Feature: Production-Grade Logging System

Date: 2024-09-15
Files: src/core/infrastructure/Logger.ts, src/core/infrastructure/errors.ts

**WHY**

- Needed structured logging with development/production separation.
- Required debug log elimination in production builds for performance.
- Needed consistent error handling with typed error classes.
- Security requirement to prevent accidental logging of secrets or PII.

**Functionality**

- Structured logger with debug/info/warn/error levels.
- Development-only debug logs removed via `__DEV__` flag and dead code elimination.
- Typed error classes (ConfigError, IOError, ValidationError, OperationCancelledError).
- Automatic secret sanitization in log context.
- Correlation IDs for request tracking.
- Child logger support for namespacing.

**BEFORE**

```ts
console.log("Loading blocks from", path)
throw new Error("Block not found")
```

**AFTER**

```ts
const logger = new Logger("PromptBlocks")
logger.debug("Loading blocks from", { path, count: 4 }) // Removed in production
logger.info("Blocks loaded successfully", { count: 4 })

throw new ValidationError("BLOCK_NOT_FOUND", "Prompt block not found", {
	blockName: name,
	searchPaths: paths.map((p) => p.path),
})
```

**Tests**

- Logger output format validation.
- Debug log elimination in production builds.
- Error context preservation and sanitization.
- Secret redaction in log output.

**Notes**

- **Performance**: Debug logs have zero runtime cost in production via bundler dead code elimination.
- **Security**: Automatic sanitization of sensitive fields (password, secret, token, etc.).
- **Observability**: Structured logs with correlation IDs for distributed tracing.
- **Development**: Rich debugging information available in development builds.

---

## [1.0.0] - 2024-09-01

- Initial release of OpenAnalyst extension
- Basic chat interface and AI integration
- Template management system
- Chart.js visualization support
