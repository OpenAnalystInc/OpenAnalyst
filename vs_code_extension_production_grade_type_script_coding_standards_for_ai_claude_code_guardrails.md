# VS Code Extension — Production‑Grade TypeScript Coding Standards

> **Purpose:** This document defines practical, enforceable rules for building **modular, clean, scalable, production‑ready** VS Code extensions in **TypeScript**. It’s written in plain English and structured so AI code assistants (e.g., Claude Code) can follow it consistently.

---

## 0) How to use this guide (for humans & AI)

- **When generating code**: obey all **MUST/SHOULD/AVOID** statements.
- **When reviewing PRs**: use the **PR Checklist** (Section 18) and ensure a **Changelog entry** (Section 12) exists for any change that touches behavior or public surface.
- **When uncertain**: prefer **interfaces, small pure functions, and lazy work**; avoid framework leakage into core logic.

---

## 1) Golden Principles (remember these always)

- **Separation of Concerns (SoC) — MUST** keep UI, domain logic, and platform adapters in separate modules.
- **Domain-Driven Design (DDD) — SHOULD** model core concepts with Entities/Value Objects; put complex rules in Domain Services; persist via Repositories; announce changes via Domain Events.
- **Hexagonal (Ports & Adapters) / Clean Architecture — MUST** depend on **interfaces** inside, implement **adapters** at the edges; layers: **Domain → Application (use-cases) → Adapters → Framework (VS Code)**.
- **SOLID — MUST** observe SRP/ISP/DIP; **LSP — MUST**: implementations must be true drop‑in substitutes for their interfaces.
- **Functional core, imperative shell — SHOULD** keep pure logic central; isolate side effects.
- **DRY, KISS, YAGNI — SHOULD** remove duplication, keep it simple, avoid speculative abstractions.

**Why:** These rules keep code testable, change‑friendly, and resilient to VS Code API changes.

---

---

## 2) Dependency Inversion (DIP), DI & Composition Root

- **Abstraction (port)** = an **interface** describing a capability (e.g., `IFileSystem`).
- **Concretion (adapter)** = a class that implements that interface (e.g., `VSCodeFileSystem`).
- **Composition root** = the place where concretions are chosen and injected (here: `activate()`).

**Rules**

- **MUST** depend on ports in `core`. **MUST NOT** instantiate `vscode` APIs inside use-cases.
- **MUST** wire adapters → ports in `activate()` or a small factory near it.
- **SHOULD** keep interfaces small and focused (ISP).

**Why:** Swappable implementations (tests, Node/Web variants) with minimal ripple effects.

---

## 3) VS Code Lifecycle & Integration Rules

**Activation**

- **MUST** keep `activate()` small: **compose objects + register** commands/providers only.
- **MUST** avoid heavy work on activation; **SHOULD** lazy‑import big modules inside handlers.
- **MUST** define precise `activationEvents` (avoid `"*"`).

**Disposables**

- **MUST** push every registration to `context.subscriptions` and implement `dispose()` when needed.

**Cancellation**

- **MUST** accept and honor `CancellationToken` in providers and long tasks; exit early when requested.

**Configuration**

- **MUST** contribute settings with JSON schema (types, defaults, description) and handle migrations & deprecations.

**Workspace Trust**

- **MUST** disable risky features when the folder is untrusted.

**Secrets**

- **MUST** store tokens/credentials in `SecretStorage` (Keychain/OS vault); never write secrets to logs/settings.

**Localization**

- **SHOULD** use `vscode.l10n` for strings; no hard‑coded UI text in logic.

**Commands & Providers**

- **SHOULD** keep command handlers thin: validate input, call a use-case, show result.
- **SHOULD** namespace command IDs (e.g., `myext.format.file`).

**Webviews**

- **MUST** use a strict CSP; **MUST** sanitize messages; **SHOULD** theme with VS Code tokens; isolate UI bundle.

**Language Server (LSP)**

- **SHOULD** run the language server in a separate package/process; keep protocol stable; debounce expensive providers.

---

