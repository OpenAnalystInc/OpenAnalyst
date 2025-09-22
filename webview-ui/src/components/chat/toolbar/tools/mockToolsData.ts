/**
 * Mock data for Tools component
 * This file contains mock data for development tools that provide various
 * capabilities like file operations, search, web access, terminal commands,
 * git operations, and database access.
 * 
 * Tools are organized by categories and include status indicators, parameters,
 * and usage instructions for different development scenarios.
 */

import { ToolOption, ToolCategory, ToolStatus, ToolParameter } from '../types'

/**
 * Mock tool definitions organized by category
 */
export const mockToolsData: ToolOption[] = [
  // ============================
  // File Category
  // ============================
  {
    id: 'file-read',
    name: 'Read File',
    description: 'Read the contents of a file from the filesystem',
    category: 'file',
    icon: 'FileText',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'filePath',
        type: 'string',
        description: 'Path to the file to read',
        required: true
      },
      {
        name: 'encoding',
        type: 'string',
        description: 'File encoding (default: utf-8)',
        required: false,
        defaultValue: 'utf-8'
      }
    ],
    shortcuts: ['Cmd+O', 'Ctrl+O']
  },

  {
    id: 'file-write',
    name: 'Write File',
    description: 'Write content to a file on the filesystem',
    category: 'file',
    icon: 'Save',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'filePath',
        type: 'string',
        description: 'Path where the file should be written',
        required: true
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to write to the file',
        required: true
      },
      {
        name: 'createDirectories',
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist',
        required: false,
        defaultValue: false
      }
    ],
    shortcuts: ['Cmd+S', 'Ctrl+S']
  },

  {
    id: 'file-list-directory',
    name: 'List Directory',
    description: 'List files and directories in a given path',
    category: 'file',
    icon: 'Folder',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'directoryPath',
        type: 'string',
        description: 'Path to the directory to list',
        required: true
      },
      {
        name: 'recursive',
        type: 'boolean',
        description: 'List files recursively',
        required: false,
        defaultValue: false
      },
      {
        name: 'includeHidden',
        type: 'boolean',
        description: 'Include hidden files and directories',
        required: false,
        defaultValue: false
      }
    ],
    shortcuts: ['Cmd+Shift+E', 'Ctrl+Shift+E']
  },

  // ============================
  // Search Category
  // ============================
  {
    id: 'search-files',
    name: 'Search Files',
    description: 'Search for files by name pattern across the codebase',
    category: 'search',
    icon: 'Search',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'pattern',
        type: 'string',
        description: 'Search pattern (supports wildcards)',
        required: true
      },
      {
        name: 'directory',
        type: 'string',
        description: 'Directory to search in',
        required: false,
        defaultValue: '.'
      },
      {
        name: 'caseSensitive',
        type: 'boolean',
        description: 'Case sensitive search',
        required: false,
        defaultValue: false
      }
    ],
    shortcuts: ['Cmd+P', 'Ctrl+P']
  },

  {
    id: 'search-content',
    name: 'Search Content',
    description: 'Search for text content within files using regex',
    category: 'search',
    icon: 'FileSearch',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query or regex pattern',
        required: true
      },
      {
        name: 'fileTypes',
        type: 'string',
        description: 'File extensions to include (comma-separated)',
        required: false,
        defaultValue: 'js,ts,tsx,jsx,py,java,go'
      },
      {
        name: 'excludePatterns',
        type: 'string',
        description: 'Patterns to exclude from search',
        required: false,
        defaultValue: 'node_modules,dist,build'
      },
      {
        name: 'maxResults',
        type: 'number',
        description: 'Maximum number of results',
        required: false,
        defaultValue: 100
      }
    ],
    shortcuts: ['Cmd+Shift+F', 'Ctrl+Shift+F']
  },

  // ============================
  // Web Category
  // ============================
  {
    id: 'web-fetch',
    name: 'Web Fetch',
    description: 'Fetch content from a web URL',
    category: 'web',
    icon: 'Globe',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL to fetch content from',
        required: true
      },
      {
        name: 'method',
        type: 'string',
        description: 'HTTP method (GET, POST, PUT, DELETE)',
        required: false,
        defaultValue: 'GET'
      },
      {
        name: 'headers',
        type: 'string',
        description: 'HTTP headers as JSON string',
        required: false
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in seconds',
        required: false,
        defaultValue: 30
      }
    ]
  },

  {
    id: 'web-scrape',
    name: 'Web Scraper',
    description: 'Scrape and extract content from web pages',
    category: 'web',
    icon: 'Download',
    status: 'available',
    enabled: false, // Disabled by default for safety
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL of the page to scrape',
        required: true
      },
      {
        name: 'selector',
        type: 'string',
        description: 'CSS selector for content extraction',
        required: false
      },
      {
        name: 'followLinks',
        type: 'boolean',
        description: 'Follow links on the page',
        required: false,
        defaultValue: false
      }
    ]
  },

  // ============================
  // Terminal Category
  // ============================
  {
    id: 'terminal-execute',
    name: 'Execute Command',
    description: 'Execute shell commands in the terminal',
    category: 'terminal',
    icon: 'Terminal',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Shell command to execute',
        required: true
      },
      {
        name: 'workingDirectory',
        type: 'string',
        description: 'Working directory for the command',
        required: false,
        defaultValue: '.'
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Command timeout in seconds',
        required: false,
        defaultValue: 60
      }
    ],
    shortcuts: ['Cmd+`', 'Ctrl+`']
  },

  {
    id: 'terminal-npm',
    name: 'NPM Commands',
    description: 'Execute NPM package manager commands',
    category: 'terminal',
    icon: 'Package',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'NPM action (install, run, test, build, etc.)',
        required: true
      },
      {
        name: 'package',
        type: 'string',
        description: 'Package name (for install/uninstall)',
        required: false
      },
      {
        name: 'flags',
        type: 'string',
        description: 'Additional NPM flags',
        required: false
      }
    ]
  },

  // ============================
  // Git Category
  // ============================
  {
    id: 'git-status',
    name: 'Git Status',
    description: 'Check the current git repository status',
    category: 'git',
    icon: 'GitBranch',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'repository',
        type: 'string',
        description: 'Path to git repository',
        required: false,
        defaultValue: '.'
      }
    ]
  },

  {
    id: 'git-diff',
    name: 'Git Diff',
    description: 'Show differences between commits, branches, or files',
    category: 'git',
    icon: 'GitCommit',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'target',
        type: 'string',
        description: 'Branch, commit, or file to compare',
        required: false
      },
      {
        name: 'staged',
        type: 'boolean',
        description: 'Show staged changes only',
        required: false,
        defaultValue: false
      }
    ]
  },

  {
    id: 'git-log',
    name: 'Git Log',
    description: 'View commit history with filtering options',
    category: 'git',
    icon: 'History',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'maxCount',
        type: 'number',
        description: 'Maximum number of commits to show',
        required: false,
        defaultValue: 10
      },
      {
        name: 'author',
        type: 'string',
        description: 'Filter by author',
        required: false
      },
      {
        name: 'since',
        type: 'string',
        description: 'Show commits since date (YYYY-MM-DD)',
        required: false
      }
    ]
  },

  // ============================
  // Database Category
  // ============================
  {
    id: 'db-query',
    name: 'Database Query',
    description: 'Execute SQL queries against connected databases',
    category: 'database',
    icon: 'Database',
    status: 'unavailable',
    enabled: false,
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'SQL query to execute',
        required: true
      },
      {
        name: 'connection',
        type: 'string',
        description: 'Database connection string',
        required: true
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of rows to return',
        required: false,
        defaultValue: 100
      }
    ]
  },

  {
    id: 'db-schema',
    name: 'Database Schema',
    description: 'Inspect database schema and table structures',
    category: 'database',
    icon: 'Table',
    status: 'error',
    enabled: false,
    parameters: [
      {
        name: 'connection',
        type: 'string',
        description: 'Database connection string',
        required: true
      },
      {
        name: 'table',
        type: 'string',
        description: 'Specific table to inspect (optional)',
        required: false
      }
    ]
  },

  // ============================
  // AI Category
  // ============================
  {
    id: 'ai-code-review',
    name: 'AI Code Review',
    description: 'Automated code review using AI analysis',
    category: 'ai',
    icon: 'Brain',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'filePath',
        type: 'string',
        description: 'Path to file or directory to review',
        required: true
      },
      {
        name: 'reviewType',
        type: 'string',
        description: 'Type of review (security, performance, style, all)',
        required: false,
        defaultValue: 'all'
      },
      {
        name: 'severity',
        type: 'string',
        description: 'Minimum severity level (info, warning, error)',
        required: false,
        defaultValue: 'warning'
      }
    ]
  },

  {
    id: 'ai-test-generation',
    name: 'AI Test Generator',
    description: 'Generate unit tests using AI analysis',
    category: 'ai',
    icon: 'TestTube',
    status: 'available',
    enabled: true,
    parameters: [
      {
        name: 'sourceFile',
        type: 'string',
        description: 'Source file to generate tests for',
        required: true
      },
      {
        name: 'testFramework',
        type: 'string',
        description: 'Testing framework (jest, mocha, vitest, pytest)',
        required: false,
        defaultValue: 'jest'
      },
      {
        name: 'coverage',
        type: 'number',
        description: 'Target coverage percentage',
        required: false,
        defaultValue: 90
      }
    ]
  }
]

