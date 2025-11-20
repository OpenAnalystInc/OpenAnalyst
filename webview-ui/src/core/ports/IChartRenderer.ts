/**
 * Module: IChartRenderer (port)
 * Purpose: Abstract chart rendering capability without framework coupling
 * Responsibilities: Define contract for rendering charts to canvas elements
 * Invariants:
 *  - Implementations MUST be cancellable (return cleanup function)
 *  - Implementations MUST be resource-safe (no memory leaks)
 *  - Canvas must be mounted in DOM before rendering
 * Dependencies: ChartConfiguration domain model only
 * Risks: None - pure interface
 * Security: Implementations must validate canvas element
 * Performance: Implementation-specific
 */

import { ChartConfiguration } from '../domain/ChartConfiguration';

/**
 * Capability for rendering charts in a canvas or container.
 * Implementations handle library-specific logic (Chart.js, D3, etc.)
 * while keeping the core logic framework-agnostic.
 */
export interface IChartRenderer {
  /**
   * Render a chart into the provided canvas element.
   * @param canvas - HTML canvas element (must be mounted in DOM)
   * @param config - Validated chart configuration from domain model
   * @returns Promise resolving to cleanup function that destroys chart instance
   * @throws {ChartRenderError} When rendering fails (e.g., canvas not mounted)
   * @example
   * ```ts
   * const cleanup = await renderer.render(canvasRef.current, config);
   * // Later, when component unmounts:
   * cleanup();
   * ```
   */
  render(canvas: HTMLCanvasElement, config: ChartConfiguration): Promise<() => void>;

  /**
   * Optional: Check if renderer is ready (e.g., library loaded).
   * Useful for showing loading states.
   * @returns True if renderer is ready to render charts
   */
  isReady?(): boolean;

  /**
   * Optional: Preload the rendering library in background.
   * Implementations can use this for performance optimization.
   * @returns Promise that resolves when preload completes
   */
  preload?(): Promise<void>;
}

/**
 * Custom error for chart rendering failures.
 * Implementations should throw this for consistency.
 */
export class ChartRenderError extends Error {
  /**
   * @param code - Machine-readable error code
   * @param message - Human-readable error message
   * @param context - Additional debugging context
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ChartRenderError';

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, ChartRenderError.prototype);
  }
}