import { fileExistsAtPath, isDirectory } from "../../../utils/fs"
import * as path from "path"
import fs from "fs/promises"

/**
 * Converts .oacode/rules file to directory and places old .oacode/rules file inside directory, renaming it
 * Doesn't do anything if .oacode/rules dir already exists or doesn't exist
 * Returns whether there are any uncaught errors
 */
export async function ensureLocaloarulesDirExists(
	oarulePath: string,
	defaultRuleFilename: string,
): Promise<boolean> {
	try {
		const exists = await fileExistsAtPath(oarulePath)

		if (exists && !(await isDirectory(oarulePath))) {
			// logic to convert file into directory, and rename the rules file to {defaultRuleFilename}
			const content = await fs.readFile(oarulePath, "utf8")
			const tempPath = oarulePath + ".bak"
			await fs.rename(oarulePath, tempPath) // create backup
			try {
				await fs.mkdir(oarulePath, { recursive: true })
				await fs.writeFile(path.join(oarulePath, defaultRuleFilename), content, "utf8")
				await fs.unlink(tempPath).catch(() => {}) // delete backup

				return false // conversion successful with no errors
			} catch (conversionError) {
				// attempt to restore backup on conversion failure
				try {
					await fs.rm(oarulePath, { recursive: true, force: true }).catch(() => {})
					await fs.rename(tempPath, oarulePath) // restore backup
				} catch (restoreError) {}
				return true // in either case here we consider this an error
			}
		}
		// exists and is a dir or doesn't exist, either of these cases we dont need to handle here
		return false
	} catch (error) {
		return true
	}
}
