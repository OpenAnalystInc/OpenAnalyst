// import { useExtensionState } from "@/context/ExtensionStateContext" // No longer needed
import React, { useEffect } from "react"
import { vscode } from "@/utils/vscode"
import {
	BalanceDataResponsePayload,
	ProfileData,
	ProfileDataResponsePayload,
	WebviewMessage,
} from "@roo/WebviewMessage"
import { VSCodeButtonLink } from "@/components/common/VSCodeButtonLink"
import { VSCodeButton, VSCodeDivider } from "@vscode/webview-ui-toolkit/react"
import CountUp from "react-countup"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Tab, TabContent, TabHeader } from "@src/components/common/Tab"
import { Button } from "@src/components/ui"
import OaCodeAuth from "../common/OaCodeAuth"

interface ProfileViewProps {
	onDone: () => void
}

const ProfileView: React.FC<ProfileViewProps> = ({ onDone }) => {
	const { apiConfiguration, currentApiConfigName, uriScheme, uiKind } = useExtensionState()
	const { t } = useAppTranslation()
	const [profileData, setProfileData] = React.useState<ProfileData | undefined | null>(null)
	const [balance, setBalance] = React.useState<number | null>(null)
	const [isLoadingBalance, setIsLoadingBalance] = React.useState(true)
	const [isLoadingUser, setIsLoadingUser] = React.useState(true)

	useEffect(() => {
		vscode.postMessage({
			type: "fetchProfileDataRequest",
		})
		vscode.postMessage({
			type: "fetchBalanceDataRequest",
		})
	}, [apiConfiguration?.oacodeToken])

	useEffect(() => {
		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as ProfileDataResponsePayload
				if (payload.success) {
					setProfileData(payload.data)
				} else {
					console.error("Error fetching profile data:", payload.error)
					setProfileData(null)
				}
				setIsLoadingUser(false)
			} else if (message.type === "balanceDataResponse") {
				const payload = message.payload as BalanceDataResponsePayload
				if (payload.success) {
					setBalance(payload.data?.balance || 0)
				} else {
					console.error("Error fetching balance data:", payload.error)
					setBalance(null)
				}
				setIsLoadingBalance(false)
			} else if (message.type === "updateProfileData") {
				vscode.postMessage({
					type: "fetchProfileDataRequest",
				})
				vscode.postMessage({
					type: "fetchBalanceDataRequest",
				})
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const user = profileData?.user

	function handleLogout(): void {
		console.info("Logging out...", apiConfiguration)
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: currentApiConfigName,
			apiConfiguration: {
				...apiConfiguration,
				oacodeToken: "",
			},
		})
	}

	const creditPackages = [
		{
			credits: 20,
			popular: false,
		},
		{
			credits: 50,
			popular: true,
		},
		{
			credits: 100,
			popular: false,
		},
		{
			credits: 200,
			popular: false,
		},
	]

	const handleBuyCredits = (credits: number) => () => {
		vscode.postMessage({
			type: "shopBuyCredits",
			values: {
				credits: credits,
				uriScheme: uriScheme,
				uiKind: uiKind,
			},
		})
	}

	if (isLoadingUser) {
		return <></>
	}

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center">
				<h3 className="text-vscode-foreground m-0">{t("oacode:profile.title")}</h3>
				<Button onClick={onDone}>{t("settings:common.done")}</Button>
			</TabHeader>
			<TabContent>
				<div className="h-full flex flex-col">
					<div className="flex-1">
						{user ? (
							<div className="flex flex-col pr-3 h-full">
								<div className="flex flex-col w-full">
									<div className="flex items-center mb-6 flex-wrap gap-y-4">
										{user.image ? (
											<img src={user.image} alt="Profile" className="size-16 rounded-full mr-4" />
										) : (
											<div className="size-16 rounded-full bg-[var(--vscode-button-background)] flex items-center justify-center text-2xl text-[var(--vscode-button-foreground)] mr-4">
												{user.name?.[0] || user.email?.[0] || "?"}
											</div>
										)}

										<div className="flex flex-col">
											{user.name && (
												<h2 className="text-[var(--vscode-foreground)] m-0 mb-1 text-lg font-medium">
													{user.name}
												</h2>
											)}

											{user.email && (
												<div className="text-sm text-[var(--vscode-descriptionForeground)]">
													{user.email}
												</div>
											)}

											{/* Show plan information from JWT token */}
											{(user as any)?.plan && (
												<div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1 capitalize">
													{(user as any).plan} Plan
													{(user as any).environment === 'development' && (
														<span className="ml-2 px-2 py-0.5 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] rounded text-xs">
															Dev
														</span>
													)}
												</div>
											)}
											
											{/* Show token source indicator */}
											{(profileData as any)?.source === 'token' && (
												<div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1 opacity-75">
													<span className="mr-1">📱</span>
													Using cached profile data
												</div>
											)}
										</div>
									</div>
								</div>

								<div className="w-full flex gap-2 flex-col min-[225px]:flex-row">
									<div className="w-full min-[225px]:w-1/2">
										<VSCodeButtonLink
											href="https://oacode.ai/profile"
											appearance="primary"
											className="w-full">
											{t("oacode:profile.dashboard")}
										</VSCodeButtonLink>
									</div>
									<VSCodeButton
										appearance="secondary"
										onClick={handleLogout}
										className="w-full min-[225px]:w-1/2">
										{t("oacode:profile.logOut")}
									</VSCodeButton>
								</div>

								<VSCodeDivider className="w-full my-6" />

								<div className="w-full flex flex-col items-center">
									<div className="text-sm text-[var(--vscode-descriptionForeground)] mb-3">
										{t("oacode:profile.currentBalance")}
										{/* Show indicator if data comes from token fallback */}
										{(profileData as any)?.source === 'token' && (
											<span className="ml-2 px-2 py-0.5 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] rounded text-xs">
												Offline
											</span>
										)}
									</div>

									<div className="text-4xl font-bold text-[var(--vscode-foreground)] mb-6 flex items-center gap-2">
										{isLoadingBalance ? (
											<div className="text-[var(--vscode-descriptionForeground)]">
												{t("oacode:profile.loading")}
											</div>
										) : (
											balance && (
												<>
													<span>$</span>
													<CountUp end={balance} duration={0.66} decimals={2} />
													<VSCodeButton
														appearance="icon"
														className="mt-1"
														onClick={() => {
															setIsLoadingBalance(true)

															vscode.postMessage({ type: "fetchBalanceDataRequest" })
														}}>
														<span className="codicon codicon-refresh"></span>
													</VSCodeButton>
												</>
											)
										)}
									</div>

									{/* Buy Credits Section */}
									<div className="w-full mt-8">
										<div className="text-lg font-semibold text-[var(--vscode-foreground)] mb-4 text-center">
											{t("oacode:profile.shop.title")}
										</div>

										<div className="grid grid-cols-1 min-[300px]:grid-cols-2 gap-3 mb-6">
											{creditPackages.map((pkg) => (
												<div
													key={pkg.credits}
													className={`relative border rounded-lg p-4 bg-[var(--vscode-editor-background)] transition-all hover:shadow-md ${
														pkg.popular
															? "border-[var(--vscode-button-background)] ring-1 ring-[var(--vscode-button-background)]"
															: "border-[var(--vscode-input-border)]"
													}`}>
													{pkg.popular && (
														<div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
															<span className="bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] text-xs px-2 py-1 rounded-full font-medium">
																{t("oacode:profile.shop.popular")}
															</span>
														</div>
													)}

													<div className="text-center">
														<div className="text-2xl font-bold text-[var(--vscode-foreground)] mb-1">
															${pkg.credits}
														</div>
														<div className="text-sm text-[var(--vscode-descriptionForeground)] mb-2">
															{t("oacode:profile.shop.credits")}
														</div>
														<VSCodeButton
															appearance={pkg.popular ? "primary" : "secondary"}
															className="w-full"
															onClick={handleBuyCredits(pkg.credits)}>
															{t("oacode:profile.shop.action")}
														</VSCodeButton>
													</div>
												</div>
											))}
										</div>

										<div className="text-center">
											<VSCodeButtonLink
												href="https://oacode.ai/profile"
												appearance="secondary"
												className="text-sm">
												{t("oacode:profile.shop.viewAll")}
											</VSCodeButtonLink>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center pr-3">
								<OaCodeAuth className="w-full" />
							</div>
						)}
					</div>
				</div>
			</TabContent>
		</Tab>
	)
}

export default ProfileView