## 4) TypeScript Standards

**tsconfig (minimum)**

- **MUST** enable: `"strict": true`, `"noImplicitAny": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- **SHOULD** use `"noFallthroughCasesInSwitch": true`, `"useUnknownInCatchVariables": true`.

**Type hygiene**

- **MUST** avoid `any`; prefer `unknown` + narrow.
- **SHOULD** use discriminated unions and exhaustive `switch` with `never` to catch missing cases.
- **MUST** mark fields/arrays as `readonly` where possible; avoid shared mutable state.
- **SHOULD** export **types** sparingly; keep internal types private to modules.

**Naming**

- **SHOULD** use `PascalCase` for types/classes, `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for const enums/flags.
- **MUST** name files after their main export (`formatFile.usecase.ts`, `vscodeFileSystem.adapter.ts`).

---

## 5) Errors & Results

**Error taxonomy**

- **MUST** use custom `Error` subclasses with codes (e.g., `ConfigError`, `IOError`).
- **MUST NOT** throw strings; attach context (file URI, operation).

**Result types**

- **SHOULD** return `Result<T, E>` (or `Either`) for expected failure states; **MAY** throw for truly exceptional failures.

**User messaging**

- **MUST** surface **actionable** errors (`Retry`, `Open Logs`, `Report Issue`); log stack traces, don’t show them.

---

## 6) Logging, Dev Flags & Telemetry (Privacy‑First)

**Dev/Prod switch**

- **MUST** implement a compile‑time `__DEV__` flag via bundler defines; **MUST** guard `debug()` logs so they are removed in prod builds.

**Logging**

- **SHOULD** use a structured logger with levels: `debug`, `info`, `warn`, `error`; include ISO timestamp and correlation ID.
- **MUST NOT** log secrets or file contents.

**Telemetry**

- **MUST** be opt‑in or respect VS Code telemetry setting; collect minimal counts/timers only; no PII.

---

## 7) Performance & Resource Use

- **MUST** lazy‑load heavy modules inside handlers/providers.
- **SHOULD** debounce/throttle editor‑driven operations; cache results where safe.
- **MUST** avoid synchronous FS on the extension host thread; stream large data.
- **SHOULD** cap concurrency (queues/semaphores) for network/FS tasks.
- **MUST** show progress for long tasks (`withProgress`); avoid popup spam; prefer status bar for passive feedback.

---

---

## 8) Testing Strategy

- **Unit tests (MUST)**: pure domain & use-cases with fakes for ports. Fast.
- **Integration tests (SHOULD)**: use `@vscode/test-electron` to run VS Code and exercise commands/providers.
- **Contract tests (SHOULD)**: ensure adapters honor port interfaces across edge cases.
- **Webview/LSP tests (SHOULD)**: message channel tests; protocol request/response tests incl. cancellation.
- **Determinism (MUST)**: seed randomness; freeze time; stable fixtures/golden files for diagnostics/formatters.

**Coverage target (baseline)**: 70% overall, 80% for core/use-cases (adjust per team).

---

## 9) Code Comments & Documentation (Production‑style)

**Goal:** Make code self‑explaining for engineers, reviewers, and AI. Comments should clarify **intent, contracts, risks, security, and performance**—not restate obvious code.

**Rules**

- **MUST** add a **module header** at the top of each file: purpose, key responsibilities, invariants, dependencies, and risk notes.
- **MUST** add **TSDoc** for all exported types/classes/functions (params, returns, throws, examples).
- **MUST** document **preconditions/postconditions** and **invariants** near the logic they protect.
- **MUST** annotate **security/privacy** implications (data flow, secret handling, trust boundaries).
- **SHOULD** add **performance/complexity** notes where non‑obvious (e.g., O(n²) scans, debounce reasons).
- **SHOULD** use clear inline comments for guard clauses and branching intent ("bail early if…").
- **MUST** use consistent TODO/FIXME style: `// TODO(owner@date): short action …` or `// FIXME(owner@date): problem …`.
- **AVOID** obvious comments ("increment i"); prefer explaining **why** over **what**.

