import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { getOaCodeBackendSignInUrl } from "../../helpers"
import { Button } from "@src/components/ui"
import { type ProviderSettings, type OrganizationAllowList, oacodeDefaultModelId } from "@roo-code/types"
import type { RouterModels } from "@roo/api"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { inputEventTransform } from "../../../settings/transforms"
import { ModelPicker } from "../../../settings/ModelPicker"
import { vscode } from "@src/utils/vscode"

type OaCodeProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	currentApiConfigName?: string
	hideOaCodeButton?: boolean
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	uriScheme: string | undefined
	uiKind: string | undefined
}

export const OaCode = ({
	apiConfiguration,
	setApiConfigurationField,
	currentApiConfigName,
	hideOaCodeButton,
	routerModels,
	organizationAllowList,
	uriScheme,
	uiKind,
}: OaCodeProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<div style={{ marginTop: "0px" }} className="text-sm text-vscode-descriptionForeground -mt-2">
				You get $20 for free!
			</div>
			<div>
				<label className="block font-medium -mb-2">{t("oacode:settings.provider.account")}</label>
			</div>
			{!hideOaCodeButton &&
				(apiConfiguration.oacodeToken ? (
					<div>
						<Button
							variant="secondary"
							onClick={async () => {
								setApiConfigurationField("oacodeToken", "")

								vscode.postMessage({
									type: "upsertApiConfiguration",
									text: currentApiConfigName,
									apiConfiguration: {
										...apiConfiguration,
										oacodeToken: "",
									},
								})
							}}>
							{t("oacode:settings.provider.logout")}
						</Button>
					</div>
				) : (
					<VSCodeButtonLink variant="secondary" href={getOaCodeBackendSignInUrl(uriScheme, uiKind)}>
						{t("oacode:settings.provider.login")}
					</VSCodeButtonLink>
				))}

			<VSCodeTextField
				value={apiConfiguration?.oacodeToken || ""}
				type="password"
				onInput={handleInputChange("oacodeToken")}
				placeholder={t("oacode:settings.provider.apiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("oacode:settings.provider.apiKey")}</label>
				</div>
			</VSCodeTextField>

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={oacodeDefaultModelId}
				models={routerModels?.["oacode-openrouter"] ?? {}}
				modelIdKey="oacodeModel"
				serviceName="OpenAnalyst"
				serviceUrl="https://oacode.ai"
				organizationAllowList={organizationAllowList}
			/>
		</>
	)
}
