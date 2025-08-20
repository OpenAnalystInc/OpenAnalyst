import { Package } from "../../shared/package"

export const DEFAULT_HEADERS = {
	"HTTP-Referer": "https://oacode.ai",
	"X-Title": "OpenAnalyst",
	"X-OaCode-Version": Package.version,
	"User-Agent": `Oa-Code/${Package.version}`,
}