**Module header template**

```ts
/**
 * Module: VSCodeFileSystem (adapter)
 * Purpose: Implements IFileSystem using vscode.workspace.fs.
 * Responsibilities: read/write text; no UI or business logic.
 * Invariants: Never log file contents; never show UI; always use UTF‑8.
 * Dependencies: vscode.workspace.fs; TextEncoder/Decoder.
 * Risks: Large files streamed; errors mapped to IOError.
 */
```

**TSDoc example**

```ts
/**
 * Read an entire file as UTF‑8 text.
 * @param uri - Absolute URI (e.g., `file:///…`).
 * @returns The file contents as string.
 * @throws {IOError} When the file cannot be read; includes uri in context.
 * @example
 * const text = await fs.readText('file:///a/b.txt');
 */
```

**Inline conventions**

```ts
// Guard: bail if user cancelled — keep UI responsive
if (token.isCancellationRequested) return;

// Security: never echo user input into logs
logger.info('Saving settings');

// Perf: debounce to avoid firing provider on every keystroke
```

**End‑to‑end example with production comments**

```ts
/**
 * Module: FormatFileUseCase (core/usecase)
 * Purpose: Normalize trailing newline policy.
 * Invariants:
 *  - Never modify file content beyond trimming trailing whitespace and adding a single newline.
 *  - Pure w.r.t. business logic; all IO through IFileSystem port.
 */
export class FormatFileUseCase {
  constructor(private readonly fs: IFileSystem) {}

  /**
   * Normalize a file by trimming trailing whitespace and ensuring a single trailing newline.
   * @param uri - Absolute URI of the target file.
   * @returns void
   * @throws {IOError} when fs read/write fails. The error MUST include the uri.
   */
  async run(uri: string): Promise<void> {
    // Read current content (IO performed by adapter; core remains framework‑free)
    const text = await this.fs.readText(uri);

    // Functional step: compute new content — pure transformation
    const formatted = text.trimEnd() + '
';

    // Idempotency: writing the same content twice is safe
    await this.fs.writeText(uri, formatted);
  }
}
```

```ts
/**
 * Module: VSCodeFileSystem (adapter)
 * Purpose: Concrete implementation of IFileSystem using VS Code APIs.
 * Security: Never log file contents; respect workspace trust.
 */
export class VSCodeFileSystem implements IFileSystem {
  constructor(private readonly fs = vscode.workspace.fs) {}

  /** @inheritdoc */
  async readText(uri: string): Promise<string> {
    try {
      const data = await this.fs.readFile(vscode.Uri.parse(uri));
      return new TextDecoder().decode(data);
    } catch (err: unknown) {
      // Map all IO errors to a typed domain error with context
      throw new IOError('READ_FAILED', { uri, cause: err });
    }
  }

  /** @inheritdoc */
  async writeText(uri: string, content: string): Promise<void> {
    try {
      const data = new TextEncoder().encode(content);
      await this.fs.writeFile(vscode.Uri.parse(uri), data);
    } catch (err: unknown) {
      throw new IOError('WRITE_FAILED', { uri, cause: err });
    }
  }
}
```

```ts
/**
 * Module: registerFormatCommand (feature/format)
 * Purpose: Register command and delegate to use‑case; handle UX, errors, logs.
 */
export function registerFormatCommand(fs: IFileSystem): vscode.Disposable {
  const cmdId = 'myext.format.file';

  return vscode.commands.registerCommand(cmdId, async (uri?: vscode.Uri) => {
    // Resolve target file or bail with a quiet UX hint
    const target = uri?.toString() ?? vscode.window.activeTextEditor?.document.uri.toString();
    if (!target) {
      vscode.window.setStatusBarMessage('No file to format');
      return;
    }

    // Lazy‑load to keep activation fast (perf)
    const { FormatFileUseCase } = await import('../../core/usecases/FormatFileUseCase');
    const useCase = new FormatFileUseCase(fs);

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: 'Formatting…' },
        () => useCase.run(target)
      );
      vscode.window.setStatusBarMessage('Formatted ✓', 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Actionable UX; logs keep details, UI stays concise
      vscode.window.showErrorMessage(`Format failed: ${msg}`);
      logger.error('format_file_failed', { target, msg });
    }
  });
}
```

### Additional commented examples (for production‑style clarity)

```ts
/**
 * Module: logger (infrastructure)
 * Purpose: Structured logging with dev-only debug logs; zero cost in production via dead-code elimination.
 * Invariants:
 *  - debug() emits only when __DEV__ === true
 *  - info/warn/error are always available
 *  - Never log PII, secrets, or file contents
 */
