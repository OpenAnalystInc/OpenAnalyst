/**
 * Module: HTTP Interceptor (Debug Infrastructure)
 * Purpose: Intercept and capture raw HTTP requests/responses to LLM providers for debugging
 * Responsibilities:
 * - Monkey-patch global fetch and Node's https module
 * - Capture complete HTTP request/response cycle
 * - Store raw data for debug analysis
 * Invariants:
 * - Only active when __DEV__ = true
 * - Must not interfere with normal HTTP operations
 * - Thread-safe for concurrent requests
 * Security: No credential logging; sanitize sensitive headers
 * Performance: Minimal overhead when disabled; lazy JSON parsing when enabled
 */

import * as https from "https"
import * as http from "http"
import { URL } from "url"

// Compile-time flag provided by bundler (see esbuild define)
declare const __DEV__: boolean

interface CapturedHttpRequest {
	id: string
	timestamp: string
	url: string
	method: string
	headers: Record<string, string>
	body: string
}

interface CapturedHttpResponse {
	id: string
	timestamp: string
	status: number
	statusText: string
	headers: Record<string, string>
	body: string
}

// Storage for captured requests/responses
const capturedRequests = new Map<string, CapturedHttpRequest>()
const capturedResponses = new Map<string, CapturedHttpResponse>()

/**
 * Generate unique ID for request/response pairing
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
	const sanitized = { ...headers }

	// Remove or mask sensitive headers
	if (sanitized['authorization']) {
		sanitized['authorization'] = sanitized['authorization'].replace(/(Bearer\s+)(sk-\w+)/, '$1***masked***')
	}
	if (sanitized['x-api-key']) {
		sanitized['x-api-key'] = '***masked***'
	}

	return sanitized
}

/**
 * Check if URL is an LLM provider endpoint
 */
function isLlmProvider(url: string): boolean {
	const llmDomains = [
		'api.anthropic.com',
		'api.openai.com',
		'api.groq.com',
		'openrouter.ai',
		'api.mistral.ai',
		'generativelanguage.googleapis.com',
		// Add more as needed
	]

	try {
		const urlObj = new URL(url)
		return llmDomains.some(domain => urlObj.hostname.includes(domain))
	} catch {
		return false
	}
}

/**
 * Capture HTTP request data
 */
function captureHttpRequest(url: string, options: any): string | null {
	if (!__DEV__ || !isLlmProvider(url)) {
		return null
	}

	const requestId = generateRequestId()
	const timestamp = new Date().toISOString()

	// Extract headers
	const headers: Record<string, string> = {}
	if (options?.headers) {
		for (const [key, value] of Object.entries(options.headers)) {
			headers[key.toLowerCase()] = String(value)
		}
	}

	// Extract body
	let body = ""
	if (options?.body) {
		if (typeof options.body === 'string') {
			body = options.body
		} else if (options.body instanceof Buffer) {
			body = options.body.toString('utf8')
		} else {
			body = JSON.stringify(options.body)
		}
	}

	const capturedRequest: CapturedHttpRequest = {
		id: requestId,
		timestamp,
		url,
		method: options?.method || 'GET',
		headers: sanitizeHeaders(headers),
		body
	}

	capturedRequests.set(requestId, capturedRequest)
	console.log(`[DEBUG] HTTP Request captured: ${requestId} ${capturedRequest.method} ${url}`)

	return requestId
}

/**
 * Capture HTTP response data
 */
async function captureHttpResponse(response: Response, requestId: string): Promise<void> {
	if (!__DEV__ || !requestId) {
		return
	}

	const timestamp = new Date().toISOString()

	// Extract headers
	const headers: Record<string, string> = {}
	response.headers.forEach((value, key) => {
		headers[key.toLowerCase()] = value
	})

	// Clone response to read body without consuming original
	const clonedResponse = response.clone()
	let body = ""
	try {
		body = await clonedResponse.text()
	} catch (error) {
		body = `[Error reading response body: ${error}]`
	}

	const capturedResponse: CapturedHttpResponse = {
		id: requestId,
		timestamp,
		status: response.status,
		statusText: response.statusText,
		headers: sanitizeHeaders(headers),
		body
	}

	capturedResponses.set(requestId, capturedResponse)
	console.log(`[DEBUG] HTTP Response captured: ${requestId} ${response.status} ${response.statusText}`)
}

/**
 * Get captured request/response pair
 */
export function getCapturedHttpData(requestId: string): {
	request?: CapturedHttpRequest
	response?: CapturedHttpResponse
} {
	return {
		request: capturedRequests.get(requestId),
		response: capturedResponses.get(requestId)
	}
}

/**
 * Clear old captured data to prevent memory leaks
 */
function cleanupOldCaptures(): void {
	const now = Date.now()
	const maxAge = 5 * 60 * 1000 // 5 minutes

	Array.from(capturedRequests.entries()).forEach(([id, request]) => {
		if (now - new Date(request.timestamp).getTime() > maxAge) {
			capturedRequests.delete(id)
			capturedResponses.delete(id)
		}
	})
}

