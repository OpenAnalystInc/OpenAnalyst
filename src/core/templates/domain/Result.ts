/**
 * Module: Result (domain/value-object)
 * Purpose: Functional error handling without exceptions
 * Responsibilities:
 *  - Encapsulate success/failure states
 *  - Provide type-safe error handling
 *  - Support monadic operations (map, flatMap)
 * Invariants: Result is either Ok or Err, never both
 * Dependencies: None (pure domain)
 * Performance: Zero-cost abstraction when minified
 */

/**
 * Success result
 */
export interface Ok<T> {
	readonly ok: true
	readonly value: T
}

/**
 * Error result
 */
export interface Err<E> {
	readonly ok: false
	readonly error: E
}

/**
 * Result type for functional error handling
 * @template T Success value type
 * @template E Error value type
 * @example
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return Result.err('Division by zero')
 *   return Result.ok(a / b)
 * }
 */
export type Result<T, E> = Ok<T> | Err<E>

/**
 * Result constructor and utility functions
 */
export const Result = {
	/**
	 * Create success result
	 */
	ok<T>(value: T): Ok<T> {
		return { ok: true, value }
	},

	/**
	 * Create error result
	 */
	err<E>(error: E): Err<E> {
		return { ok: false, error }
	},

	/**
	 * Check if result is success
	 */
	isOk<T, E>(result: Result<T, E>): result is Ok<T> {
		return result.ok === true
	},

	/**
	 * Check if result is error
	 */
	isErr<T, E>(result: Result<T, E>): result is Err<E> {
		return result.ok === false
	},

	/**
	 * Map success value
	 */
	map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
		if (result.ok) {
			return Result.ok(fn(result.value))
		}
		return result
	},

	/**
	 * Map error value
	 */
	mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
		if (!result.ok) {
			return Result.err(fn(result.error))
		}
		return result
	},

	/**
	 * FlatMap for chaining operations
	 */
	flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
		if (result.ok) {
			return fn(result.value)
		}
		return result
	},

	/**
	 * Unwrap value or throw
	 * @throws {Error} If result is error
	 */
	unwrap<T, E>(result: Result<T, E>): T {
		if (result.ok) {
			return result.value
		}
		throw new Error(`Result unwrap failed: ${result.error}`)
	},

	/**
	 * Unwrap value or return default
	 */
	unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
		if (result.ok) {
			return result.value
		}
		return defaultValue
	},

	/**
	 * Unwrap value or compute default
	 */
	unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
		if (result.ok) {
			return result.value
		}
		return fn(result.error)
	},

	/**
	 * Convert array of results to result of array
	 */
	all<T, E>(results: Result<T, E>[]): Result<T[], E> {
		const values: T[] = []
		for (const result of results) {
			if (!result.ok) {
				return result
			}
			values.push(result.value)
		}
		return Result.ok(values)
	},

	/**
	 * Try to execute function and wrap in Result
	 */
	fromTry<T>(fn: () => T): Result<T, Error> {
		try {
			return Result.ok(fn())
		} catch (error) {
			return Result.err(error instanceof Error ? error : new Error(String(error)))
		}
	},

	/**
	 * Try to execute async function and wrap in Result
	 */
	async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
		try {
			const value = await promise
			return Result.ok(value)
		} catch (error) {
			return Result.err(error instanceof Error ? error : new Error(String(error)))
		}
	},
}
