/**
 * Module: ChartJSRenderer (adapter)
 * Purpose: Implement IChartRenderer using Chart.js library
 * Responsibilities:
 *  - Lazy-load Chart.js via ChartJSLoader
 *  - Render charts to canvas elements
 *  - Apply VS Code theme colors
 *  - Return cleanup functions to prevent memory leaks
 * Invariants:
 *  - Chart.js loaded only when needed (lazy)
 *  - Each render returns a cleanup function
 *  - Canvas must be mounted in DOM
 * Dependencies: chart.js (lazy), ChartJSLoader, IChartRenderer port
 * Risks: Large bundle (240KB) - mitigated by lazy loading
 * Security: No user code execution; config is pre-validated
 * Performance:
 *  - First render: +50-100ms if not preloaded
 *  - Subsequent renders: ~5-10ms
 *  - Cleanup prevents memory leaks
 */

import type { IChartRenderer } from '../../core/ports/IChartRenderer';
import { ChartRenderError } from '../../core/ports/IChartRenderer';
import type { ChartConfiguration } from '../../core/domain/ChartConfiguration';
import { chartJSLoader } from './ChartJSLoader';

// Development flag from vite define
declare const __DEV__: boolean;

/**
 * Chart.js implementation of IChartRenderer.
 * Uses lazy loading to avoid blocking extension activation.
 */