/**
 * Helper function to get tools by category
 */
export const getToolsByCategory = (category: ToolCategory): ToolOption[] => {
  return mockToolsData.filter(tool => tool.category === category)
}

/**
 * Helper function to get available tools only
 */
export const getAvailableTools = (): ToolOption[] => {
  return mockToolsData.filter(tool => tool.status === 'available')
}

/**
 * Helper function to get enabled tools only
 */
export const getEnabledTools = (): ToolOption[] => {
  return mockToolsData.filter(tool => tool.enabled && tool.status === 'available')
}

/**
 * Helper function to get tools by status
 */
export const getToolsByStatus = (status: ToolStatus): ToolOption[] => {
  return mockToolsData.filter(tool => tool.status === status)
}

/**
 * Helper function to search tools
 */
export const searchTools = (query: string): ToolOption[] => {
  const searchLower = query.toLowerCase()
  return mockToolsData.filter(tool =>
    tool.name.toLowerCase().includes(searchLower) ||
    tool.description.toLowerCase().includes(searchLower) ||
    tool.category.toLowerCase().includes(searchLower)
  )
}

/**
 * Helper function to get tool statistics
 */
export const getToolStats = () => {
  const total = mockToolsData.length
  const available = mockToolsData.filter(t => t.status === 'available').length
  const enabled = mockToolsData.filter(t => t.enabled).length
  const byCategory = mockToolsData.reduce((acc, tool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1
    return acc
  }, {} as Record<ToolCategory, number>)
  const byStatus = mockToolsData.reduce((acc, tool) => {
    acc[tool.status] = (acc[tool.status] || 0) + 1
    return acc
  }, {} as Record<ToolStatus, number>)

  return { total, available, enabled, byCategory, byStatus }
}

