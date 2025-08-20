import { useEffect, useState } from "react"
import { ProfileDataResponsePayload } from "@roo/WebviewMessage"
import { vscode } from "@/utils/vscode"

export function useOaIdentity(oacodeToken: string, machineId: string) {
	const [oaIdentity, setOaIdentity] = useState("")
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "profileDataResponse") {
				const payload = event.data.payload as ProfileDataResponsePayload | undefined
				const success = payload?.success || false
				const tokenFromMessage = payload?.data?.oacodeToken || ""
				const email = payload?.data?.user?.email || ""
				if (!success) {
					console.error("OATEL: Failed to identify Oa user, message doesn't indicate success:", payload)
				} else if (tokenFromMessage !== oacodeToken) {
					console.error("OATEL: Failed to identify Oa user, token mismatch:", payload)
				} else if (!email) {
					console.error("OATEL: Failed to identify Oa user, email missing:", payload)
				} else {
					console.debug("OATEL: Oa user identified:", email)
					setOaIdentity(email)
					window.removeEventListener("message", handleMessage)
				}
			}
		}

		if (oacodeToken) {
			console.debug("OATEL: fetching profile...")
			window.addEventListener("message", handleMessage)
			vscode.postMessage({
				type: "fetchProfileDataRequest",
			})
		} else {
			console.debug("OATEL: no Oa user")
			setOaIdentity("")
		}

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [oacodeToken])
	return oaIdentity || machineId
}
