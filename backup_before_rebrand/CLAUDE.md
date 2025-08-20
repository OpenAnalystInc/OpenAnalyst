# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Development:**

- `pnpm install` - Install all dependencies across monorepo
- `F5` in VS Code - Launch extension in debug mode with hot reload
- `pnpm build` or `pnpm vsix` - Build production .vsix package
- `pnpm install:vsix` - Install built extension locally

**Quality Assurance:**

- `pnpm lint` - Run ESLint across all packages
- `pnpm check-types` - TypeScript type checking
- `pnpm test` - Run unit tests for extension and webview
- `pnpm format` - Format code with Prettier

**Monorepo Management:**

- `pnpm clean` - Clean all build artifacts and turbo cache
- `pnpm changeset` - Create changeset for version bumps
- Turbo-powered tasks run across all packages in workspace

## Architecture Overview

**Monorepo Structure:**

- `src/` - Main VS Code extension code
- `webview-ui/` - React-based frontend UI
- `packages/` - Shared packages (types, telemetry, config, etc.)
- `apps/` - Additional applications (e2e tests, storybook, web apps)

**Core Extension (`src/`):**

- `core/` - Core business logic including Task management, tool execution, and AI provider integration
- `api/providers/` - AI model provider implementations (Anthropic, OpenAI, etc.)
- `services/` - Platform services (terminal, browser, git, etc.)
- `webview/ClineProvider.ts` - Main webview communication hub
- `extension.ts` - VS Code extension entry point

**Key Components:**

- **Task System**: Central orchestration in `src/core/task/Task.ts`
- **Tools**: AI agent tools in `src/core/tools/` for file operations, terminal commands, etc.
- **Provider API**: Abstracted AI provider interface in `src/api/`
- **MCP Integration**: Model Context Protocol servers for extending capabilities

**Webview UI (`webview-ui/`):**

- React-based chat interface with VS Code theming
- Real-time communication with extension via postMessage API
- Shared types from `packages/types/`

## Testing Strategy

**Unit Tests:**

- Extension tests in `src/__tests__/`
- Webview tests in `webview-ui/src/__tests__/`
- Provider tests in `src/api/providers/__tests__/`

**E2E Tests:**

- VS Code extension tests in `apps/vscode-e2e/`
- Playwright browser tests in `apps/playwright-e2e/`

**Run single test file:**

```bash
pnpm test <test-file-pattern>
```

## Code Guidelines

**Kilocode Changes:**

- Mark all Kilocode-specific changes with `// kilocode_change` comments
- For multi-line changes use `// kilocode_change start/end` blocks
- Files/directories containing "kilocode" in name don't need marking
- New files should have `// kilocode_change - new file` at top

**Git Workflow:**

- Pre-commit: Prevents direct commits to `main`, runs linting
- Pre-push: Prevents direct pushes to `main`, runs type checking, reminds about changesets
- Use feature branches and PR workflow

**Package Management:**

- Uses pnpm with workspace support
- Node.js v20.19.2 required
- All packages defined in `pnpm-workspace.yaml`

## Development Notes

**Hot Reload:**

- Webview changes appear immediately
- Core extension changes trigger automatic reload in development
- Production builds require manual restart

**Key Files for Understanding:**

- `packages/types/src/` - Shared TypeScript interfaces
- `src/core/webview/webviewMessageHandler.ts` - Extension-webview communication
- `src/core/prompts/system.ts` - AI system prompts
- `src/shared/` - Utilities shared between extension and webview

**VS Code Integration:**

- Extension uses VS Code API for editor, terminal, file system access
- Webview uses VS Code theming and UI components
- Terminal integration with shell detection and command execution

This codebase is a VS Code AI coding assistant extension that combines features from Roo Code and Cline, providing an integrated development experience with multiple AI providers and tool capabilities.
