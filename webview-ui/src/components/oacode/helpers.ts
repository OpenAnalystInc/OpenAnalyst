export function getOaCodeBackendSignInUrl(uriScheme: string = "vscode", uiKind: string = "Desktop") {
	const baseUrl = "https://oacode.ai"
	const source = uiKind === "Web" ? "web" : uriScheme
	return `${baseUrl}/sign-in-to-editor?source=${source}`
}

export function getOaCodeBackendSignUpUrl(uriScheme: string = "vscode", uiKind: string = "Desktop") {
	const baseUrl = "https://oacode.ai"
	const source = uiKind === "Web" ? "web" : uriScheme
	return `${baseUrl}/users/sign_up?source=${source}`
}
