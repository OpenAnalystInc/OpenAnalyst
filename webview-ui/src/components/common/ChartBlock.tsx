/**
 * Module: ChartBlock (presentation)
 * Purpose: React component for rendering chart code blocks
 * Responsibilities:
 *  - Parse chart JSON with debouncing
 *  - Delegate rendering to IChartRenderer adapter
 *  - Handle errors with actionable UX
 *  - Provide export and copy actions
 * Invariants:
 *  - Never executes user code (only parses JSON)
 *  - Debounces parsing to avoid jank (500ms)
 *  - Cleans up chart on unmount
 * Dependencies: IChartRenderer port, ChartConfiguration domain
 * Risks: Large JSON could slow parsing (debounced)
 * Performance: 500ms debounce, lazy Chart.js load (first render +50-100ms)
 * Security: JSON.parse only - no eval; errors don't leak file paths
 */

import { useEffect, useRef, useState } from "react"
import styled from "styled-components"
import { useDebounceEffect } from "@src/utils/useDebounceEffect"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import CodeBlock from "./CodeBlock"

// Clean Architecture imports
import {
  parseChartConfig,
  ChartValidationError,
  type ChartConfiguration
} from "@src/core/domain/ChartConfiguration"
import type { IChartRenderer } from "@src/core/ports/IChartRenderer"
import { ChartJSRenderer } from "@src/adapters/chartjs/ChartJSRenderer.adapter"

// Development flag from vite define
declare const __DEV__: boolean

// Singleton renderer instance (composition root)
// In a larger app, this would be injected via DI container
const chartRenderer: IChartRenderer = new ChartJSRenderer()

interface ChartBlockProps {
  code: string
}

/**
 * Render a chart from a code block containing JSON configuration.
 * Uses Clean Architecture to separate concerns.
 * @param code - Raw JSON string from ```chart block
 * @example
 * <ChartBlock code='{"type":"bar","data":{...}}' />
 */
