import { useEffect, useRef, useState } from "react"
import styled from "styled-components"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartConfiguration,
  ChartData,
  ChartOptions,
} from "chart.js"
import { Chart } from "react-chartjs-2"
import { useDebounceEffect } from "@src/utils/useDebounceEffect"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import CodeBlock from "./CodeBlock"

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

// VS Code theme-compatible colors
const VS_CODE_THEME_COLORS = {
  primary: "#007ACC",
  secondary: "#00BCF2", 
  success: "#89D185",
  warning: "#E9A700",
  error: "#F85149",
  info: "#A5A5A5",
  chartColors: [
    "#007ACC", "#00BCF2", "#89D185", "#E9A700", 
    "#F85149", "#A5A5A5", "#C586C0", "#D7BA7D"
  ]
}

interface ChartBlockProps {
  code: string
}

interface ChartConfig extends ChartConfiguration {
  // Allow for flexible data structure
  data: ChartData<any>
  options?: ChartOptions<any>
}

export default function ChartBlock({ code: originalCode }: ChartBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null)
  const [code, setCode] = useState("")
  const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()
  const { t } = useAppTranslation()

  // Initialize when code changes
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setCode(originalCode)
  }, [originalCode])

  // Debounced chart parsing and rendering
  useDebounceEffect(
    () => {
      setIsLoading(true)
      
      try {
        // Parse JSON configuration
        const config = JSON.parse(code) as ChartConfig
        
        // Validate required properties
        if (!config.type) {
          throw new Error("Chart type is required")
        }
        
        if (!config.data) {
          throw new Error("Chart data is required")
        }

        // Apply VS Code theme colors if not specified
        const themedConfig = applyVSCodeTheme(config)
        
        setChartConfig(themedConfig)
        setError(null)
      } catch (err) {
        console.warn("Chart JSON parse/validation failed:", err)
        const errorMessage = err instanceof Error ? err.message : t("common:chart.parse_error")
        setError(errorMessage)
        setChartConfig(null)
      } finally {
        setIsLoading(false)
      }
    },
    500, // 500ms debounce
    [code, t]
  )

  // Apply VS Code theme colors to chart configuration
  const applyVSCodeTheme = (config: ChartConfig): ChartConfig => {
    const themedConfig = { ...config }
    
    // Apply default colors to datasets if not specified
    if (themedConfig.data?.datasets) {
      themedConfig.data.datasets = themedConfig.data.datasets.map((dataset, index) => {
        const colorIndex = index % VS_CODE_THEME_COLORS.chartColors.length
        const color = VS_CODE_THEME_COLORS.chartColors[colorIndex]
        
        return {
          ...dataset,
          backgroundColor: dataset.backgroundColor || (config.type === 'pie' || config.type === 'doughnut' 
            ? VS_CODE_THEME_COLORS.chartColors.slice(0, dataset.data?.length || 1)
            : color + '80'), // Add transparency for area charts
          borderColor: dataset.borderColor || color,
          borderWidth: dataset.borderWidth || 2,
        }
      })
    }

    // Apply VS Code theme to options
    const defaultOptions: ChartOptions<any> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'var(--vscode-editor-foreground)',
            font: {
              family: 'var(--vscode-font-family)',
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'var(--vscode-dropdown-background)',
          titleColor: 'var(--vscode-editor-foreground)',
          bodyColor: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-dropdown-border)',
          borderWidth: 1
        }
      },
      scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
        x: {
          ticks: {
            color: 'var(--vscode-editor-foreground)',
            font: {
              family: 'var(--vscode-font-family)',
              size: 11
            }
          },
          grid: {
            color: 'var(--vscode-panel-border)'
          }
        },
        y: {
          ticks: {
            color: 'var(--vscode-editor-foreground)', 
            font: {
              family: 'var(--vscode-font-family)',
              size: 11
            }
          },
          grid: {
            color: 'var(--vscode-panel-border)'
          }
        }
      } : undefined
    }

    // Merge with user-provided options
    themedConfig.options = {
      ...defaultOptions,
      ...themedConfig.options,
      plugins: {
        ...defaultOptions.plugins,
        ...themedConfig.options?.plugins
      }
    }

    return themedConfig
  }

  // Auto-fix common JSON issues
  const autoFixChartStructure = (brokenJson: string): string => {
    try {
      // Common fixes for malformed JSON
      const fixed = brokenJson
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
      
      return JSON.stringify(parsed, null, 2)
    } catch {
      // If auto-fix fails, return original
      return brokenJson
    }
  }

  const handleSyntaxFix = () => {
    const fixedCode = autoFixChartStructure(code)
    if (fixedCode !== code) {
      setCode(fixedCode)
    }
  }

  // Export chart as PNG
  const handleExportChart = () => {
    if (!containerRef.current) return
    
    const canvas = containerRef.current.querySelector('canvas')
    if (!canvas) return

    try {
      const pngDataUrl = canvas.toDataURL('image/png', 1.0)
      vscode.postMessage({
        type: "openImage",
        text: pngDataUrl,
      })
    } catch (err) {
      console.error("Error exporting chart:", err)
    }
  }

  return (
    <ChartBlockContainer>
      {isLoading && (
        <LoadingMessage>
          {t("common:chart.loading")}
        </LoadingMessage>
      )}

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
              <span style={{ fontWeight: "bold" }}>{t("common:chart.parse_error")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <FixButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleSyntaxFix()
                }}
                title={t("common:chart.fix_syntax")}>
                <span className="codicon codicon-wand"></span>
              </FixButton>
              <CopyButton
                onClick={(e) => {
                  e.stopPropagation()
                  const combinedContent = `Error: ${error}\n\n\`\`\`chart\n${code}\n\`\`\``
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
              </div>
              <CodeBlock language="json" source={code} />
            </div>
          )}
        </div>
      ) : chartConfig ? (
        <ChartContainer ref={containerRef} $isLoading={isLoading}>
          <ActionButtons>
            <ExportButton
              onClick={handleExportChart}
              title={t("common:chart.export_png")}>
              <span className="codicon codicon-device-camera"></span>
            </ExportButton>
            <CopyButton
              onClick={(e) => {
                const chartJson = JSON.stringify(chartConfig, null, 2)
                const content = `\`\`\`chart\n${chartJson}\n\`\`\``
                copyWithFeedback(content, e)
              }}>
              <span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`}></span>
            </CopyButton>
          </ActionButtons>
          <Chart
            type={chartConfig.type as any}
            data={chartConfig.data}
            options={chartConfig.options}
          />
        </ChartContainer>
      ) : null}
    </ChartBlockContainer>
  )
}

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