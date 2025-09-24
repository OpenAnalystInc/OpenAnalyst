/**
 * Unit tests for ToolInterceptor
 *
 * Tests the Plan Mode tool interception functionality including:
 * - Redirection of attempt_completion to exit_plan_mode
 * - Blocking of modification tools in Plan Mode
 * - Proper telemetry tracking
 * - Error handling and logging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ToolInterceptor } from '../ToolInterceptor'
import { TelemetryService } from '@roo-code/telemetry'

// Mock telemetry service
vi.mock('@roo-code/telemetry', () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn()
		}
	}
}))

describe('ToolInterceptor', () => {
	let interceptor: ToolInterceptor
	let mockTelemetryService: any

	beforeEach(() => {
		interceptor = new ToolInterceptor()
		mockTelemetryService = TelemetryService.instance
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('in Plan Mode', () => {
		it('should intercept attempt_completion and redirect to exit_plan_mode', () => {
			const params = { result: 'Test plan content' }

			const result = interceptor.interceptTool('attempt_completion', 'plan', params)

			expect(result.toolName).toBe('exit_plan_mode')
			expect(result.wasIntercepted).toBe(true)
			expect(result.originalTool).toBe('attempt_completion')
			expect(result.params.plan).toBe('Test plan content')
			expect(result.reason).toBe('attempt_completion not allowed in Plan Mode')
		})

		it('should extract plan content from different parameter fields', () => {
			const testCases = [
				{ result: 'content from result' },
				{ message: 'content from message' },
				{ content: 'content from content' },
				{ text: 'content from text' },
				{ plan: 'content from plan' }
			]

			testCases.forEach(params => {
				const result = interceptor.interceptTool('attempt_completion', 'plan', params)
				const expectedContent = Object.values(params)[0]
				expect(result.params.plan).toBe(expectedContent)
			})
		})

		it('should handle complex objects in attempt_completion params', () => {
			const params = {
				complexObject: { nested: 'value' },
				array: [1, 2, 3]
			}

			const result = interceptor.interceptTool('attempt_completion', 'plan', params)

			expect(result.params.plan).toContain('complexObject')
			expect(result.params.plan).toContain('nested')
		})

		it('should block write_to_file in Plan Mode', () => {
			const params = { path: '/test/file.txt', content: 'test' }

			expect(() => {
				interceptor.interceptTool('write_to_file', 'plan', params)
			}).toThrow('Tool write_to_file is not allowed in Plan Mode')
		})

		it('should block execute_command in Plan Mode', () => {
			const params = { command: 'npm install' }

			expect(() => {
				interceptor.interceptTool('execute_command', 'plan', params)
			}).toThrow('Tool execute_command is not allowed in Plan Mode')
		})

		it('should block apply_diff in Plan Mode', () => {
			const params = { path: '/test/file.txt', diff: 'some diff' }

			expect(() => {
				interceptor.interceptTool('apply_diff', 'plan', params)
			}).toThrow('Tool apply_diff is not allowed in Plan Mode')
		})

		it('should allow read-only tools in Plan Mode', () => {
			const readOnlyTools = [
				'read_file',
				'search_files',
				'list_files',
				'list_code_definition_names',
				'ask_followup_question',
				'exit_plan_mode'
			]

			readOnlyTools.forEach(toolName => {
				const params = { test: 'param' }
				const result = interceptor.interceptTool(toolName, 'plan', params)

				expect(result.toolName).toBe(toolName)
				expect(result.wasIntercepted).toBe(false)
			})
		})

		it('should track telemetry for intercepted tools', () => {
			const params = { result: 'test content' }

			interceptor.interceptTool('attempt_completion', 'plan', params)

			expect(mockTelemetryService.captureEvent).toHaveBeenCalledWith(
				'PLAN_MODE_TOOL_INTERCEPTED',
				expect.objectContaining({
					originalTool: 'attempt_completion',
					correctedTool: 'exit_plan_mode',
					workflowMode: 'plan',
					timestamp: expect.any(String)
				})
			)
		})

		it('should track telemetry for blocked tools', () => {
			const params = { test: 'param' }

			try {
				interceptor.interceptTool('write_to_file', 'plan', params)
			} catch (error) {
				// Expected to throw
			}

			expect(mockTelemetryService.captureEvent).toHaveBeenCalledWith(
				'PLAN_MODE_TOOL_BLOCKED',
				expect.objectContaining({
					blockedTool: 'write_to_file',
					workflowMode: 'plan',
					timestamp: expect.any(String)
				})
			)
		})
	})

	describe('not in Plan Mode', () => {
		it('should not intercept attempt_completion in chat mode', () => {
			const params = { result: 'test content' }

			const result = interceptor.interceptTool('attempt_completion', 'chat', params)

			expect(result.toolName).toBe('attempt_completion')
			expect(result.wasIntercepted).toBe(false)
			expect(result.params).toBe(params)
		})

		it('should not intercept attempt_completion in agent mode', () => {
			const params = { result: 'test content' }

			const result = interceptor.interceptTool('attempt_completion', 'agent', params)

			expect(result.toolName).toBe('attempt_completion')
			expect(result.wasIntercepted).toBe(false)
		})

		it('should not intercept when workflowMode is undefined', () => {
			const params = { result: 'test content' }

			const result = interceptor.interceptTool('attempt_completion', undefined, params)

			expect(result.toolName).toBe('attempt_completion')
			expect(result.wasIntercepted).toBe(false)
		})

		it('should allow modification tools in non-plan modes', () => {
			const modificationTools = [
				'write_to_file',
				'execute_command',
				'apply_diff',
				'edit_file',
				'insert_content'
			]

			modificationTools.forEach(toolName => {
				const params = { test: 'param' }
				const result = interceptor.interceptTool(toolName, 'chat', params)

				expect(result.toolName).toBe(toolName)
				expect(result.wasIntercepted).toBe(false)
			})
		})
	})

	describe('isToolAllowedInPlanMode', () => {
		it('should return true for read-only tools', () => {
			const allowedTools = [
				'read_file',
				'search_files',
				'list_files',
				'list_code_definition_names',
				'ask_followup_question',
				'exit_plan_mode',
				'switch_mode',
				'new_task'
			]

			allowedTools.forEach(tool => {
				expect(interceptor.isToolAllowedInPlanMode(tool)).toBe(true)
			})
		})

		it('should return false for modification tools', () => {
			const blockedTools = [
				'write_to_file',
				'execute_command',
				'apply_diff',
				'edit_file',
				'insert_content',
				'search_and_replace'
			]

			blockedTools.forEach(tool => {
				expect(interceptor.isToolAllowedInPlanMode(tool)).toBe(false)
			})
		})
	})

	describe('getInterceptionMessage', () => {
		it('should return redirect message for attempt_completion', () => {
			const result = {
				toolName: 'exit_plan_mode',
				params: { plan: 'test' },
				wasIntercepted: true,
				originalTool: 'attempt_completion',
				reason: 'test reason'
			}

			const message = interceptor.getInterceptionMessage(result)

			expect(message).toBe('[System: Redirected attempt_completion to exit_plan_mode for Plan Mode compliance]')
		})

		it('should return empty string for non-intercepted tools', () => {
			const result = {
				toolName: 'read_file',
				params: { path: 'test.txt' },
				wasIntercepted: false
			}

			const message = interceptor.getInterceptionMessage(result)

			expect(message).toBe('')
		})

		it('should return block message for other intercepted tools', () => {
			const result = {
				toolName: 'BLOCKED',
				params: {},
				wasIntercepted: true,
				originalTool: 'write_to_file',
				reason: 'blocked'
			}

			const message = interceptor.getInterceptionMessage(result)

			expect(message).toBe('[System: Blocked write_to_file - not allowed in Plan Mode]')
		})
	})

	describe('edge cases', () => {
		it('should handle null parameters', () => {
			const result = interceptor.interceptTool('attempt_completion', 'plan', null)

			expect(result.wasIntercepted).toBe(true)
			expect(result.params.plan).toContain('content extraction failed')
		})

		it('should handle undefined parameters', () => {
			const result = interceptor.interceptTool('attempt_completion', 'plan', undefined)

			expect(result.wasIntercepted).toBe(true)
			expect(result.params.plan).toContain('content extraction failed')
		})

		it('should handle empty object parameters', () => {
			const result = interceptor.interceptTool('attempt_completion', 'plan', {})

			expect(result.wasIntercepted).toBe(true)
			expect(result.params.plan).toBe('{}')
		})
	})
})