/**
 * Mock data for Prompts component
 * This file contains mock data for prompt templates that provide quick access
 * to common coding tasks, debugging scenarios, code review patterns, and more.
 * 
 * Templates are organized by categories and include variables for customization,
 * usage statistics, and favorite status for personalization.
 */

import { PromptTemplate, PromptCategory, PromptVariable } from '../types'

/**
 * Mock prompt template definitions organized by category
 */
export const mockPromptsData: PromptTemplate[] = [
  // ============================
  // Code Category
  // ============================
  {
    id: 'code-function-create',
    name: 'Create Function',
    description: 'Generate a new function with proper documentation',
    category: 'code',
    template: `Create a {{language}} function that {{description}}.

Requirements:
- Function name: {{functionName}}
- Parameters: {{parameters}}
- Return type: {{returnType}}
- Include comprehensive JSDoc/documentation
- Follow best practices for error handling
- Add input validation where appropriate
- Include usage examples

{{#if includeTests}}
Also create unit tests for this function.
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'select', required: true, options: ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go'] },
      { name: 'description', description: 'What the function should do', type: 'text', required: true },
      { name: 'functionName', description: 'Name of the function', type: 'text', required: true },
      { name: 'parameters', description: 'Function parameters', type: 'text', required: false, defaultValue: 'none' },
      { name: 'returnType', description: 'Return type', type: 'text', required: false, defaultValue: 'void' },
      { name: 'includeTests', description: 'Include unit tests', type: 'boolean', required: false, defaultValue: false }
    ],
    tags: ['function', 'generation', 'documentation'],
    isFavorite: true,
    usageCount: 45,
    createdAt: new Date('2024-01-15')
  },

  {
    id: 'code-class-create',
    name: 'Create Class',
    description: 'Generate a class with properties and methods',
    category: 'code',
    template: `Create a {{language}} class named {{className}} that {{description}}.

Requirements:
- Include constructor with parameters: {{constructorParams}}
- Add these properties: {{properties}}
- Implement these methods: {{methods}}
- Use proper access modifiers (private, public, protected)
- Include class documentation
- Follow SOLID principles
- Add type annotations where applicable

{{#if implementInterface}}
The class should implement interface: {{interfaceName}}
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'select', required: true, options: ['TypeScript', 'JavaScript', 'Java', 'C#', 'Python'] },
      { name: 'className', description: 'Name of the class', type: 'text', required: true },
      { name: 'description', description: 'Purpose of the class', type: 'text', required: true },
      { name: 'constructorParams', description: 'Constructor parameters', type: 'text', required: false },
      { name: 'properties', description: 'Class properties', type: 'text', required: false },
      { name: 'methods', description: 'Class methods', type: 'text', required: false },
      { name: 'implementInterface', description: 'Implements an interface', type: 'boolean', required: false },
      { name: 'interfaceName', description: 'Interface name', type: 'text', required: false }
    ],
    tags: ['class', 'object-oriented', 'structure'],
    isFavorite: false,
    usageCount: 32,
    createdAt: new Date('2024-01-20')
  },

  // ============================
  // Debug Category
  // ============================
  {
    id: 'debug-error-analysis',
    name: 'Analyze Error',
    description: 'Analyze and provide solutions for error messages',
    category: 'debug',
    template: `I'm getting this error in my {{language}} {{projectType}}:

Error Message: {{errorMessage}}
{{#if stackTrace}}
Stack Trace: {{stackTrace}}
{{/if}}

Context:
- File: {{filename}}
- Line: {{lineNumber}}
- What I was trying to do: {{context}}

Please:
1. Explain what this error means
2. Identify the most likely causes
3. Provide step-by-step solutions
4. Suggest preventive measures for the future
5. Show code examples if applicable

{{#if includeAlternatives}}
Also suggest alternative approaches to achieve the same goal.
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'text', required: true },
      { name: 'projectType', description: 'Type of project', type: 'text', required: true },
      { name: 'errorMessage', description: 'The error message', type: 'text', required: true },
      { name: 'stackTrace', description: 'Stack trace (if available)', type: 'text', required: false },
      { name: 'filename', description: 'File where error occurred', type: 'text', required: false },
      { name: 'lineNumber', description: 'Line number', type: 'number', required: false },
      { name: 'context', description: 'What you were trying to do', type: 'text', required: true },
      { name: 'includeAlternatives', description: 'Include alternative approaches', type: 'boolean', required: false }
    ],
    tags: ['debugging', 'error-analysis', 'troubleshooting'],
    isFavorite: true,
    usageCount: 78,
    createdAt: new Date('2024-01-10')
  },

  {
    id: 'debug-performance-issue',
    name: 'Performance Analysis',
    description: 'Analyze and optimize performance issues',
    category: 'debug',
    template: `I'm experiencing performance issues in my {{language}} application:

Issue Description: {{issueDescription}}
Performance Metrics: {{metrics}}
Expected vs Actual: {{expectations}}

Code Context:
{{codeSnippet}}

Environment:
- Platform: {{platform}}
- Memory usage: {{memoryUsage}}
- CPU usage: {{cpuUsage}}

Please help me:
1. Identify performance bottlenecks
2. Analyze the code for inefficiencies  
3. Suggest optimization strategies
4. Recommend profiling tools
5. Provide optimized code examples

{{#if scaleRequirements}}
Also consider scalability for: {{scaleRequirements}}
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'text', required: true },
      { name: 'issueDescription', description: 'Performance issue description', type: 'text', required: true },
      { name: 'metrics', description: 'Performance metrics', type: 'text', required: false },
      { name: 'expectations', description: 'Expected vs actual performance', type: 'text', required: true },
      { name: 'codeSnippet', description: 'Relevant code', type: 'text', required: true },
      { name: 'platform', description: 'Platform/environment', type: 'text', required: false },
      { name: 'memoryUsage', description: 'Memory usage info', type: 'text', required: false },
      { name: 'cpuUsage', description: 'CPU usage info', type: 'text', required: false },
      { name: 'scaleRequirements', description: 'Scalability requirements', type: 'text', required: false }
    ],
    tags: ['performance', 'optimization', 'profiling'],
    isFavorite: true,
    usageCount: 56,
    createdAt: new Date('2024-01-25')
  },

  // ============================
  // Review Category
  // ============================
  {
    id: 'review-code-security',
    name: 'Security Code Review',
    description: 'Comprehensive security review of code',
    category: 'review',
    template: `Please perform a comprehensive security review of this {{language}} code:

{{codeToReview}}

Focus Areas:
{{#each securityAreas}}
- {{this}}
{{/each}}

Please analyze for:
1. **Input Validation**: Check for proper sanitization and validation
2. **Authentication/Authorization**: Verify access controls
3. **Data Protection**: Ensure sensitive data handling
4. **Injection Vulnerabilities**: SQL, XSS, Command injection, etc.
5. **Error Handling**: Prevent information leakage
6. **Cryptography**: Review encryption and hashing
7. **Dependencies**: Check for vulnerable packages
8. **Configuration**: Review security settings

Provide:
- Severity rating for each issue (Critical/High/Medium/Low)
- Specific remediation steps
- Code examples of fixes
- Best practices recommendations

{{#if complianceStandards}}
Also check compliance with: {{complianceStandards}}
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'text', required: true },
      { name: 'codeToReview', description: 'Code to review', type: 'text', required: true },
      { name: 'securityAreas', description: 'Specific security areas to focus on', type: 'text', required: false },
      { name: 'complianceStandards', description: 'Compliance standards to check', type: 'text', required: false }
    ],
    tags: ['security', 'code-review', 'vulnerabilities'],
    isFavorite: false,
    usageCount: 23,
    createdAt: new Date('2024-02-01')
  },

  // ============================
  // Test Category
  // ============================
  {
    id: 'test-unit-create',
    name: 'Create Unit Tests',
    description: 'Generate comprehensive unit tests for code',
    category: 'test',
    template: `Create comprehensive unit tests for this {{language}} {{codeType}}:

{{codeToTest}}

Test Requirements:
- Testing framework: {{testFramework}}
- Coverage target: {{coverageTarget}}%
- Test types needed: {{testTypes}}

Please generate tests that cover:
1. **Happy Path**: Normal operation scenarios
2. **Edge Cases**: Boundary conditions and limits
3. **Error Handling**: Exception and error scenarios
4. **Input Validation**: Invalid and malicious inputs
5. **State Testing**: Different object/system states
6. **Integration Points**: External dependencies (mocked)

For each test:
- Use descriptive test names
- Include arrange, act, assert pattern
- Add comments explaining complex test logic
- Mock external dependencies appropriately
- Include setup and teardown where needed

{{#if includePerformanceTests}}
Also include basic performance/benchmark tests.
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'text', required: true },
      { name: 'codeType', description: 'Type of code (function, class, module)', type: 'text', required: true },
      { name: 'codeToTest', description: 'Code to create tests for', type: 'text', required: true },
      { name: 'testFramework', description: 'Testing framework to use', type: 'select', required: true, options: ['Jest', 'Mocha', 'Vitest', 'PyTest', 'JUnit', 'NUnit'] },
      { name: 'coverageTarget', description: 'Target code coverage percentage', type: 'number', required: false, defaultValue: 90 },
      { name: 'testTypes', description: 'Types of tests needed', type: 'text', required: false, defaultValue: 'unit, integration' },
      { name: 'includePerformanceTests', description: 'Include performance tests', type: 'boolean', required: false }
    ],
    tags: ['testing', 'unit-tests', 'quality-assurance'],
    isFavorite: true,
    usageCount: 67,
    createdAt: new Date('2024-01-18')
  },

  // ============================
  // Docs Category
  // ============================
  {
    id: 'docs-api-documentation',
    name: 'API Documentation',
    description: 'Generate comprehensive API documentation',
    category: 'docs',
    template: `Generate comprehensive API documentation for this {{apiType}} API:

{{apiCode}}

Documentation should include:

## Overview
- Purpose and functionality
- Base URL: {{baseUrl}}
- Authentication: {{authMethod}}
- Version: {{apiVersion}}

## Endpoints
For each endpoint, provide:
- HTTP method and URL
- Description and purpose
- Request parameters (path, query, body)
- Request/response examples
- Error responses and codes
- Rate limiting information

## Data Models
- Request/response schemas
- Field descriptions and types
- Validation rules
- Example payloads

## Authentication
- How to authenticate
- Token format and usage
- Error handling for auth failures

## Error Handling
- Standard error format
- Common error codes and meanings
- Troubleshooting guide

{{#if includeSDK}}
## SDK Examples
Include code examples in: {{sdkLanguages}}
{{/if}}

{{#if includePostman}}
Also provide Postman collection format.
{{/if}}`,
    variables: [
      { name: 'apiType', description: 'Type of API (REST, GraphQL, gRPC)', type: 'select', required: true, options: ['REST', 'GraphQL', 'gRPC', 'WebSocket'] },
      { name: 'apiCode', description: 'API code or schema', type: 'text', required: true },
      { name: 'baseUrl', description: 'API base URL', type: 'text', required: false },
      { name: 'authMethod', description: 'Authentication method', type: 'text', required: false, defaultValue: 'Bearer Token' },
      { name: 'apiVersion', description: 'API version', type: 'text', required: false, defaultValue: 'v1' },
      { name: 'includeSDK', description: 'Include SDK examples', type: 'boolean', required: false },
      { name: 'sdkLanguages', description: 'SDK languages to include', type: 'text', required: false },
      { name: 'includePostman', description: 'Include Postman collection', type: 'boolean', required: false }
    ],
    tags: ['documentation', 'api', 'reference'],
    isFavorite: false,
    usageCount: 34,
    createdAt: new Date('2024-02-05')
  },

  // ============================
  // Refactor Category
  // ============================
  {
    id: 'refactor-extract-patterns',
    name: 'Extract Patterns',
    description: 'Refactor code by extracting common patterns',
    category: 'refactor',
    template: `Please refactor this {{language}} code by extracting reusable patterns:

{{codeToRefactor}}

Refactoring Goals:
- Pattern type to extract: {{patternType}}
- Target: {{refactorTarget}}
- Constraints: {{constraints}}

Please:
1. **Identify Patterns**: Find repeated code or logic
2. **Extract Components**: Create reusable functions/classes/modules
3. **Improve Structure**: Better organization and separation of concerns
4. **Maintain Behavior**: Ensure functionality remains identical
5. **Add Abstractions**: Introduce appropriate design patterns
6. **Update Dependencies**: Modify calling code appropriately

Refactoring Principles:
- Single Responsibility Principle
- DRY (Don't Repeat Yourself)
- Open/Closed Principle
- Dependency Inversion

{{#if maintainBackwardCompatibility}}
Maintain backward compatibility for existing API.
{{/if}}

{{#if includeTests}}
Update or create tests for refactored code.
{{/if}}`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'text', required: true },
      { name: 'codeToRefactor', description: 'Code to refactor', type: 'text', required: true },
      { name: 'patternType', description: 'Type of pattern to extract', type: 'select', required: true, options: ['Factory', 'Strategy', 'Observer', 'Utility Functions', 'Data Access', 'Validation'] },
      { name: 'refactorTarget', description: 'What to focus on', type: 'text', required: true },
      { name: 'constraints', description: 'Any constraints or limitations', type: 'text', required: false },
      { name: 'maintainBackwardCompatibility', description: 'Maintain backward compatibility', type: 'boolean', required: false, defaultValue: true },
      { name: 'includeTests', description: 'Update/create tests', type: 'boolean', required: false, defaultValue: true }
    ],
    tags: ['refactoring', 'patterns', 'clean-code'],
    isFavorite: false,
    usageCount: 29,
    createdAt: new Date('2024-01-30')
  },

  // ============================
  // Explain Category
  // ============================
  {
    id: 'explain-code-analysis',
    name: 'Explain Code',
    description: 'Provide detailed explanation of complex code',
    category: 'explain',
    template: `Please provide a comprehensive explanation of this {{language}} code:

{{codeToExplain}}

Please explain:

## Overview
- What this code does (high-level purpose)
- Main functionality and features
- Input/output behavior

## Detailed Analysis
- Step-by-step execution flow
- Key algorithms or logic used
- Data structures and their purposes
- Design patterns implemented

## Components Breakdown
- Functions/methods and their roles
- Classes/objects and relationships
- Important variables and their lifecycle
- External dependencies and integrations

## Technical Concepts
- Complex logic or calculations
- Performance implications
- Memory usage patterns
- Potential bottlenecks

{{#if includeExamples}}
## Usage Examples
Provide practical examples of how to use this code.
{{/if}}

{{#if explainLevel}}
Explanation level: {{explainLevel}}
{{/if}}

Use {{audience}} friendly language and examples.`,
    variables: [
      { name: 'language', description: 'Programming language', type: 'text', required: true },
      { name: 'codeToExplain', description: 'Code to explain', type: 'text', required: true },
      { name: 'audience', description: 'Target audience', type: 'select', required: false, options: ['beginner', 'intermediate', 'expert'], defaultValue: 'intermediate' },
      { name: 'explainLevel', description: 'Level of detail', type: 'select', required: false, options: ['basic', 'detailed', 'comprehensive'], defaultValue: 'detailed' },
      { name: 'includeExamples', description: 'Include usage examples', type: 'boolean', required: false, defaultValue: true }
    ],
    tags: ['explanation', 'learning', 'code-analysis'],
    isFavorite: true,
    usageCount: 89,
    createdAt: new Date('2024-01-12')
  }
]

