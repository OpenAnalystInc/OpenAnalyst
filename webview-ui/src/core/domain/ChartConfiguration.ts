/**
 * Module: ChartConfiguration (domain)
 * Purpose: Type-safe chart configuration model for data visualization
 * Responsibilities: Validate and normalize chart configurations
 * Invariants:
 *  - type must be one of the supported chart types
 *  - data must contain labels and datasets
 *  - No framework dependencies (pure domain)
 * Dependencies: None
 * Risks: Large JSON parsing could be slow (mitigated by 500ms debounce in UI)
 * Security: JSON.parse only, no eval or code execution
 * Performance: O(n) for validation where n = dataset size
 */

/** Supported chart types - exhaustive union for type safety */
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'bubble' | 'polarArea' | 'radar';

/** Data point for coordinate-based charts (scatter, bubble) */
export interface CoordinateDataPoint {
  readonly x: number;
  readonly y: number;
  readonly r?: number; // For bubble charts
}

/** Dataset for label-based charts (bar, line, pie, doughnut, etc.) */
export interface LabelBasedDataset {
  readonly label: string;
  readonly data: readonly number[];
  readonly backgroundColor?: string | readonly string[];
  readonly borderColor?: string | readonly string[];
  readonly borderWidth?: number;
  readonly type?: string; // For mixed charts
  readonly fill?: boolean; // For area charts
  readonly tension?: number; // For curved lines
  readonly pointRadius?: number;
  readonly pointStyle?: string;
  [key: string]: unknown; // Allow additional Chart.js dataset options
}

/** Dataset for coordinate-based charts (scatter, bubble) */
export interface CoordinateBasedDataset {
  readonly label: string;
  readonly data: readonly CoordinateDataPoint[];
  readonly backgroundColor?: string | readonly string[];
  readonly borderColor?: string | readonly string[];
  readonly borderWidth?: number;
  readonly type?: string; // For mixed charts
  readonly pointRadius?: number;
  readonly pointStyle?: string;
  [key: string]: unknown; // Allow additional Chart.js dataset options
}

/**
 * Chart configuration following Chart.js structure but framework-agnostic.
 * All fields are readonly to ensure immutability.
 */
export interface ChartConfiguration {
  readonly type: ChartType;
  readonly data: {
    readonly labels?: readonly string[]; // Optional for coordinate-based charts
    readonly datasets: ReadonlyArray<LabelBasedDataset | CoordinateBasedDataset>;
  };
  readonly options?: Readonly<{
    readonly responsive?: boolean;
    readonly maintainAspectRatio?: boolean;
    readonly plugins?: Readonly<{
      readonly legend?: Readonly<{
        readonly display?: boolean;
        readonly position?: 'top' | 'bottom' | 'left' | 'right';
      }>;
      readonly title?: Readonly<{
        readonly display?: boolean;
        readonly text?: string;
      }>;
      readonly tooltip?: Readonly<{
        readonly enabled?: boolean;
      }>;
    }>;
    readonly scales?: Record<string, unknown>; // Allow flexible scale config
    [key: string]: unknown; // Allow additional Chart.js options
  }>;
}

/**
 * Parse and validate chart configuration from JSON string.
 * @param json - Raw JSON string from chart code block
 * @returns Validated chart configuration
 * @throws {ChartValidationError} When JSON is malformed or invalid
 * @example
 * ```ts
 * const config = parseChartConfig('{"type":"bar","data":{...}}');
 * ```
 */
export function parseChartConfig(json: string): ChartConfiguration {
  try {
    const parsed = JSON.parse(json) as unknown;
    return validateChartConfig(parsed);
  } catch (err: unknown) {
    // Guard: If it's already a validation error, re-throw
    if (err instanceof ChartValidationError) {
      throw err;
    }

    // Otherwise it's a JSON parse error
    throw new ChartValidationError(
      'PARSE_ERROR',
      'Invalid JSON syntax. Check for missing quotes, trailing commas, or mismatched brackets.',
      { json, cause: err }
    );
  }
}

/**
 * Validate parsed object against ChartConfiguration schema.
 * Uses type guards to ensure runtime type safety.
 * @param obj - Unknown parsed object to validate
 * @returns Validated ChartConfiguration
 * @throws {ChartValidationError} When validation fails
 */
