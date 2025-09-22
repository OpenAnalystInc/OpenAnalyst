/**
 * ToolbarButton
 * 
 * This component provides a consistent button design for all toolbar icons
 * with hover states, tooltips, badges, and accessibility features.
 * 
 * Features:
 * - Consistent styling
 * - Hover and active states with smooth transitions
 * - Optional badge for counts/notifications
 * - Tooltip support for accessibility
 * - Keyboard navigation support
 * - Loading and disabled states
 */

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ToolbarButtonProps } from './types'

/**
 * ToolbarButton component for consistent toolbar icon styling
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(({
  icon,
  tooltip,
  onClick,
  disabled = false,
  active = false,
  badge,
  className,
  variant = 'default',
  size = 'md',
  ...props
}, ref) => {
  /**
   * Handle button click with disabled state check
   */
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (onClick) {
      onClick()
    }
  }

  /**
   * Handle keyboard navigation (Enter and Space)
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!disabled && onClick) {
        onClick()
      }
    }
  }

  /**
   * Base button styles
   */
  const baseStyles = cn(
    // Base layout and typography
    'relative inline-flex items-center justify-center rounded-md',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focusBorder',
    'select-none',
    
    // Size variants
    size === 'sm' && 'h-6 w-6 text-xs',
    size === 'md' && 'h-8 w-8 text-sm',
    
    // Variant styles
    variant === 'default' && [
      'text-vscode-foreground bg-transparent',
      'border border-transparent',
      'hover:bg-vscode-toolbar-hoverBackground',
      'hover:border-vscode-contrastBorder'
    ],
    
    variant === 'active' && [
      'text-vscode-foreground bg-vscode-button-secondaryBackground',
      'border border-vscode-contrastBorder',
      'hover:bg-vscode-button-secondaryHoverBackground'
    ],
    
    variant === 'ghost' && [
      'text-vscode-descriptionForeground bg-transparent',
      'border border-transparent',
      'hover:text-vscode-foreground',
      'hover:bg-vscode-toolbar-hoverBackground'
    ],
    
    // Active state
    active && [
      'bg-vscode-button-secondaryBackground',
      'border-vscode-contrastBorder',
      'text-vscode-foreground'
    ],
    
    // Disabled state
    disabled && [
      'opacity-50 cursor-not-allowed',
      'hover:bg-transparent hover:border-transparent'
    ],
    
    // Custom className
    className
  )

  /**
   * Badge styles for notification counts
   */
  const badgeStyles = cn(
    'absolute -top-1 -right-1 min-w-4 h-4',
    'flex items-center justify-center',
    'text-xs font-medium leading-none',
    'bg-vscode-badge-background text-vscode-badge-foreground',
    'rounded-full px-1',
    'animate-fade-in'
  )

  /**
   * Render the button with optional tooltip wrapper
   */
  const button = (
    <button
      ref={ref}
      type="button"
      className={baseStyles}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={tooltip}
      title={tooltip}
      tabIndex={disabled ? -1 : 0}
      {...props}
    >
      {/* Main icon */}
      <span className="flex items-center justify-center">
        {icon}
      </span>
      
      {/* Optional badge */}
      {badge && (
        <span className={badgeStyles}>
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )

  return button
})

ToolbarButton.displayName = 'ToolbarButton'