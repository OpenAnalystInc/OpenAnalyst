import { useCallback, useState } from "react"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { validateApiConfiguration } from "../../../utils/validate"
import { vscode } from "../../../utils/vscode"
import { Tab, TabContent } from "../../common/Tab"
import { useAppTranslation } from "../../../i18n/TranslationContext"
import { ButtonPrimary } from "../common/ButtonPrimary"
import { ButtonLink } from "../common/ButtonLink"
import ApiOptions from "../../settings/ApiOptions"
import OaCodeAuth from "../common/OaCodeAuth"
import { getOaCodeBackendSignInUrl } from "../helpers"

const WelcomeView = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme, uiKind } = useExtensionState()
	const [errorMessage, setErrorMessage] = useState<string | undefined>()
	const [manualConfig, setManualConfig] = useState(false)
	const { t } = useAppTranslation()

	const handleSubmit = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	const isSettingUpOaCode =
		!apiConfiguration?.apiProvider || (apiConfiguration?.apiProvider === "oacode" && !apiConfiguration?.oacodeToken)

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5">
				{manualConfig ? (
					<>
						<ApiOptions
							fromWelcomeView
							apiConfiguration={apiConfiguration || {}}
							uriScheme={uriScheme}
							uiKind={uiKind}
							setApiConfigurationField={(field, value) => setApiConfiguration({ [field]: value })}
							errorMessage={errorMessage}
							setErrorMessage={setErrorMessage}
							hideOaCodeButton
						/>
						{isSettingUpOaCode ? (
							<ButtonLink href={getOaCodeBackendSignInUrl(uriScheme, uiKind)}>
								{t("oacode:settings.provider.login")}
							</ButtonLink>
						) : (
							<ButtonPrimary onClick={handleSubmit}>{t("welcome:start")}</ButtonPrimary>
						)}
					</>
				) : (
					<div className="bg-vscode-sideBar-background p-4">
						<OaCodeAuth onManualConfigClick={() => setManualConfig(true)} />
					</div>
				)}
			</TabContent>
		</Tab>
	)
}

export default WelcomeView