export default function ChartBlock({ code: originalCode }: ChartBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const [code, setCode] = useState("")
  const [parsedConfig, setParsedConfig] = useState<ChartConfiguration | null>(null)

  const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()
  const { t } = useAppTranslation()

  // Initialize when code changes
  useEffect(() => {
    setCode(originalCode)
  }, [originalCode])

  // Cleanup chart on unmount (prevents memory leaks)
  useEffect(() => {
    return () => {
      // Guard: Call cleanup if it exists
      if (cleanupRef.current) {
        console.log('[ChartBlock] Cleanup called - destroying chart')
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  // Re-render chart when parsedConfig or canvas changes
  useEffect(() => {
    if (!parsedConfig || !canvasRef.current) {
      return
    }

    console.log('[ChartBlock] Rendering chart with existing config...')

    // Clean up previous chart if exists
    if (cleanupRef.current) {
      console.log('[ChartBlock] Cleaning up previous chart')
      cleanupRef.current()
      cleanupRef.current = null
    }

    // Add a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (!canvasRef.current || !parsedConfig) {
        console.warn('[ChartBlock] Canvas or config lost after timeout')
        setIsLoading(false)
        return
      }

      const rect = canvasRef.current.getBoundingClientRect()
      console.log('[ChartBlock] Canvas rect:', rect.width, 'x', rect.height)

      chartRenderer
        .render(canvasRef.current, parsedConfig)
        .then((cleanup) => {
          cleanupRef.current = cleanup
          setIsLoading(false)
          console.log('[ChartBlock] Chart rendered successfully')
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Chart rendering failed'
          console.error('[ChartBlock] Render error:', err)
          setError(message)
          setIsLoading(false)
        })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [parsedConfig, canvasRef.current])

  // Debounced chart parsing (perf: avoid thrashing on rapid edits)
  useDebounceEffect(
    () => {
      // Guard: Skip empty code
      if (!code.trim()) {
        setError(null)
        setParsedConfig(null)
        return
      }

      setIsLoading(true)
      setError(null)
      setErrorDetails(null)

      try {
        // Parse and validate chart configuration (domain logic)
        console.log('[ChartBlock] Parsing chart config...')
        const config = parseChartConfig(code)
        console.log('[ChartBlock] Config parsed successfully:', {
          type: config.type,
          hasLabels: 'labels' in config.data,
          datasetCount: config.data.datasets.length
        })
        setParsedConfig(config)
        // Rendering will be handled by useEffect hook
      } catch (err: unknown) {
        // Guard: Handle validation errors with actionable messages
        if (err instanceof ChartValidationError) {
          setError(err.message)
          setErrorDetails(`Error code: ${err.code}`)

          // Log context for debugging (not shown to user)
          if (__DEV__) {
            console.error('[ChartBlock] Validation error:', err.code, err.context)
          }
        } else if (err instanceof Error) {
          setError(err.message)
          if (__DEV__) console.error('[ChartBlock] Parse error:', err)
        } else {
          setError(t("common:chart.parse_error") || "Invalid chart configuration")
        }

        setParsedConfig(null)
        setIsLoading(false)
      }
    },
    500, // 500ms debounce (perf: batch rapid typing)
    [code]
  )

  // Auto-fix common JSON issues
  const handleSyntaxFix = () => {
    try {
      // Common fixes for malformed JSON
      const fixed = code
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes around keys
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/'/g, '"') // Replace single quotes with double quotes

      // Try to parse and add missing required fields
      const parsed = JSON.parse(fixed)

      if (!parsed.type) {
        parsed.type = "bar" // Default chart type
      }

      if (!parsed.data) {
        parsed.data = {
          labels: ["Sample"],
          datasets: [{ label: "Data", data: [0] }]
        }
      }

      setCode(JSON.stringify(parsed, null, 2))
    } catch {
      // If auto-fix fails, keep original
      // User will see validation error
    }
  }

  // Export chart as PNG
  const handleExportChart = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const pngDataUrl = canvas.toDataURL('image/png', 1.0)
      vscode.postMessage({
        type: "openImage",
        text: pngDataUrl,
      })
    } catch (err) {
      console.error("[ChartBlock] Error exporting chart:", err)
    }
  }

  return (
    <ChartBlockContainer>
      {/* Loading indicator */}
      {isLoading && (
        <LoadingMessage>
          {t("common:chart.loading") || "Loading chart..."}
        </LoadingMessage>
      )}

      {/* Error display with expandable details */}
      {error ? (
        <div style={{ marginTop: "0px", overflow: "hidden", marginBottom: "8px" }}>
          <div
            style={{
              borderBottom: isErrorExpanded ? "1px solid var(--vscode-editorGroup-border)" : "none",
              fontWeight: "normal",
              fontSize: "var(--vscode-font-size)",
              color: "var(--vscode-editor-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => setIsErrorExpanded(!isErrorExpanded)}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexGrow: 1,
              }}>
              <span
                className="codicon codicon-warning"
                style={{
                  color: "var(--vscode-editorWarning-foreground)",
                  opacity: 0.8,
                  fontSize: 16,
                  marginBottom: "-1.5px",
                }}></span>
              <span style={{ fontWeight: "bold" }}>
                {t("common:chart.parse_error") || "Chart Error"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <FixButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleSyntaxFix()
                }}
                title={t("common:chart.fix_syntax") || "Try to fix syntax"}>
                <span className="codicon codicon-wand"></span>
              </FixButton>
              <CopyButton
                onClick={(e) => {
                  e.stopPropagation()
                  const combinedContent = `Error: ${error}\n${errorDetails || ''}\n\n\`\`\`chart\n${code}\n\`\`\``
                  copyWithFeedback(combinedContent, e)
                }}>
                <span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`}></span>
              </CopyButton>
              <span className={`codicon codicon-chevron-${isErrorExpanded ? "up" : "down"}`}></span>
            </div>
          </div>
          {isErrorExpanded && (
            <div
              style={{
                padding: "8px",
                backgroundColor: "var(--vscode-editor-background)",
                borderTop: "none",
              }}>
              <div style={{ marginBottom: "8px", color: "var(--vscode-descriptionForeground)" }}>
                {error}
                {errorDetails && (
                  <div style={{ fontSize: "0.9em", marginTop: "4px", opacity: 0.8 }}>
                    {errorDetails}
                  </div>
                )}
              </div>
              <CodeBlock language="json" source={code} />
            </div>
          )}
        </div>
      ) : (
        // Always render container if we have parsed config OR are loading
        (parsedConfig || isLoading) && (
          <ChartContainer ref={containerRef} $isLoading={isLoading}>
            <ActionButtons>
              <ExportButton
                onClick={handleExportChart}
                title={t("common:chart.export_png") || "Export as PNG"}>
                <span className="codicon codicon-device-camera"></span>
              </ExportButton>
              <CopyButton
                onClick={(e) => {
                  const chartJson = parsedConfig ? JSON.stringify(parsedConfig, null, 2) : code
                  const content = `\`\`\`chart\n${chartJson}\n\`\`\``
                  copyWithFeedback(content, e)
                }}
                title="Copy chart configuration">
                <span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`}></span>
              </CopyButton>
            </ActionButtons>
            {/* Canvas element for chart rendering - always render to maintain ref */}
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '368px', // Account for padding
                display: parsedConfig ? 'block' : 'none' // Hide if no config
              }}
            />
          </ChartContainer>
        )
      )}
    </ChartBlockContainer>
  )
}

// Styled components (unchanged from original)
const ChartBlockContainer = styled.div`
  position: relative;
  margin: 8px 0;
`

const LoadingMessage = styled.div`
  padding: 8px 0;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
  font-size: 0.9em;
`

const ChartContainer = styled.div<{ $isLoading: boolean }>`
  position: relative;
  opacity: ${(props) => (props.$isLoading ? 0.3 : 1)};
  min-height: 200px;
  max-height: 400px;
  transition: opacity 0.2s ease;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 16px;
`

const ActionButtons = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;

  ${ChartContainer}:hover & {
    opacity: 1;
  }
`

const CopyButton = styled.button`
  padding: 4px;
  height: 28px;
  width: 28px;
  color: var(--vscode-editor-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vscode-button-background);
  border: 1px solid var(--vscode-button-border);
  border-radius: 3px;
  cursor: pointer;

  &:hover {
    background: var(--vscode-button-hoverBackground);
  }
`

const ExportButton = styled(CopyButton)`
  background: var(--vscode-button-secondaryBackground);

  &:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
`

const FixButton = styled(CopyButton)`
  background: var(--vscode-button-secondaryBackground);

  &:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
`