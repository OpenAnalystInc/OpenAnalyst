export function getExitPlanModeDescription(): string {
	return `## exit_plan_mode
Description: Use this tool to present your plan for approval when you are in Plan Mode. CRITICAL: Creating a plan is NOT completing the task - it's a preparatory step. The actual task execution happens AFTER the plan is approved. Planning is just the first step of the workflow, not the final result.

IMPORTANT DISTINCTIONS:
- Planning = Preparatory step (what you're doing now)
- Task Execution = Actual work (happens after plan approval)
- Task Completion = When the executed work is finished (much later)

When to use this tool:
- You are in Plan Mode and have finished researching/gathering information
- You have created a comprehensive plan but have NOT executed anything yet
- You need user approval before proceeding with the actual implementation
- You have reached the end of the planning phase (not the task itself)

When NOT to use this tool:
- If you've already started executing tasks or making changes
- If you're not in Plan Mode
- If you're completing an already executed task (use attempt_completion instead)
- If you're just providing information without needing approval

The Plan Mode Workflow:
1. Research and gather information (read-only operations)
2. Create comprehensive strategic plan
3. Use exit_plan_mode to present plan ← YOU ARE HERE
4. Wait for user approval/rejection/modification
5. AFTER approval: Switch to execution mode and implement the plan
6. MUCH LATER: Use attempt_completion when the executed work is finished

Parameters:
- plan: (required) The complete strategic plan in markdown format. Should include phases, technical approach, deliverables, and implementation steps.

Usage:
<exit_plan_mode>
<plan>
# Plan: [Your Plan Title]

## Overview
[Brief description of what will be accomplished]

## Phase 1: [Phase Name]
[Detailed phase description with implementation steps]

## Phase 2: [Phase Name]
[Additional phases as needed]

## Expected Deliverables
[What will be created/modified]

## Technical Approach
[How the work will be done]
</plan>
</exit_plan_mode>

Example:
<exit_plan_mode>
<plan>
# Plan: Implement User Authentication System

## Overview
This plan outlines the implementation of a secure user authentication system with login, registration, and password reset functionality.

## Phase 1: Database Schema
- Create user table with secure password storage
- Add authentication-related indexes
- Set up migration scripts

## Phase 2: Backend Implementation
- Implement password hashing and verification
- Create authentication middleware
- Build login/register/reset endpoints

## Phase 3: Frontend Integration
- Create login and registration forms
- Implement authentication state management
- Add route protection

## Expected Deliverables
- Fully functional authentication system
- Secure password handling
- Protected user areas

## Technical Approach
Using bcrypt for password hashing, JWT for session management, and form validation for security.
</plan>
</exit_plan_mode>`
}