/**
 * Workflow mode types and interfaces
 */

export enum WorkflowMode {
  PLAN = 'plan',
  CHAT = 'chat',
  AGENT = 'agent'
}

export interface WorkflowOption {
  id: WorkflowMode
  label: string
  description: string
  icon: string // codicon class name
}

export interface WorkflowButtonProps {
  currentMode: WorkflowMode
  onModeChange: (mode: WorkflowMode) => void
  disabled?: boolean
  className?: string
}

export interface WorkflowPopoverProps {
  currentMode: WorkflowMode
  onModeChange: (mode: WorkflowMode) => void
  onClose: () => void
}

// Workflow mode configurations
export const WORKFLOW_MODES: Record<WorkflowMode, WorkflowOption> = {
  [WorkflowMode.PLAN]: {
    id: WorkflowMode.PLAN,
    label: 'Plan',
    description: 'Plan and structure tasks before execution',
    icon: 'codicon-checklist'
  },
  [WorkflowMode.CHAT]: {
    id: WorkflowMode.CHAT,
    label: 'Chat',
    description: 'Conversational interactions and discussions',
    icon: 'codicon-comment-discussion'
  },
  [WorkflowMode.AGENT]: {
    id: WorkflowMode.AGENT,
    label: 'Agent',
    description: 'Autonomous task execution and problem solving',
    icon: 'codicon-robot'
  }
}

export const DEFAULT_WORKFLOW_MODE = WorkflowMode.CHAT