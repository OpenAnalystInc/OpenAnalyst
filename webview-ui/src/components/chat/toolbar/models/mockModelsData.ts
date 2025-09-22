/**
 * Mock data for Models component - Continue-style model configuration
 * 
 * This file contains mock data matching Continue's Models dropdown structure
 * with Chat, Autocomplete, Edit, and Apply model categories.
 * 
 * Each category shows available models and setup status, allowing users
 * to configure different AI models for different use cases.
 */

import { ModelsData, ModelConfig, ModelCategory } from '../types'

/**
 * Mock model configurations for different categories
 */
const mockModelConfigs: Record<ModelCategory, ModelConfig[]> = {
  chat: [
    {
      id: 'gpt-4',
      category: 'chat',
      name: 'GPT-4',
      provider: 'OpenAI',
      model: 'gpt-4',
      isSetup: true,
      isDefault: true,
      capabilities: ['text', 'reasoning', 'code'],
      apiKeyRequired: true,
      hasApiKey: true
    },
    {
      id: 'claude-3-sonnet',
      category: 'chat',
      name: 'Claude 3 Sonnet',
      provider: 'Anthropic',
      model: 'claude-3-sonnet-20240229',
      isSetup: true,
      isDefault: false,
      capabilities: ['text', 'reasoning', 'code', 'vision'],
      apiKeyRequired: true,
      hasApiKey: true
    },
    {
      id: 'gemini-pro',
      category: 'chat',
      name: 'Gemini Pro',
      provider: 'Google',
      model: 'gemini-pro',
      isSetup: false,
      isDefault: false,
      capabilities: ['text', 'reasoning', 'code'],
      apiKeyRequired: true,
      hasApiKey: false
    }
  ],

  autocomplete: [
    {
      id: 'copilot',
      category: 'autocomplete',
      name: 'GitHub Copilot',
      provider: 'GitHub',
      model: 'copilot-codex',
      isSetup: true,
      isDefault: true,
      capabilities: ['code-completion', 'suggestions'],
      apiKeyRequired: false,
      hasApiKey: true
    },
    {
      id: 'codestral',
      category: 'autocomplete',
      name: 'Codestral',
      provider: 'Mistral',
      model: 'codestral-latest',
      isSetup: false,
      isDefault: false,
      capabilities: ['code-completion', 'suggestions'],
      apiKeyRequired: true,
      hasApiKey: false
    },
    {
      id: 'deepseek-coder',
      category: 'autocomplete',
      name: 'DeepSeek Coder',
      provider: 'DeepSeek',
      model: 'deepseek-coder-6.7b',
      isSetup: false,
      isDefault: false,
      capabilities: ['code-completion', 'suggestions'],
      apiKeyRequired: true,
      hasApiKey: false
    }
  ],

  edit: [
    {
      id: 'gpt-4-edit',
      category: 'edit',
      name: 'GPT-4 (Edit)',
      provider: 'OpenAI',
      model: 'gpt-4',
      isSetup: true,
      isDefault: true,
      capabilities: ['code-editing', 'refactoring'],
      apiKeyRequired: true,
      hasApiKey: true
    },
    {
      id: 'claude-3-haiku-edit',
      category: 'edit',
      name: 'Claude 3 Haiku (Fast)',
      provider: 'Anthropic',
      model: 'claude-3-haiku-20240307',
      isSetup: false,
      isDefault: false,
      capabilities: ['code-editing', 'refactoring'],
      apiKeyRequired: true,
      hasApiKey: true
    }
  ],

  apply: [
    {
      id: 'gpt-4-apply',
      category: 'apply',
      name: 'GPT-4 (Apply)',
      provider: 'OpenAI',
      model: 'gpt-4',
      isSetup: true,
      isDefault: true,
      capabilities: ['code-application', 'file-operations'],
      apiKeyRequired: true,
      hasApiKey: true
    },
    {
      id: 'claude-3-opus-apply',
      category: 'apply',
      name: 'Claude 3 Opus (Powerful)',
      provider: 'Anthropic',
      model: 'claude-3-opus-20240229',
      isSetup: false,
      isDefault: false,
      capabilities: ['code-application', 'file-operations'],
      apiKeyRequired: true,
      hasApiKey: true
    }
  ]
}

/**
 * Mock data structure matching Continue's Models dropdown
 */
export const mockModelsData: ModelsData = {
  categories: {
    chat: {
      name: 'Chat',
      description: 'Models for conversational AI and general assistance',
      models: mockModelConfigs.chat,
      setupRequired: mockModelConfigs.chat.some(m => !m.isSetup)
    },
    
    autocomplete: {
      name: 'Autocomplete',
      description: 'Models for code completion and suggestions',
      models: mockModelConfigs.autocomplete,
      setupRequired: mockModelConfigs.autocomplete.some(m => !m.isSetup)
    },
    
    edit: {
      name: 'Edit',
      description: 'Models optimized for code editing and refactoring',
      models: mockModelConfigs.edit,
      setupRequired: mockModelConfigs.edit.some(m => !m.isSetup)
    },
    
    apply: {
      name: 'Apply',
      description: 'Models for applying changes and file operations',
      models: mockModelConfigs.apply,
      setupRequired: mockModelConfigs.apply.some(m => !m.isSetup)
    }
  }
}

/**
 * Helper function to get the default model for a category
 */
export const getDefaultModelForCategory = (category: ModelCategory): ModelConfig | null => {
  const categoryData = mockModelsData.categories[category]
  return categoryData.models.find(m => m.isDefault) || categoryData.models[0] || null
}

/**
 * Helper function to get setup status for a category
 */
export const getCategorySetupStatus = (category: ModelCategory): 'complete' | 'partial' | 'none' => {
  const models = mockModelsData.categories[category].models
  const setupCount = models.filter(m => m.isSetup).length
  
  if (setupCount === 0) return 'none'
  if (setupCount === models.length) return 'complete'
  return 'partial'
}

/**
 * Helper function to get models that need API keys
 */
export const getModelsNeedingApiKeys = (): ModelConfig[] => {
  const allModels = Object.values(mockModelsData.categories)
    .flatMap(category => category.models)
  
  return allModels.filter(model => model.apiKeyRequired && !model.hasApiKey)
}

/**
 * Helper function to simulate model setup
 */
export const simulateModelSetup = (modelId: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Setting up model: ${modelId}`)
      resolve(true)
    }, 2000) // Simulate 2 second setup time
  })
}