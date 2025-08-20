import { useEffect, useState } from "react"
import { ProfileDataResponsePayload } from "@roo/WebviewMessage"
import { vscode } from "@/utils/vscode"

export function useoaIdentity(oacodeToken: string, machineId: string) {
	const [oaIdentity, setoaIdentity] = useState("")
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "profileDataResponse") {
				const payload = event.data.payload as ProfileDataResponsePayload | undefined
				const success = payload?.success || false
				const tokenFromMessage = payload?.data?.oacodeToken || ""
				const email = payload?.data?.user?.email || ""
				if (!success) {
					console.error("oaTEL: Failed to identify oa user, message doesn't indicate success:", payload)
				} else if (tokenFromMessage !== oacodeToken) {
					console.error("oaTEL: Failed to identify oa user, token mismatch:", payload)
				} else if (!email) {
					console.error("oaTEL: Failed to identify oa user, email missing:", payload)
				} else {
					console.debug("oaTEL: oa user identified:", email)
					setoaIdentity(email)
					window.removeEventListener("message", handleMessage)
				}
			}
		}

		if (oacodeToken) {
			console.debug("oaTEL: fetching profile...")
			window.addEventListener("message", handleMessage)
			vscode.postMessage({
				type: "fetchProfileDataRequest",
			})
		} else {
			console.debug("oaTEL: no oa user")
			setoaIdentity("")
		}

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [oacodeToken])
	return oaIdentity || machineId
}
