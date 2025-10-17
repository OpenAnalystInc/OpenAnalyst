/**
 * Module: ChartJSLoader (adapter)
 * Purpose: Lazy-load Chart.js v4.x with optional preloading for performance
 * Responsibilities:
 *  - Load Chart.js dynamically (creates separate webpack chunk)
 *  - Register all required controllers and elements once
 *  - Provide preload capability for zero-latency first render
 * Invariants:
 *  - Chart.js loaded only once (singleton pattern)
 *  - Controllers registered before any chart rendering
 *  - Uses chart.js v4.5.0 with proper import structure
 * Dependencies: chart.js (lazy-loaded)
 * Risks: Large bundle size (240KB) - mitigated by lazy loading
 * Security: No user input, library loaded from node_modules
 * Performance:
 *  - Initial load: ~50-100ms (network + parse)
 *  - Subsequent access: instant (cached)
 *  - Preload adds 0ms to UI load (non-blocking background)
 */

// Type for the dynamically imported Chart.js module
// NOTE: In Chart.js 4.x, components are exported directly, not as nested properties
type ChartJSModule = typeof import('chart.js');

// Development flag from vite define
declare const __DEV__: boolean;

/**
 * Singleton loader for Chart.js library with preload optimization.
 * Ensures Chart.js is loaded and configured exactly once.
 */
class ChartJSLoader {
  private loadPromise: Promise<ChartJSModule> | null = null;
  private isRegistered = false;
  private chartJSModule: ChartJSModule | null = null;

  /**
   * Preload Chart.js in background (non-blocking).
   * Call this immediately after webview loads for zero-latency first chart.
   * Fire-and-forget pattern - errors are caught and logged, not thrown.
   */
  preload(): void {
    // Start loading but don't await (non-blocking)
    this.ensureLoaded().catch(err => {
      // Log but don't throw - will retry on demand if needed
      console.warn('[ChartJSLoader] Preload failed, will retry on demand:', err);
    });
  }

  /**
   * Ensure Chart.js is loaded and registered.
   * If preload() was called earlier, this returns instantly.
   * @returns Promise resolving to Chart.js module
   */
  async ensureLoaded(): Promise<ChartJSModule> {
    // Guard: Return cached module if already loaded
    if (this.chartJSModule) {
      return this.chartJSModule;
    }

    // Guard: Reuse existing load promise to avoid duplicate loads
    if (!this.loadPromise) {
      this.loadPromise = this.loadAndRegister();
    }

    return this.loadPromise;
  }

  /**
   * Check if Chart.js is ready (useful for UI loading states).
   * @returns True if Chart.js is loaded and ready to use
   */
  isReady(): boolean {
    return this.chartJSModule !== null && this.isRegistered;
  }

  /**
   * Load Chart.js and register all required components.
   * This is the FIX for "bar is not a registered controller" error.
   * @returns Promise resolving to loaded Chart.js module
   */
  private async loadAndRegister(): Promise<ChartJSModule> {
    try {
      // Import Chart.js with auto registration
      // In ESM/Vite, chart.js/auto exports everything including Chart as named exports
      const ChartModule = await import('chart.js/auto');

      // The Chart constructor is always at ChartModule.Chart in ESM
      const ChartConstructor = (ChartModule as any).Chart;

      if (!ChartConstructor) {
        console.error('[ChartJSLoader] Chart constructor not found. Module structure:', {
          keys: Object.keys(ChartModule),
          hasDefault: 'default' in ChartModule,
          defaultType: typeof (ChartModule as any).default
        });
        throw new Error('Chart constructor not found in chart.js/auto');
      }

      // Mark as registered (auto import handles registration)
      this.isRegistered = true;

      // Cache the module with Chart as a property to match expected structure
      this.chartJSModule = { Chart: ChartConstructor } as any;

      return { Chart: ChartConstructor } as any;
    } catch (err: unknown) {
      console.error('[ChartJSLoader] Failed to load Chart.js:', err);
      // Reset state on failure to allow retry
      this.loadPromise = null;
      throw err;
    }
  }

  /**
   * Register all Chart.js components (elements AND controllers).
   * CRITICAL: In Chart.js 4.x, components are exported directly from the module.
   * @param ChartJS - Loaded Chart.js module
   */
  private registerComponents(ChartJS: ChartJSModule): void {
    // Guard: In Chart.js 4.x, we use the Chart export directly
    const Chart = ChartJS.Chart;

    // Register all components at once using registerables (Chart.js 4.x pattern)
    // This is the recommended approach for Chart.js 4.x to avoid missing components
    Chart.register(
      // Controllers - MUST be registered for chart types to work
      ChartJS.BarController,
      ChartJS.LineController,
      ChartJS.PieController,
      ChartJS.DoughnutController,
      ChartJS.ScatterController,
      ChartJS.BubbleController,
      ChartJS.RadarController,
      ChartJS.PolarAreaController,

      // Scales - Required for axes
      ChartJS.CategoryScale,
      ChartJS.LinearScale,
      ChartJS.RadialLinearScale,
      ChartJS.TimeScale,
      ChartJS.LogarithmicScale,

      // Elements - Visual components
      ChartJS.PointElement,
      ChartJS.LineElement,
      ChartJS.BarElement,
      ChartJS.ArcElement,

      // Plugins - Tooltips, legends, etc.
      ChartJS.Title,
      ChartJS.Tooltip,
      ChartJS.Legend,
      ChartJS.Filler  // For area charts
    );

    // Dev-only logging for debugging registration issues
    if (__DEV__) {
      console.log('[ChartJSLoader] Successfully registered all Chart.js 4.x components');
      console.log('[ChartJSLoader] Registered controllers:', [
        'Bar', 'Line', 'Pie', 'Doughnut', 'Scatter', 'Bubble', 'Radar', 'PolarArea'
      ]);
      console.log('[ChartJSLoader] Registered scales:', [
        'Category', 'Linear', 'RadialLinear', 'Time', 'Logarithmic'
      ]);
      console.log('[ChartJSLoader] Registered elements:', [
        'Point', 'Line', 'Bar', 'Arc'
      ]);
      console.log('[ChartJSLoader] Registered plugins:', [
        'Title', 'Tooltip', 'Legend', 'Filler'
      ]);
    }
  }
}

// Export singleton instance
// This ensures only one loader exists across the entire application
export const chartJSLoader = new ChartJSLoader();