/**
 * ChatToolbar - Main toolbar container with icon buttons
 * 
 * This is the main toolbar component that renders above the chat input,
 * containing Models, Rules, Prompts, Tools, and MCP buttons.
 * 
 * Layout: [🔧 Models] [📝 Rules] [💬 Prompts] [⚙️ Tools] [🔗 MCP]
 * 
 * Features:
 * - Consistent spacing and alignment
 * - Responsive design
 * - Keyboard navigation support
 * - Individual component state management
 * - Mock data integration for development
 */

import React, { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

import { ChatToolbarProps } from './types'
import { ModelsButton } from './models/ModelsButton'
import { RulesButton } from './rules/RulesButton'
import { PromptsButton } from './prompts/PromptsButton'
import { ToolsButton } from './tools/ToolsButton'
// PHASE 2: Import relocated MCP button component
import { McpButton } from './mcp/McpButton'

/**
 * Main toolbar component containing all icon buttons
 */
export const ChatToolbar: React.FC<ChatToolbarProps> = ({
  className,
  disabled = false,
  onModelChange,
  onRuleToggle,
  onPromptSelect,
}) => {
  // ============================
  // State Management
  // ============================
  
  // All button components now manage their own popover state internally
  const toolbarRef = useRef<HTMLDivElement>(null)

  // ============================
  // Event Handlers  
  // ============================

  /**
   * Handle keyboard navigation within toolbar
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!toolbarRef.current) return

    // Get all focusable elements within toolbar
    const focusableElements = toolbarRef.current.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    )
    
    if (focusableElements.length === 0) return

    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element)
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
        ;(focusableElements[prevIndex] as HTMLElement).focus()
        break
        
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        const nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1
        ;(focusableElements[nextIndex] as HTMLElement).focus()
        break
        
      case 'Home':
        event.preventDefault()
        ;(focusableElements[0] as HTMLElement).focus()
        break
        
      case 'End':
        event.preventDefault()
        ;(focusableElements[focusableElements.length - 1] as HTMLElement).focus()
        break
        
      case 'Escape':
        // Allow escape to bubble up to close popovers
        break
    }
  }, [])

  // All buttons now handle their own popover state internally



  // ============================
  // Styles
  // ============================

  const toolbarStyles = cn(
    // Base layout
    'flex items-center gap-1 px-2 py-1',
    
    // Visual styling
    'bg-vscode-editor-background',
    'border-b border-vscode-panel-border',
    
    // Responsive behavior
    'min-h-10',
    
    // Accessibility and interactions
    'chat-toolbar',
    'focus-within:outline-none',
    
    // Custom className
    className
  )

  // ============================
  // Render
  // ============================

  return (
    <div 
      ref={toolbarRef}
      className={toolbarStyles} 
      role="toolbar" 
      aria-label="Toolbar with models, rules, prompts, tools, and MCP servers"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Models Button */}
      {/* <ModelsButton
        disabled={disabled}
        onModelSelect={onModelChange}
        onModelSetup={(modelId, category) => {
          console.log('Setting up model:', modelId, 'in category:', category)
          // Handle model setup logic here
        }}
      /> */}

      {/* Rules Button */}
      <RulesButton
        disabled={disabled}
        onRuleToggle={onRuleToggle}
        onCreateRule={() => {
          console.log('Create rule requested')
          // Handle create rule logic here
        }}
        onManageRules={() => {
          console.log('Manage rules requested')  
          // Handle manage rules logic here
        }}
      />

      {/* Prompts Button */}
      <PromptsButton
        disabled={disabled}
        onPromptSelect={onPromptSelect}
        onCreatePrompt={() => {
          console.log('Create prompt requested')
          // Handle create prompt logic here
        }}
        onManagePrompts={() => {
          console.log('Manage prompts requested')
          // Handle manage prompts logic here
        }}
      />

      {/* Tools Button */}
      {/* <ToolsButton
        onToolExecute={(toolId, parameters) => {
          console.log('Tool executed:', toolId, parameters)
          // Note: onToolSelect expects ToolOption, but we only have toolId here
          // This will be handled when implementing the actual tool execution logic
        }}
        onToolConfigure={(tool) => {
          console.log('Configure tool:', tool.name)
          // Handle tool configuration logic here
        }}
        onManageTools={() => {
          console.log('Manage tools clicked')
          // Handle manage tools logic here
        }}
        // Note: ToolsButton manages its own active state internally
      /> */}

      {/* Click → mcpButtonClicked action → MCP tab → McpView component */}
      <McpButton disabled={disabled} />

      {/* TODO: Add individual popover components here */}
      {/* Models, Rules, and Prompts popovers are now handled by their respective button components */}
      
      {/* Tools and MCP popovers are now handled by their respective button components */}
    </div>
  )
}