import * as vscode from 'vscode';
declare const __DEV__: boolean; // compile-time flag provided by bundler (see tsup/esbuild define)

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private channel: vscode.OutputChannel | null = null;

  /** Lazily create the VS Code channel to minimize activation cost. */
  private getChannel(): vscode.OutputChannel {
    if (!this.channel) this.channel = vscode.window.createOutputChannel('MyExtension');
    return this.channel;
  }

  /** Dev-only logging; removed from prod bundle by the bundler define. */
  debug(...args: unknown[]): void {
    if (!__DEV__) return; // Dead code in production builds
    this.write('debug', ...args);
  }

  info(...args: unknown[]): void { this.write('info', ...args); }
  warn(...args: unknown[]): void { this.write('warn', ...args); }
  error(...args: unknown[]): void { this.write('error', ...args); }

  /** Centralized writer ensures consistent formatting and future log shipping. */
  private write(level: LogLevel, ...args: unknown[]) {
    const ts = new Date().toISOString();
    const line = args.map(safeToString).join(' ');
    this.getChannel().appendLine(`[${ts}] [${level.toUpperCase()}] ${line}`);
  }
}

/** Convert unknown to safe string without leaking secrets or throwing. */
function safeToString(x: unknown): string {
  try { return typeof x === 'string' ? x : JSON.stringify(x); }
  catch { return String(x); }
}

export const logger = new Logger();
```

```ts
/**
 * Module: hoverProvider (feature/hover)
 * Purpose: Provide quick info on hover; responsive to cancellation to avoid jank.
 */
export function registerHoverProvider(service: SymbolInfoService): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    { language: 'typescript' },
    {
      /**
       * Provide a hover; honor CancellationToken so work stops if user moves the cursor.
       */
      async provideHover(doc, pos, token) {
        // Guard: user moved on — abort work ASAP for snappy UX
        if (token.isCancellationRequested) return undefined;

        const word = doc.getText(doc.getWordRangeAtPosition(pos));
        if (!word) return undefined;

        // Expensive call — keep cancellable and time-bounded
        const info = await service.lookup(word, { signal: token });
        if (!info) return undefined;

        return new vscode.Hover(new vscode.MarkdownString(info.markdown));
      }
    }
  );
}
```

---

## 10) Changelog Discipline (Before/After + WHY + Functionality)

**Every change that modifies behavior or public API MUST add a changelog entry** in `CHANGELOG.md` (and, if long, a deep‑dive under `docs/changes/<feature>.md`). Use this exact template.

**Entry template**

````md
### Feature: <short name>
Date: YYYY‑MM‑DD • Author: <name/handle>
Files: path/a.ts, path/b.ts

**WHY**
- Problem & constraints in 1–3 bullets.
- Decision summary (trade‑offs).

**Functionality**
- What the new code does; user‑visible effects; risk & rollback.

**BEFORE**
```ts
// previous code
```

**AFTER**
```ts
// new code
```

**Tests**

- New/updated tests and coverage focus.

**Notes**

- Perf/Security/UX considerations; migration details if any.
````

**Example**

````md
### Feature: Normalize trailing newline on save
Date: 2025‑09‑11 • Author: @you
Files: src/core/usecases/FormatFileUseCase.ts, src/features/format/registerFormatCommand.ts

**WHY**
- Inconsistent file endings caused noisy diffs.
- Needed an idempotent, fast operation with clear UX.

**Functionality**
- Trims trailing whitespace; enforces single trailing `
`.
- Shows status bar tick; errors are actionable.

**BEFORE**
```ts
await vscode.workspace.fs.writeFile(uri, Buffer.from(text.trim()));
```

**AFTER**
```ts
const formatted = text.trimEnd() + '
';
await this.fs.writeText(uri, formatted);
```

**Tests**

- Added unit tests for empty file, Windows endings, already‑normalized input.

**Notes**

- Perf: pure string ops, O(n). Security: no content logging. Rollback: revert commit.
````

### Automation (enforce entries)
- **Pre-commit guard (recommended):** add a small script that blocks commits that modify source without updating CHANGELOG.md.

```bash
# scripts/check-changelog.sh
#!/usr/bin/env bash
set -euo pipefail