export class ChartJSRenderer implements IChartRenderer {
  /**
   * Render a chart using Chart.js.
   * @param canvas - Canvas element to render into (must be mounted)
   * @param config - Validated chart configuration
   * @returns Cleanup function that destroys the chart instance
   * @throws {ChartRenderError} When canvas is not mounted or rendering fails
   */
  async render(canvas: HTMLCanvasElement, config: ChartConfiguration): Promise<() => void> {
    // Logging for debugging render issues
    console.log('[ChartJSRenderer] Starting render with type:', config.type);
    console.log('[ChartJSRenderer] Data structure:', {
      hasLabels: 'labels' in config.data,
      datasetCount: config.data.datasets.length,
      firstDatasetSample: config.data.datasets[0]?.data[0]
    });

    // Guard: Canvas must be attached to DOM for Chart.js to work
    if (!canvas.isConnected) {
      throw new ChartRenderError(
        'CANVAS_NOT_MOUNTED',
        'Canvas element must be mounted in DOM before rendering'
      );
    }

    // Guard: Canvas must have non-zero dimensions
    const rect = canvas.getBoundingClientRect();
    console.log('[ChartJSRenderer] Canvas dimensions:', rect.width, 'x', rect.height);
    if (rect.width === 0 || rect.height === 0) {
      throw new ChartRenderError(
        'CANVAS_ZERO_SIZE',
        'Canvas element has zero dimensions. Ensure parent container has size.'
      );
    }

    try {
      // Lazy-load Chart.js (instant if preloaded)
      console.log('[ChartJSRenderer] Loading Chart.js...');
      const ChartModule = await chartJSLoader.ensureLoaded();

      // Apply VS Code theme to configuration
      const themedConfig = this.applyTheme(config);
      console.log('[ChartJSRenderer] Theme applied, creating chart...');

      // Get the Chart constructor from the module
      const ChartConstructor = (ChartModule as any).Chart;

      if (!ChartConstructor || typeof ChartConstructor !== 'function') {
        console.error('[ChartJSRenderer] Invalid Chart constructor:', {
          hasChart: !!(ChartModule as any).Chart,
          chartType: typeof (ChartModule as any).Chart,
          moduleKeys: Object.keys(ChartModule as any)
        });
        throw new Error('Chart constructor not available');
      }

      // Create Chart.js instance
      const chart = new ChartConstructor(canvas, {
        type: config.type,
        data: themedConfig.data,
        options: themedConfig.options,
      });

      console.log('[ChartJSRenderer] Chart created successfully');

      // Store reference on canvas to prevent garbage collection
      (canvas as any).__chartInstance = chart;

      // Return cleanup function (prevents memory leaks)
      return () => {
        console.log('[ChartJSRenderer] Cleanup called for chart');
        // Guard: Check chart exists before destroying
        if (chart) {
          chart.destroy();
          // Clean up the reference
          if ((canvas as any).__chartInstance) {
            delete (canvas as any).__chartInstance;
          }
        }
      };
    } catch (err: unknown) {
      // Map all errors to ChartRenderError for consistency
      throw new ChartRenderError(
        'RENDER_FAILED',
        `Chart.js rendering failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        { config, error: err }
      );
    }
  }

  /**
   * Check if Chart.js is loaded and ready.
   * @returns True if ready to render
   */
  isReady(): boolean {
    return chartJSLoader.isReady();
  }

  /**
   * Preload Chart.js in background.
   * @returns Promise that resolves when loaded
   */
  async preload(): Promise<void> {
    chartJSLoader.preload();
    // Wait for it to actually load
    await chartJSLoader.ensureLoaded();
  }

  /**
   * Apply VS Code theme colors to chart configuration.
   * Merges theme defaults with user options.
   * @param config - Original chart configuration
   * @returns Configuration with VS Code theme applied
   */
  private applyTheme(config: ChartConfiguration): ChartConfiguration {
    // VS Code compatible color palette
    const themeColors = [
      '#007ACC', // VS Code blue
      '#00BCF2', // Light blue
      '#89D185', // Green
      '#E9A700', // Yellow
      '#F85149', // Red
      '#A5A5A5', // Gray
      '#C586C0', // Purple
      '#D7BA7D', // Brown
    ];

    // Deep clone config to avoid mutations
    const themed: ChartConfiguration = {
      ...config,
      data: {
        ...config.data,
        datasets: config.data.datasets.map((dataset, index) => {
          const colorIndex = index % themeColors.length;
          const baseColor = themeColors[colorIndex];

          // Apply colors based on chart type
          const isPieType = config.type === 'pie' || config.type === 'doughnut';

          return {
            ...dataset,
            // Background: Multiple colors for pie/doughnut, single with alpha for others
            backgroundColor: dataset.backgroundColor || (
              isPieType
                ? themeColors.slice(0, dataset.data.length)
                : `${baseColor}80` // 50% opacity for area fills
            ),
            // Border: Solid color
            borderColor: dataset.borderColor || baseColor,
            borderWidth: dataset.borderWidth ?? 2,
          };
        }),
      },
      options: this.mergeOptions(config),
    };

    return themed;
  }

  /**
   * Merge VS Code theme options with user options.
   * User options take precedence.
   * @param config - Original configuration
   * @returns Merged options object
   */
  private mergeOptions(config: ChartConfiguration): ChartConfiguration['options'] {
    // VS Code theme defaults
    const themeDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: 'var(--vscode-editor-foreground)',
            font: {
              family: 'var(--vscode-font-family)',
              size: 12,
            },
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'var(--vscode-dropdown-background)',
          titleColor: 'var(--vscode-editor-foreground)',
          bodyColor: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-dropdown-border)',
          borderWidth: 1,
        },
        title: {
          display: false,
          color: 'var(--vscode-editor-foreground)',
          font: {
            family: 'var(--vscode-font-family)',
            size: 14,
            weight: 'bold',
          },
        },
      },
    };

    // Add scales for non-pie charts
    const needsScales = config.type !== 'pie' && config.type !== 'doughnut';
    const scaleDefaults = needsScales ? {
      scales: {
        x: {
          ticks: {
            color: 'var(--vscode-editor-foreground)',
            font: {
              family: 'var(--vscode-font-family)',
              size: 11,
            },
          },
          grid: {
            color: 'var(--vscode-panel-border)',
            lineWidth: 0.5,
          },
        },
        y: {
          ticks: {
            color: 'var(--vscode-editor-foreground)',
            font: {
              family: 'var(--vscode-font-family)',
              size: 11,
            },
          },
          grid: {
            color: 'var(--vscode-panel-border)',
            lineWidth: 0.5,
          },
        },
      },
    } : {};

    // Deep merge with user options (user takes precedence)
    return {
      ...themeDefaults,
      ...scaleDefaults,
      ...config.options,
      plugins: {
        ...themeDefaults.plugins,
        ...config.options?.plugins,
      },
    };
  }
}