/**
 * Helper function to simulate tool execution
 */
export const simulateToolExecution = (toolId: string, parameters: Record<string, any>): Promise<{ success: boolean; result?: any; error?: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const tool = mockToolsData.find(t => t.id === toolId)
      if (!tool) {
        resolve({ success: false, error: 'Tool not found' })
        return
      }

      if (tool.status !== 'available') {
        resolve({ success: false, error: `Tool is ${tool.status}` })
        return
      }

      if (!tool.enabled) {
        resolve({ success: false, error: 'Tool is disabled' })
        return
      }

      // Simulate successful execution
      console.log(`Executing tool: ${tool.name}`, parameters)
      resolve({ 
        success: true, 
        result: `Tool "${tool.name}" executed successfully with parameters: ${JSON.stringify(parameters)}` 
      })
    }, 1000 + Math.random() * 2000) // Simulate 1-3 second execution time
  })
}

/**
 * Helper function to toggle tool enabled state
 */
export const simulateToolToggle = (toolId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const tool = mockToolsData.find(t => t.id === toolId)
      if (tool && tool.status === 'available') {
        tool.enabled = !tool.enabled
        console.log(`Tool ${toolId} ${tool.enabled ? 'enabled' : 'disabled'}`)
        resolve(tool.enabled)
      } else {
        console.log(`Cannot toggle tool ${toolId} - not available`)
        resolve(false)
      }
    }, 300) // Simulate 300ms toggle time
  })
}