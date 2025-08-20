import { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { CompletionUsage, OpenRouterHandler } from "./openrouter"
import { getModelParams } from "../transform/model-params"
import { getModels } from "./fetchers/modelCache"
import {
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	oacodeDefaultModelId,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
} from "@roo-code/types"
import { getoaBaseUriFromToken } from "../../utils/oacode-token"
import { ApiHandlerCreateMessageMetadata } from ".."
import OpenAI from "openai"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"

/**
 * A custom OpenRouter handler that overrides the getModel function
 * to provide custom model information and fetches models from the oacode OpenRouter endpoint.
 */
export class oacodeOpenrouterHandler extends OpenRouterHandler {
	protected override models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		const baseUri = getOaBaseUri(options)
		options = {
			...options,
			openRouterBaseUrl: `${baseUri}/api/openrouter/`,
			openRouterApiKey: options.oacodeToken,
		}

		super(options)
	}

	override customRequestOptions(metadata?: ApiHandlerCreateMessageMetadata): OpenAI.RequestOptions | undefined {
		return metadata
			? {
					headers: {
						"X-oacode-TaskId": metadata.taskId,
					},
				}
			: undefined
	}

	override getTotalCost(lastUsage: CompletionUsage): number {
		// https://github.com/oa-Org/oacode-backend/blob/eb3d382df1e933a089eea95b9c4387db0c676e35/src/lib/processUsage.ts#L281
		if (lastUsage.is_byok) {
			return lastUsage.cost_details?.upstream_inference_cost || 0
		}
		return lastUsage.cost || 0
	}

	override getModel() {
		let id = this.options.oacodeModel ?? oacodeDefaultModelId
		let info = this.models[id]
		let defaultTemperature = 0

		if (!this.models[id]) {
			id = openRouterDefaultModelId
			info = openRouterDefaultModelInfo
		}

		// If a specific provider is requested, use the endpoint for that provider.
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : defaultTemperature,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	public override async fetchModel() {
		if (!this.options.oacodeToken || !this.options.openRouterBaseUrl) {
			throw new Error("oacode token + baseUrl is required to fetch models")
		}

		const [models, endpoints] = await Promise.all([
			getModels({
				provider: "oacode-openrouter",
				oacodeToken: this.options.oacodeToken,
			}),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.oacodeModel,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])

		this.models = models
		this.endpoints = endpoints
		return this.getModel()
	}
}

function getOaBaseUri(options: ApiHandlerOptions) {
	return getoaBaseUriFromToken(options.oacodeToken ?? "")
}
