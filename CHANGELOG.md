# OpenAnalyst Changelog

All notable changes to the OpenAnalyst extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Feature: Prompt Blocks System
Date: 2024-09-15 " Author: @claude
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
Date: 2024-09-15 • Author: @claude
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
Date: 2024-09-15 " Author: @claude
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
console.log('Loading blocks from', path)
throw new Error('Block not found')
```

**AFTER**
```ts
const logger = new Logger('PromptBlocks')
logger.debug('Loading blocks from', { path, count: 4 }) // Removed in production
logger.info('Blocks loaded successfully', { count: 4 })

throw new ValidationError('BLOCK_NOT_FOUND', 'Prompt block not found', {
  blockName: name,
  searchPaths: paths.map(p => p.path)
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