export function getKiloCodeBackendSignInUrl(uriScheme: string = "vscode", uiKind: string = "Desktop") {
	const baseUrl = "https://kilocode.ai"
	const source = uiKind === "Web" ? "web" : uriScheme
	return `${baseUrl}/sign-in-to-editor?source=${source}`
}

export function getKiloCodeBackendSignUpUrl(uriScheme: string = "vscode", uiKind: string = "Desktop") {
	const baseUrl = "https://kilocode.ai"
	const source = uiKind === "Web" ? "web" : uriScheme
	return `${baseUrl}/users/sign_up?source=${source}`
}
