import React from "react"
import { ButtonLink } from "./ButtonLink"
import { ButtonSecondary } from "./ButtonSecondary"
import Logo from "./Logo"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getOaCodeBackendSignUpUrl } from "../helpers"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface OaCodeAuthProps {
	onManualConfigClick?: () => void
	className?: string
}

const OaCodeAuth: React.FC<OaCodeAuthProps> = ({ onManualConfigClick, className = "" }) => {
	const { uriScheme, uiKind } = useExtensionState()

	const { t } = useAppTranslation()

	return (
		<div className={`flex flex-col items-center ${className}`}>
			<Logo />

			<h2 className="m-0 p-0 mb-4">{t("oacode:welcome.greeting")}</h2>
			<p className="text-center mb-2">{t("oacode:welcome.introText1")}</p>
			<p className="text-center mb-2">{t("oacode:welcome.introText2")}</p>
			<p className="text-center mb-5">{t("oacode:welcome.introText3")}</p>

			<div className="w-full flex flex-col gap-5">
				<ButtonLink
					href={getOaCodeBackendSignUpUrl(uriScheme, uiKind)}
					onClick={() => {
						if (uiKind === "Web" && onManualConfigClick) {
							onManualConfigClick()
						}
					}}>
					{t("oacode:welcome.ctaButton")}
				</ButtonLink>

				{!!onManualConfigClick && (
					<ButtonSecondary onClick={() => onManualConfigClick && onManualConfigClick()}>
						{t("oacode:welcome.manualModeButton")}
					</ButtonSecondary>
				)}
			</div>
		</div>
	)
}

export default OaCodeAuth
