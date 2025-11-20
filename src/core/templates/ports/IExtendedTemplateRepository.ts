/**
 * Module: IExtendedTemplateRepository (port)
 * Purpose: Abstraction for loading and managing extended templates
 * Responsibilities:
 *  - Define contract for template loading
 *  - Specify template watching interface
 *  - Abstract file system operations
 * Invariants: Implementations must never expose file paths in errors
 * Dependencies: Domain types only
 * Security: Never expose file system paths; only template names
 */

import type { ExtendedTemplate } from "../domain/ExtendedTemplate"
import type { TemplateError } from "../domain/TemplateError"
import type { Result } from "../domain/Result"

/**
 * Disposable interface for cleanup
 */
export interface Disposable {
	dispose(): void
}

/**
 * Template repository port
 * @description Abstraction for template storage and retrieval
 * @remarks Implementations may use file system, database, or remote storage
 */
export interface IExtendedTemplateRepository {
	/**
	 * Load a template by name
	 * @param name Template name (without extension)
	 * @returns Parsed template or error
	 * @throws Never - errors returned in Result
	 */
	loadTemplate(name: string): Promise<Result<ExtendedTemplate, TemplateError>>

	/**
	 * Get the currently active template
	 * @returns Active template or null if none active
	 */
	getActiveTemplate(): ExtendedTemplate | null

	/**
	 * Set the active template
	 * @param template Template to activate or null to deactivate
	 */
	setActiveTemplate(template: ExtendedTemplate | null): Promise<void>

	/**
	 * List all available templates
	 * @returns Array of template names (without extensions)
	 */
	listTemplates(): Promise<string[]>

	/**
	 * Check if a template exists
	 * @param name Template name to check
	 */
	templateExists(name: string): Promise<boolean>

	/**
	 * Watch for template changes
	 * @param callback Function to call when templates change
	 * @returns Disposable to stop watching
	 */
	watchForChanges(callback: () => void): Disposable

	/**
	 * Reload all templates (clear cache)
	 */
	reloadTemplates(): Promise<void>
}
