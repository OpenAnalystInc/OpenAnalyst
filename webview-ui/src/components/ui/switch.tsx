/**
 * Switch Component - Toggle switch component
 * Based on headless UI principles with VS Code theming
 */

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled = false, size = 'default', className }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-7',
      default: 'h-5 w-9', 
      lg: 'h-6 w-11'
    }

    const thumbSizeClasses = {
      sm: 'h-3 w-3 data-[state=checked]:translate-x-3',
      default: 'h-4 w-4 data-[state=checked]:translate-x-4',
      lg: 'h-5 w-5 data-[state=checked]:translate-x-5'
    }

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focusBorder focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked 
            ? 'bg-vscode-button-background' 
            : 'bg-vscode-input-background border-vscode-input-border',
          sizeClasses[size],
          className
        )}
        onClick={() => !disabled && onCheckedChange(!checked)}
        data-state={checked ? 'checked' : 'unchecked'}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-full shadow-lg ring-0',
            'transition-transform duration-200 ease-in-out',
            checked 
              ? 'bg-vscode-button-foreground' 
              : 'bg-vscode-foreground',
            thumbSizeClasses[size],
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
          data-state={checked ? 'checked' : 'unchecked'}
        />
      </button>
    )
  }
)

Switch.displayName = 'Switch'