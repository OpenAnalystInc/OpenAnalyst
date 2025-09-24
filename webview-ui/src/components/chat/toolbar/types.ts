/**
 * This file defines all the core types used for the toolbar system with
 * Models, Rules, Prompts, Tools, and MCP components.
 */

import { ReactNode } from 'react'

// ============================
// Core Toolbar Types
// ============================

/**
 * Main toolbar props interface
 */
export interface ChatToolbarProps {
  className?: string
  disabled?: boolean
  onModelChange?: (modelConfig: ModelConfig) => void
  onRuleToggle?: (ruleId: string, enabled: boolean) => void
  onPromptSelect?: (prompt: PromptTemplate) => void
  onToolSelect?: (tool: ToolOption) => void
  workflowMode?: 'plan' | 'chat' | 'agent'
  onWorkflowModeChange?: (mode: 'plan' | 'chat' | 'agent') => void
}

// ============================
// Models Types
// ============================

/**
 * Model categories
 */
export type ModelCategory = 'chat' | 'autocomplete' | 'edit' | 'apply'

/**
 * Model configuration interface
 */
export interface ModelConfig {
  id: string
  category: ModelCategory
  name: string
  provider: string
  model: string
  isSetup: boolean
  isDefault: boolean
  capabilities: string[]
  apiKeyRequired: boolean
  hasApiKey: boolean
}

/**
 * Models dropdown data structure
 */
export interface ModelsData {
  categories: {
    [K in ModelCategory]: {
      name: string
      description: string
      models: ModelConfig[]
      setupRequired: boolean
    }
  }
}

// ============================
// Rules Types
// ============================

/**
 * Rule sources and origins
 */
export type RuleSource = 'global' | 'project' | 'user' | 'model' | 'workspace'

/**
 * Rule status
 */
export type RuleStatus = 'active' | 'inactive' | 'error'

/**
 * Rule interface
 */
export interface Rule {
  id: string
  name: string
  description: string
  content: string
  source: RuleSource
  status: RuleStatus
  enabled: boolean
  priority: number
  patterns?: string[]
  alwaysApply: boolean
  createdAt: Date
  modifiedAt: Date
}

// ============================
// Prompts Types
// ============================

/**
 * Prompt template categories
 */
export type PromptCategory = 'code' | 'debug' | 'review' | 'test' | 'docs' | 'refactor' | 'explain'

/**
 * Prompt template interface
 */
export interface PromptTemplate {
  id: string
  name: string
  description: string
  category: PromptCategory
  template: string
  variables: PromptVariable[]
  tags: string[]
  isFavorite: boolean
  usageCount: number
  createdAt: Date
}

/**
 * Prompt template variable
 */
export interface PromptVariable {
  name: string
  description: string
  type: 'text' | 'number' | 'boolean' | 'select'
  required: boolean
  defaultValue?: string | number | boolean
  options?: string[] // for select type
}

// ============================
// Tools Types
// ============================

/**
 * Tool categories
 */
export type ToolCategory = 'file' | 'search' | 'web' | 'terminal' | 'git' | 'database' | 'ai'

/**
 * Tool status
 */
export type ToolStatus = 'available' | 'unavailable' | 'error'

/**
 * Tool interface
 */
export interface ToolOption {
  id: string
  name: string
  description: string
  category: ToolCategory
  icon: string
  status: ToolStatus
  enabled: boolean
  parameters: ToolParameter[]
  shortcuts?: string[]
  version?: string
}

/**
 * Tool parameter interface
 */
export interface ToolParameter {
  name: string
  type: string
  description: string
  required: boolean
  defaultValue?: any
}

// ============================
// UI Component Types
// ============================

/**
 * Toolbar icon button props
 */
export interface ToolbarButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  icon: ReactNode
  tooltip?: string
  onClick?: () => void
  active?: boolean
  badge?: number | string
  variant?: 'default' | 'active' | 'ghost'
  size?: 'sm' | 'md'
}

/**
 * Dropdown/Popover content props
 */
export interface PopoverContentProps {
  title?: string
  description?: string
  children: ReactNode
  onClose?: () => void
  className?: string
  maxHeight?: number
  searchable?: boolean
  width?: number
}

// ============================
// Mock Data Types
// ============================

/**
 * Mock data configuration for development
 */
export interface MockDataConfig {
  models: ModelsData
  rules: Rule[]
  prompts: PromptTemplate[]
  tools: ToolOption[]
}

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean
  progress?: number
  message?: string
}

/**
 * Error state for error handling
 */
export interface ErrorState {
  hasError: boolean
  error?: Error | string
  code?: string
}

// ============================
// Event Handler Types
// ============================

/**
 * Generic event handler for toolbar actions
 */
export type ToolbarEventHandler<T = any> = (data: T) => void | Promise<void>

/**
 * Keyboard event handler for toolbar shortcuts
 */
export type ToolbarKeyboardHandler = (event: KeyboardEvent) => boolean