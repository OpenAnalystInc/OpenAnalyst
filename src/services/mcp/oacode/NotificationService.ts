import { z } from "zod"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js"
import * as vscode from "vscode"

export type LogLevel = z.infer<typeof LoggingMessageNotificationSchema>["params"]["level"]

export class NotificationService {
	connect(name: string, client: Client): void {
		client.setNotificationHandler(LoggingMessageNotificationSchema, async (notification) => {
			const params = notification.params || {}
			const level = params.level || "info"
			const data = params.data || params.message || ""
			const logger = params.logger || ""
			const dataPrefix = logger ? `[${logger}]` : ``
			const message = `MCP ${name}: ${dataPrefix}${data}`

			switch (level) {
				case "critical":
				case "emergency":
				case "error":
					vscode.window.showErrorMessage(message)
					break
				case "alert":
				case "warning":
					vscode.window.showWarningMessage(message)
					break
				default:
					vscode.window.showInformationMessage(message)
			}
		})

		client.fallbackNotificationHandler = async (notification) => {
			vscode.window.showInformationMessage(`MCP ${name}: ${JSON.stringify(notification)}`)
		}
	}
}