/**
 * Helper function to get prompts by category
 */
export const getPromptsByCategory = (category: PromptCategory): PromptTemplate[] => {
  return mockPromptsData.filter(prompt => prompt.category === category)
}

/**
 * Helper function to get favorite prompts
 */
export const getFavoritePrompts = (): PromptTemplate[] => {
  return mockPromptsData.filter(prompt => prompt.isFavorite)
}

/**
 * Helper function to get most used prompts
 */
export const getMostUsedPrompts = (limit: number = 5): PromptTemplate[] => {
  return [...mockPromptsData]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit)
}

/**
 * Helper function to search prompts
 */
export const searchPrompts = (query: string): PromptTemplate[] => {
  const searchLower = query.toLowerCase()
  return mockPromptsData.filter(prompt =>
    prompt.name.toLowerCase().includes(searchLower) ||
    prompt.description.toLowerCase().includes(searchLower) ||
    prompt.template.toLowerCase().includes(searchLower) ||
    prompt.tags.some(tag => tag.toLowerCase().includes(searchLower))
  )
}

/**
 * Helper function to get prompt statistics
 */
export const getPromptStats = () => {
  const total = mockPromptsData.length
  const favorites = mockPromptsData.filter(p => p.isFavorite).length
  const byCategory = mockPromptsData.reduce((acc, prompt) => {
    acc[prompt.category] = (acc[prompt.category] || 0) + 1
    return acc
  }, {} as Record<PromptCategory, number>)

  return { total, favorites, byCategory }
}

/**
 * Helper function to simulate prompt usage
 */
export const simulatePromptUsage = (promptId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const prompt = mockPromptsData.find(p => p.id === promptId)
      if (prompt) {
        prompt.usageCount += 1
        console.log(`Prompt ${promptId} used. New count: ${prompt.usageCount}`)
      }
      resolve(true)
    }, 200) // Simulate 200ms usage tracking
  })
}