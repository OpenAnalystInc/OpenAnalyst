/**
 * Tabs Component - Simple tab navigation component
 * Based on headless UI principles with VS Code theming
 */

import React, { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

// Context for sharing tab state
const TabsContext = createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

// Main Tabs container
interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  children,
  className
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// Tabs List (tab buttons container)
interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export const TabsList: React.FC<TabsListProps> = ({
  children,
  className
}) => {
  return (
    <div 
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg',
        'bg-vscode-editor-background border border-vscode-dropdown-border',
        'p-1',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  )
}

// Individual Tab Trigger (tab button)
interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className
}) => {
  const context = useContext(TabsContext)
  
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs')
  }

  const { value: currentValue, onValueChange } = context
  const isActive = currentValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap',
        'rounded-md px-3 py-1.5 text-sm font-medium',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focusBorder',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-vscode-button-background text-vscode-button-foreground shadow'
          : 'text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-list-hoverBackground',
        className
      )}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  )
}

// Tab Content Panel
interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className
}) => {
  const context = useContext(TabsContext)
  
  if (!context) {
    throw new Error('TabsContent must be used within Tabs')
  }

  const { value: currentValue } = context
  
  if (currentValue !== value) {
    return null
  }

  return (
    <div 
      role="tabpanel"
      className={cn('mt-2 ring-offset-background focus-visible:outline-none', className)}
    >
      {children}
    </div>
  )
}