# If only docs/tests changed, skip
if ! git diff --cached --name-only | grep -qE '^(src/|packages/|extension\.ts|package\.json)'; then
  exit 0
fi

# Require CHANGELOG.md modification in the commit
if ! git diff --cached --name-only | grep -q '^CHANGELOG.md$'; then
  echo "❌ CHANGELOG.md missing. Please add an entry using the template in Section 12."
  exit 1
fi
```

- **PR template (required fields):**

```md
### Feature name
### WHY
### BEFORE/AFTER code
### Tests
### Risk & rollback
```

- **Optional CLI:** create a `scripts/changelog-append.ts` that appends a templated entry using `git show HEAD:<file>` for BEFORE and reading the working copy for AFTER.

---

## 11) Accessibility & Internationalization

- **Webviews (MUST)**: keyboard navigation, focus traps, ARIA roles, color contrast; theme tokens.
- **i18n (SHOULD)**: no concatenated strings; placeholder‑based messages; pluralization handled.

---

## 12) Data, Migrations & Idempotency

- **MUST** version any on‑disk state (e.g., Memento/globalState/workspaceState) and write migrations.
- **MUST** keep commands idempotent—safe to re‑run without corrupting state.
- **SHOULD** degrade gracefully when storage/cache is unavailable.

---

## 13) Claude Code Guardrails

- **Architecture**: Generate code that follows **Clean Architecture**. Core logic goes under `src/core` and must not import `vscode` or Node/Web globals. Use **ports (interfaces)** in `src/core/ports` and **adapters** in `src/adapters/*`.
- **Commands/Providers**: Handlers are thin and call use-cases. Register all Disposables and honor `CancellationToken`.
- **Types**: Enable strict TS. Never use `any`. Prefer `unknown` + narrowing, discriminated unions, `readonly` fields.
- **Errors**: Use typed errors or `Result` for expected failures. No string throws. Error messages to users must be actionable.
- **Logging**: Use a logger with `debug/info/warn/error`. Wrap debug with `if (__DEV__)` so it’s removed in prod.
- **Perf**: Lazy‑import heavy modules. Debounce editor‑triggered work. Avoid synchronous FS operations.
- **Security**: No `eval`/dynamic require. Validate/sanitize all inputs and paths. No secrets in logs.
- **Webviews**: Strict CSP, sanitize posts, no inline scripts. Use theme tokens and accessible markup.
- **LSP**: Keep the server separate with a stable protocol. Support cancellation and debouncing.
- **Docs & Comments**: **Add production‑grade comments** per Section 11 (module headers, TSDoc, security/perf notes). **Update CHANGELOG** per Section 12 for any behavioral change.

---

## 14) One‑page Summary (for onboarding)

- **Core logic is framework‑free** and depends on **interfaces**.
- **Edges (adapters)** talk to VS Code, FS, network, UI.
- **activate() = assemble & register**, not “do heavy work”.
- **Strict TypeScript**, small pure functions, typed errors, debug logs stripped in prod.
- **Security, performance, accessibility, and documentation** are first‑class—not afterthoughts.

> **Memory hook:** *Describe what you need, let the outside world adapt. Keep work lazy, pure, documented, and tested.*

