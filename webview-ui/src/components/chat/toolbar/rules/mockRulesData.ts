/**
 * Mock data for Rules component
 * 
 * This file contains mock data for coding rules and guidelines that can be
 * applied to AI interactions.
 * 
 * Rules can be categorized by source (global, project, user) and can be
 * enabled/disabled with different priorities and pattern matching.
 */

import { Rule, RuleSource, RuleStatus } from '../types'

/**
 * Mock rule definitions with various sources and patterns
 */
export const mockRulesData: Rule[] = [
  // Global Rules
  {
    id: 'global-typescript-strict',
    name: 'TypeScript Strict Mode',
    description: 'Always use strict TypeScript settings with proper type definitions',
    content: `When writing TypeScript code:
- Use strict type definitions
- Avoid 'any' type unless absolutely necessary
- Define interfaces for all objects
- Use proper generic types
- Enable strict mode in tsconfig.json`,
    source: 'global',
    status: 'active',
    enabled: true,
    priority: 10,
    patterns: ['**/*.ts', '**/*.tsx'],
    alwaysApply: false,
    createdAt: new Date('2024-01-15'),
    modifiedAt: new Date('2024-01-20')
  },

  {
    id: 'global-react-patterns',
    name: 'React Best Practices',
    description: 'Follow React hooks and component patterns',
    content: `React component guidelines:
- Use functional components with hooks
- Implement proper prop types/interfaces
- Use useCallback and useMemo for optimization
- Follow component naming conventions (PascalCase)
- Keep components focused and single-purpose`,
    source: 'global',
    status: 'active',
    enabled: true,
    priority: 9,
    patterns: ['**/*.tsx', '**/*.jsx'],
    alwaysApply: true,
    createdAt: new Date('2024-01-10'),
    modifiedAt: new Date('2024-02-01')
  },

  {
    id: 'global-error-handling',
    name: 'Comprehensive Error Handling',
    description: 'Always include proper error handling and logging',
    content: `Error handling requirements:
- Wrap async operations in try-catch blocks
- Provide meaningful error messages
- Log errors with context information
- Handle edge cases and validation
- Use proper HTTP status codes in APIs`,
    source: 'global',
    status: 'active',
    enabled: true,
    priority: 8,
    patterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
    alwaysApply: true,
    createdAt: new Date('2024-01-05'),
    modifiedAt: new Date('2024-01-25')
  },

  // Project Rules
  {
    id: 'project-vscode-theme',
    name: 'VSCode Theme Variables',
    description: 'Use VSCode CSS variables for consistent theming',
    content: `VSCode extension styling:
- Use vscode-* CSS variables for colors
- Follow VSCode design patterns
- Ensure dark/light theme compatibility
- Use proper contrast ratios
- Follow VSCode extension guidelines`,
    source: 'project',
    status: 'active',
    enabled: true,
    priority: 7,
    patterns: ['**/*.css', '**/*.tsx'],
    alwaysApply: false,
    createdAt: new Date('2024-02-01'),
    modifiedAt: new Date('2024-02-10')
  },

  {
    id: 'project-component-structure',
    name: 'Component File Structure',
    description: 'Organize components with consistent file structure',
    content: `Component organization:
- One component per file
- Co-locate types with components
- Use index.ts for barrel exports
- Keep related components in folders
- Follow naming conventions: ComponentName.tsx`,
    source: 'project',
    status: 'active',
    enabled: true,
    priority: 6,
    patterns: ['src/components/**/*'],
    alwaysApply: false,
    createdAt: new Date('2024-01-20'),
    modifiedAt: new Date('2024-02-05')
  },

  // User Rules
  {
    id: 'user-comments-style',
    name: 'Code Documentation Style',
    description: 'Consistent commenting and documentation patterns',
    content: `Documentation standards:
- Use JSDoc for function documentation
- Include parameter and return type descriptions
- Add inline comments for complex logic
- Document component props and usage
- Keep comments up to date with code changes`,
    source: 'user',
    status: 'active',
    enabled: false, // User disabled this rule
    priority: 5,
    patterns: ['**/*.ts', '**/*.tsx'],
    alwaysApply: false,
    createdAt: new Date('2024-01-25'),
    modifiedAt: new Date('2024-02-12')
  },

  {
    id: 'user-testing-patterns',
    name: 'Testing Requirements',
    description: 'Include comprehensive test coverage',
    content: `Testing guidelines:
- Write unit tests for all components
- Include integration tests for critical flows
- Use descriptive test names
- Test error conditions and edge cases
- Maintain at least 80% code coverage`,
    source: 'user',
    status: 'active',
    enabled: true,
    priority: 4,
    patterns: ['**/*.test.ts', '**/*.spec.ts'],
    alwaysApply: false,
    createdAt: new Date('2024-02-01'),
    modifiedAt: new Date('2024-02-15')
  },

  // Model Rules
  {
    id: 'model-accessibility',
    name: 'Accessibility Standards',
    description: 'Ensure WCAG compliance and accessibility features',
    content: `Accessibility requirements:
- Include proper ARIA labels and roles
- Ensure keyboard navigation support
- Provide alt text for images
- Use semantic HTML elements
- Test with screen readers
- Follow WCAG 2.1 AA guidelines`,
    source: 'model',
    status: 'active',
    enabled: true,
    priority: 8,
    patterns: ['**/*.tsx', '**/*.jsx'],
    alwaysApply: true,
    createdAt: new Date('2024-01-30'),
    modifiedAt: new Date('2024-02-08')
  },

  // Workspace Rules
  {
    id: 'workspace-naming',
    name: 'File Naming Conventions',
    description: 'Consistent file and variable naming patterns',
    content: `Naming conventions:
- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Use kebab-case for file names (except components)
- Use UPPER_CASE for constants
- Use descriptive, meaningful names`,
    source: 'workspace',
    status: 'active',
    enabled: true,
    priority: 3,
    patterns: ['**/*'],
    alwaysApply: false,
    createdAt: new Date('2024-01-18'),
    modifiedAt: new Date('2024-01-28')
  },

  // Inactive Rule
  {
    id: 'deprecated-jquery',
    name: 'Avoid jQuery Usage',
    description: 'Use modern JavaScript instead of jQuery',
    content: `Modern JavaScript alternatives:
- Use native DOM methods instead of jQuery
- Use fetch() instead of $.ajax()
- Use modern array methods (map, filter, reduce)
- Use ES6+ features and syntax
- Avoid jQuery dependencies`,
    source: 'global',
    status: 'inactive',
    enabled: false,
    priority: 1,
    patterns: ['**/*.js', '**/*.ts'],
    alwaysApply: false,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-02')
  }
]