/**
 * Install HTTP interceptor for fetch API
 */
function installFetchInterceptor(): void {
	if (typeof globalThis.fetch === 'undefined') {
		return // Not in a fetch-enabled environment
	}

	const originalFetch = globalThis.fetch

	globalThis.fetch = async function interceptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		let requestId: string | null = null

		try {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
			requestId = captureHttpRequest(url, init)
		} catch (error) {
			console.warn('[DEBUG] Failed to capture fetch request:', error)
		}

		// Make original request
		const response = await originalFetch(input, init)

		// Capture response
		if (requestId) {
			try {
				await captureHttpResponse(response, requestId)
			} catch (error) {
				console.warn('[DEBUG] Failed to capture fetch response:', error)
			}
		}

		return response
	}
}

/**
 * Install HTTP interceptor for Node.js https module
 */
function installHttpsInterceptor(): void {
	const originalRequest = https.request
	const originalHttpRequest = http.request

	// Intercept https.request
	const httpsModule = https as any
	httpsModule.request = function interceptedHttpsRequest(...args: any[]): http.ClientRequest {
		const req = (originalRequest as any).apply(this, args)

		// Only intercept if DEV and LLM provider
		if (__DEV__) {
			const originalWrite = req.write.bind(req)
			const originalEnd = req.end.bind(req)
			let body = ""
			let requestId: string | null = null

			// Intercept write calls to capture body
			req.write = function(chunk: any, encoding?: any, callback?: any) {
				if (typeof chunk === 'string') {
					body += chunk
				} else if (Buffer.isBuffer(chunk)) {
					body += chunk.toString('utf8')
				}
				return originalWrite(chunk, encoding, callback)
			}

			// Intercept end to capture complete request
			req.end = function(chunk?: any, encoding?: any, callback?: any) {
				if (chunk) {
					if (typeof chunk === 'string') {
						body += chunk
					} else if (Buffer.isBuffer(chunk)) {
						body += chunk.toString('utf8')
					}
				}

				// Capture request data
				try {
					const options = (req as any)._headers || {}
					const url = `https://${req.getHeader('host')}${(req as any).path || '/'}`

					requestId = captureHttpRequest(url, {
						method: (req as any).method,
						headers: options,
						body: body
					})
				} catch (error) {
					console.warn('[DEBUG] Failed to capture https request:', error)
				}

				return originalEnd.call(this, chunk, encoding, callback)
			}

			// Intercept response
			req.on('response', (res: http.IncomingMessage) => {
				if (requestId) {
					let responseBody = ""

					res.on('data', (chunk: Buffer) => {
						responseBody += chunk.toString('utf8')
					})

					res.on('end', () => {
						try {
							const headers: Record<string, string> = {}
							for (const [key, value] of Object.entries(res.headers)) {
								headers[key] = Array.isArray(value) ? value.join(', ') : String(value)
							}

							// Create a Response-like object for consistency
							const fakeResponse = {
								status: res.statusCode || 0,
								statusText: res.statusMessage || '',
								headers: new Map(Object.entries(headers)),
								clone: () => ({ text: async () => responseBody })
							} as any

							captureHttpResponse(fakeResponse, requestId!)
						} catch (error) {
							console.warn('[DEBUG] Failed to capture https response:', error)
						}
					})
				}
			})
		}

		return req
	}
}

/**
 * Install all HTTP interceptors
 */
export function installHttpInterceptors(): void {
	if (!__DEV__) {
		return
	}

	console.log('[DEBUG] Installing HTTP interceptors for LLM API capture')

	try {
		installFetchInterceptor()
		installHttpsInterceptor()

		// Set up periodic cleanup
		setInterval(cleanupOldCaptures, 60000) // Clean up every minute

		console.log('[DEBUG] HTTP interceptors installed successfully')
	} catch (error) {
		console.error('[DEBUG] Failed to install HTTP interceptors:', error)
	}
}

/**
 * Get captured data by timeframe (useful for linking provider requests)
 */
export function getCapturedDataByTimeframe(startTime: string, endTime: string): {
	requests: CapturedHttpRequest[]
	responses: CapturedHttpResponse[]
} {
	const start = new Date(startTime).getTime()
	const end = new Date(endTime).getTime()

	const filteredRequests = Array.from(capturedRequests.values()).filter(req => {
		const reqTime = new Date(req.timestamp).getTime()
		return reqTime >= start && reqTime <= end
	})

	const filteredResponses = Array.from(capturedResponses.values()).filter(res => {
		const resTime = new Date(res.timestamp).getTime()
		return resTime >= start && resTime <= end
	})

	return {
		requests: filteredRequests,
		responses: filteredResponses
	}
}

/**
 * Get all captured data for debugging
 */
export function getAllCapturedData(): {
	requests: CapturedHttpRequest[]
	responses: CapturedHttpResponse[]
} {
	return {
		requests: Array.from(capturedRequests.values()),
		responses: Array.from(capturedResponses.values())
	}
}