function validateChartConfig(obj: unknown): ChartConfiguration {
  // Guard: Must be an object
  if (!isObject(obj)) {
    throw new ChartValidationError(
      'INVALID_TYPE',
      'Chart configuration must be a JSON object',
      { received: typeof obj }
    );
  }

  // Guard: type is required and must be valid
  if (!isValidChartType(obj.type)) {
    throw new ChartValidationError(
      'MISSING_TYPE',
      `Chart type is required. Use one of: ${CHART_TYPES.join(', ')}`,
      { received: obj.type }
    );
  }

  // Guard: data is required
  if (!isObject(obj.data)) {
    throw new ChartValidationError(
      'MISSING_DATA',
      'Chart data property is required and must be an object',
      { received: typeof obj.data }
    );
  }

  // Determine if this is a coordinate-based chart
  const isCoordinateBased = ['scatter', 'bubble'].includes(obj.type);

  // Guard: labels are required for non-coordinate charts
  if (!isCoordinateBased && !Array.isArray(obj.data.labels)) {
    throw new ChartValidationError(
      'MISSING_LABELS',
      `Chart type '${obj.type}' requires data.labels to be an array of strings`,
      { type: obj.type, received: typeof obj.data.labels }
    );
  }

  // Guard: datasets array is required and non-empty
  if (!Array.isArray(obj.data.datasets) || obj.data.datasets.length === 0) {
    throw new ChartValidationError(
      'MISSING_DATASETS',
      'Chart data.datasets must be a non-empty array',
      { received: obj.data.datasets }
    );
  }

  // Guard: Validate each dataset based on chart type
  for (let i = 0; i < obj.data.datasets.length; i++) {
    const dataset = obj.data.datasets[i];
    if (!isObject(dataset)) {
      throw new ChartValidationError(
        'INVALID_DATASET',
        `Dataset at index ${i} must be an object`,
        { index: i, received: typeof dataset }
      );
    }

    if (typeof dataset.label !== 'string') {
      throw new ChartValidationError(
        'MISSING_DATASET_LABEL',
        `Dataset at index ${i} must have a label property (string)`,
        { index: i, received: typeof dataset.label }
      );
    }

    if (!Array.isArray(dataset.data)) {
      throw new ChartValidationError(
        'MISSING_DATASET_DATA',
        `Dataset at index ${i} must have a data property (array)`,
        { index: i, received: typeof dataset.data }
      );
    }

    // Validate data format based on chart type
    if (isCoordinateBased || (dataset.type && ['scatter', 'bubble'].includes(dataset.type as string))) {
      // Coordinate-based validation
      for (let j = 0; j < dataset.data.length; j++) {
        const point = dataset.data[j];
        if (!isObject(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
          throw new ChartValidationError(
            'INVALID_COORDINATE_DATA',
            `Dataset ${i}, point ${j}: Coordinate data must have numeric x and y properties`,
            { datasetIndex: i, pointIndex: j, received: point }
          );
        }
        if ((obj.type === 'bubble' || dataset.type === 'bubble') && typeof point.r !== 'number') {
          throw new ChartValidationError(
            'INVALID_BUBBLE_DATA',
            `Dataset ${i}, point ${j}: Bubble charts require numeric r (radius) property`,
            { datasetIndex: i, pointIndex: j, received: point }
          );
        }
      }
    } else {
      // Label-based validation
      for (let j = 0; j < dataset.data.length; j++) {
        if (typeof dataset.data[j] !== 'number') {
          throw new ChartValidationError(
            'INVALID_DATA_TYPE',
            `Dataset ${i}, data ${j}: Expected number but got ${typeof dataset.data[j]}`,
            { datasetIndex: i, dataIndex: j, received: dataset.data[j] }
          );
        }
      }
    }
  }

  // Type is now proven valid at runtime
  // Using double assertion for safety - first to unknown, then to ChartConfiguration
  // This follows the strict TypeScript standards (avoiding direct unsafe casts)
  return obj as unknown as ChartConfiguration;
}

// Helper type guards (pure functions)
const CHART_TYPES: readonly ChartType[] = ['bar', 'line', 'pie', 'doughnut', 'scatter', 'bubble', 'polarArea', 'radar'];

/**
 * Type guard to check if value is a plain object.
 * @param val - Value to check
 * @returns True if val is a non-null object (not array)
 */
function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Type guard to check if value is a valid chart type.
 * @param val - Value to check
 * @returns True if val is one of the supported chart types
 */
function isValidChartType(val: unknown): val is ChartType {
  return typeof val === 'string' && CHART_TYPES.includes(val as ChartType);
}

/**
 * Custom error for chart validation failures.
 * Provides actionable error codes and context for debugging.
 */
export class ChartValidationError extends Error {
  /**
   * @param code - Machine-readable error code for programmatic handling
   * @param message - Human-readable error message for users
   * @param context - Additional context for debugging (will be logged, not shown to user)
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ChartValidationError';

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ChartValidationError.prototype);
  }
}