/**
 * Helper function to get rules by source
 */
export const getRulesBySource = (source: RuleSource): Rule[] => {
  return mockRulesData.filter(rule => rule.source === source)
}

/**
 * Helper function to get active rules only
 */
export const getActiveRules = (): Rule[] => {
  return mockRulesData.filter(rule => rule.enabled && rule.status === 'active')
}

/**
 * Helper function to get rules by pattern match
 */
export const getRulesByPattern = (filePath: string): Rule[] => {
  return mockRulesData.filter(rule => {
    if (rule.alwaysApply) return rule.enabled
    if (!rule.patterns || !rule.enabled) return false
    
    return rule.patterns.some(pattern => {
      // Simple pattern matching (could be enhanced with glob library)
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
      return regex.test(filePath)
    })
  })
}

/**
 * Helper function to get rule statistics
 */
export const getRuleStats = () => {
  const total = mockRulesData.length
  const active = mockRulesData.filter(r => r.enabled).length
  const bySource = mockRulesData.reduce((acc, rule) => {
    acc[rule.source] = (acc[rule.source] || 0) + 1
    return acc
  }, {} as Record<RuleSource, number>)

  return { total, active, bySource }
}

/**
 * Helper function to simulate rule toggle
 */
export const simulateRuleToggle = (ruleId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rule = mockRulesData.find(r => r.id === ruleId)
      if (rule) {
        rule.enabled = !rule.enabled
        rule.modifiedAt = new Date()
        console.log(`Rule ${ruleId} ${rule.enabled ? 'enabled' : 'disabled'}`)
      }
      resolve(true)
    }, 500) // Simulate 500ms toggle time
  })
}