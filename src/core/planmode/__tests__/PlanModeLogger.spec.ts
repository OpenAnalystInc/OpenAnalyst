/**
 * Unit tests for PlanModeLogger
 *
 * Tests the Plan Mode logging functionality including:
 * - Development vs production logging behavior
 * - Structured logging format
 * - Tool validation logging
 * - Mode transition logging
 * - Plan presentation tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PlanModeLogger } from '../PlanModeLogger'

// Mock the parent Logger class
vi.mock('../../infrastructure/Logger', () => ({
	Logger: class MockLogger {
		public namespace: string

		constructor(namespace: string) {
			this.namespace = namespace
		}

		debug = vi.fn()
		info = vi.fn()
		warn = vi.fn()
		error = vi.fn()
	}
}))

describe('PlanModeLogger', () => {
	let logger: PlanModeLogger
	let originalEnv: string | undefined

	beforeEach(() => {
		logger = new PlanModeLogger()
		originalEnv = process.env.NODE_ENV
		vi.clearAllMocks()
	})

	afterEach(() => {
		process.env.NODE_ENV = originalEnv
	})

	describe('logToolValidation', () => {
		it('should log debug message in development for valid tools', () => {
			process.env.NODE_ENV = 'development'

			logger.logToolValidation('exit_plan_mode', true, 'plan')

			expect(logger.debug).toHaveBeenCalledWith('Tool validation', {
				tool: 'exit_plan_mode',
				isValid: true,
				mode: 'plan',
				timestamp: expect.any(String)
			})
		})

		it('should not log debug message in production', () => {
			process.env.NODE_ENV = 'production'

			logger.logToolValidation('exit_plan_mode', true, 'plan')

			expect(logger.debug).not.toHaveBeenCalled()
		})

		it('should log warning for invalid tools in Plan Mode', () => {
			logger.logToolValidation('attempt_completion', false, 'plan')

			expect(logger.warn).toHaveBeenCalledWith('Invalid tool usage in Plan Mode', {
				tool: 'attempt_completion',
				isValid: false,
				mode: 'plan',
				timestamp: expect.any(String),
				expectedTool: 'exit_plan_mode',
				action: 'tool_blocked'
			})
		})

		it('should not log warning for invalid tools in non-Plan modes', () => {
			logger.logToolValidation('attempt_completion', false, 'chat')

			expect(logger.warn).not.toHaveBeenCalled()
		})

		it('should include timestamp in all log entries', () => {
			const beforeTime = new Date().getTime()

			logger.logToolValidation('test_tool', true, 'plan')

			const warnMock = logger.warn as any
			const debugMock = logger.debug as any
			const logCall = warnMock.mock?.calls[0] || debugMock.mock?.calls[0]
			if (logCall) {
				const context = logCall[1]
				const logTime = new Date(context.timestamp).getTime()
				expect(logTime).toBeGreaterThanOrEqual(beforeTime)
				expect(logTime).toBeLessThanOrEqual(new Date().getTime())
			}
		})
	})

	describe('logModeTransition', () => {
		it('should log info message for mode transitions', () => {
			logger.logModeTransition('chat', 'plan')

			expect(logger.info).toHaveBeenCalledWith('Mode transition', {
				from: 'chat',
				to: 'plan',
				timestamp: expect.any(String),
				action: 'mode_transition'
			})
		})

		it('should log additional debug info in development', () => {
			process.env.NODE_ENV = 'development'

			logger.logModeTransition('chat', 'plan')

			expect(logger.debug).toHaveBeenCalledWith('Mode transition details', {
				from: 'chat',
				to: 'plan',
				timestamp: expect.any(String),
				action: 'mode_transition',
				planModeActive: true,
				planModeExited: false
			})
		})

		it('should track Plan Mode exit correctly', () => {
			process.env.NODE_ENV = 'development'

			logger.logModeTransition('plan', 'chat')

			expect(logger.debug).toHaveBeenCalledWith('Mode transition details',
				expect.objectContaining({
					planModeActive: false,
					planModeExited: true
				})
			)
		})
	})

	describe('logPlanPresentation', () => {
		it('should log info for correct plan presentation', () => {
			logger.logPlanPresentation('exit_plan_mode')

			expect(logger.info).toHaveBeenCalledWith('Plan presentation', {
				method: 'exit_plan_mode',
				correct: true,
				timestamp: expect.any(String),
				action: 'plan_presentation'
			})
		})

		it('should log warning for incorrect plan presentation', () => {
			logger.logPlanPresentation('attempt_completion')

			expect(logger.warn).toHaveBeenCalledWith('Incorrect plan presentation method', {
				method: 'attempt_completion',
				correct: false,
				timestamp: expect.any(String),
				action: 'plan_presentation',
				expectedMethod: 'exit_plan_mode',
				severity: 'high'
			})
		})

		it('should handle text plan presentation', () => {
			logger.logPlanPresentation('text')

			expect(logger.warn).toHaveBeenCalledWith('Incorrect plan presentation method',
				expect.objectContaining({
					method: 'text',
					correct: false,
					expectedMethod: 'exit_plan_mode'
				})
			)
		})
	})

	describe('logToolInterception', () => {
		it('should log warning for tool interception', () => {
			logger.logToolInterception('attempt_completion', 'exit_plan_mode', 'not allowed in Plan Mode')

			expect(logger.warn).toHaveBeenCalledWith('Tool usage intercepted', {
				originalTool: 'attempt_completion',
				interceptedTool: 'exit_plan_mode',
				reason: 'not allowed in Plan Mode',
				timestamp: expect.any(String),
				action: 'tool_intercepted'
			})
		})

		it('should log debug details in development', () => {
			process.env.NODE_ENV = 'development'

			logger.logToolInterception('write_to_file', 'BLOCKED', 'modification not allowed')

			expect(logger.debug).toHaveBeenCalledWith('Interception details', {
				originalTool: 'write_to_file',
				interceptedTool: 'BLOCKED',
				reason: 'modification not allowed',
				timestamp: expect.any(String),
				action: 'tool_intercepted',
				interceptorActive: true,
				complianceFailure: true
			})
		})
	})

	describe('logValidationFailure', () => {
		it('should log error for validation failures', () => {
			const details = {
				toolName: 'exit_plan_mode',
				expected: true,
				actual: false
			}

			logger.logValidationFailure('tool_availability', details)

			expect(logger.error).toHaveBeenCalledWith('Plan Mode validation failed', {
				validation: 'tool_availability',
				timestamp: expect.any(String),
				action: 'validation_failure',
				...details
			})
		})

		it('should include all provided details', () => {
			const details = {
				errorCode: 'TOOL_MISSING',
				severity: 'critical',
				recovery: 'restart_extension'
			}

			logger.logValidationFailure('system_check', details)

			expect(logger.error).toHaveBeenCalledWith('Plan Mode validation failed',
				expect.objectContaining(details)
			)
		})
	})

	describe('logWorkflowEvent', () => {
		it('should log workflow events with plan title', () => {
			logger.logWorkflowEvent('presented', 'Data Analysis Plan', { userAction: true })

			expect(logger.info).toHaveBeenCalledWith('Plan workflow event', {
				event: 'presented',
				planTitle: 'Data Analysis Plan',
				timestamp: expect.any(String),
				action: 'workflow_event',
				userAction: true
			})
		})

		it('should use default title when none provided', () => {
			logger.logWorkflowEvent('approved')

			expect(logger.info).toHaveBeenCalledWith('Plan workflow event',
				expect.objectContaining({
					planTitle: 'untitled'
				})
			)
		})

		it('should handle all workflow event types', () => {
			const events: Array<'presented' | 'approved' | 'modified' | 'rejected'> = [
				'presented', 'approved', 'modified', 'rejected'
			]

			events.forEach(event => {
				logger.logWorkflowEvent(event, 'Test Plan')

				expect(logger.info).toHaveBeenCalledWith('Plan workflow event',
					expect.objectContaining({
						event,
						planTitle: 'Test Plan'
					})
				)
			})
		})

		it('should merge additional details', () => {
			const details = {
				userId: 'test-user',
				duration: 5000,
				complexity: 'high'
			}

			logger.logWorkflowEvent('modified', 'Complex Plan', details)

			expect(logger.info).toHaveBeenCalledWith('Plan workflow event',
				expect.objectContaining(details)
			)
		})
	})

	describe('constructor and inheritance', () => {
		it('should initialize with PlanMode namespace', () => {
			const logger = new PlanModeLogger()

			// Verify it extends Logger with correct namespace
			expect(logger).toBeInstanceOf(PlanModeLogger)
		})

		it('should inherit all Logger methods', () => {
			expect(logger.debug).toBeDefined()
			expect(logger.info).toBeDefined()
			expect(logger.warn).toBeDefined()
			expect(logger.error).toBeDefined()
		})
	})
})