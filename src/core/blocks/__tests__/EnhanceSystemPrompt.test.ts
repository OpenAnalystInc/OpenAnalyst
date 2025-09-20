import { EnhanceSystemPrompt, ActivePromptConfig } from "../usecases/EnhanceSystemPrompt"
import { PromptBlock } from "../domain/PromptBlock"
import { PromptCategory } from "../domain/PromptCategory"

describe("EnhanceSystemPrompt", () => {
	let enhanceUseCase: EnhanceSystemPrompt
	let analysisBlock: PromptBlock
	let visualizationBlock: PromptBlock
	let reportingBlock: PromptBlock

	beforeEach(() => {
		enhanceUseCase = new EnhanceSystemPrompt()
		
		analysisBlock = PromptBlock.create({
			name: "eda-analysis",
			category: "analysis",
			prompt: "Perform comprehensive EDA analysis.",
			priority: 80
		})

		visualizationBlock = PromptBlock.create({
			name: "chart-visualization", 
			category: "visualization",
			prompt: "Create Chart.js visualizations.",
			priority: 90
		})

		reportingBlock = PromptBlock.create({
			name: "statistical-reporting",
			category: "reporting", 
			prompt: "Generate statistical reports.",
			priority: 75
		})
	})

	describe("execute", () => {
		it("should return original prompt when no active prompts", () => {
			const originalPrompt = "You are an AI assistant."
			const result = enhanceUseCase.execute(originalPrompt, [])

			expect(result.enhancedPrompt).toBe(originalPrompt)
			expect(result.appliedPrompts).toHaveLength(0)
			expect(result.conflictResolution).toHaveLength(0)
		})

		it("should enhance prompt with single block", () => {
			const originalPrompt = "You are an AI assistant."
			const activePrompts: ActivePromptConfig[] = [
				enhanceUseCase.createActivePrompt(analysisBlock)
			]

			const result = enhanceUseCase.execute(originalPrompt, activePrompts)

			expect(result.enhancedPrompt).toBe(
				"You are an AI assistant.\n\nPerform comprehensive EDA analysis."
			)
			expect(result.appliedPrompts).toHaveLength(1)
			expect(result.conflictResolution).toHaveLength(0)
		})

		it("should enhance prompt with multiple blocks", () => {
			const originalPrompt = "You are an AI assistant."
			const activePrompts: ActivePromptConfig[] = [
				enhanceUseCase.createActivePrompt(analysisBlock),
				enhanceUseCase.createActivePrompt(visualizationBlock),
				enhanceUseCase.createActivePrompt(reportingBlock)
			]

			const result = enhanceUseCase.execute(originalPrompt, activePrompts)

			// Should be sorted by priority (visualization: 90, analysis: 80, reporting: 75)
			const lines = result.enhancedPrompt.split("\n\n")
			expect(lines[0]).toBe("You are an AI assistant.")
			expect(lines[1]).toBe("Create Chart.js visualizations.")
			expect(lines[2]).toBe("Perform comprehensive EDA analysis.")
			expect(lines[3]).toBe("Generate statistical reports.")
			
			expect(result.appliedPrompts).toHaveLength(3)
			expect(result.conflictResolution).toHaveLength(0)
		})

		it("should resolve category conflicts by priority", () => {
			// Create two analysis blocks with different priorities
			const highPriorityAnalysis = PromptBlock.create({
				name: "advanced-analysis",
				category: "analysis",
				prompt: "Advanced analysis instructions.",
				priority: 90
			})

			const lowPriorityAnalysis = PromptBlock.create({
				name: "basic-analysis", 
				category: "analysis",
				prompt: "Basic analysis instructions.",
				priority: 60
			})

			const originalPrompt = "You are an AI assistant."
			const activePrompts: ActivePromptConfig[] = [
				enhanceUseCase.createActivePrompt(lowPriorityAnalysis),
				enhanceUseCase.createActivePrompt(highPriorityAnalysis)
			]

			const result = enhanceUseCase.execute(originalPrompt, activePrompts)

			expect(result.enhancedPrompt).toBe(
				"You are an AI assistant.\n\nAdvanced analysis instructions."
			)
			expect(result.appliedPrompts).toHaveLength(1)
			expect(result.appliedPrompts[0].block.name).toBe("advanced-analysis")
			
			expect(result.conflictResolution).toHaveLength(1)
			expect(result.conflictResolution[0].category).toBe(PromptCategory.ANALYSIS)
			expect(result.conflictResolution[0].selectedBlock).toBe("advanced-analysis")
			expect(result.conflictResolution[0].previousBlock).toBe("basic-analysis")
		})

		it("should handle prompt variables", () => {
			const variableBlock = PromptBlock.create({
				name: "variable-block",
				category: "analysis",
				prompt: "Hello {{name}}, analyze {{dataset}}.",
				variables: [
					{ name: "name", description: "User name", required: true },
					{ name: "dataset", description: "Dataset name", required: true }
				]
			})

			const originalPrompt = "You are an AI assistant."
			const activePrompts: ActivePromptConfig[] = [
				enhanceUseCase.createActivePrompt(variableBlock, { 
					name: "Alice", 
					dataset: "sales_data.csv" 
				})
			]

			const result = enhanceUseCase.execute(originalPrompt, activePrompts)

			expect(result.enhancedPrompt).toBe(
				"You are an AI assistant.\n\nHello Alice, analyze sales_data.csv."
			)
		})
	})

	describe("generatePromptSummary", () => {
		it("should return message when no active prompts", () => {
			const summary = enhanceUseCase.generatePromptSummary([])
			expect(summary).toBe("No active prompt blocks")
		})

		it("should generate summary for single prompt", () => {
			const activePrompts: ActivePromptConfig[] = [
				enhanceUseCase.createActivePrompt(analysisBlock)
			]

			const summary = enhanceUseCase.generatePromptSummary(activePrompts)
			expect(summary).toBe("Analysis: eda-analysis")
		})

		it("should generate summary for multiple prompts", () => {
			const activePrompts: ActivePromptConfig[] = [
				enhanceUseCase.createActivePrompt(analysisBlock),
				enhanceUseCase.createActivePrompt(visualizationBlock),
				enhanceUseCase.createActivePrompt(reportingBlock)
			]

			const summary = enhanceUseCase.generatePromptSummary(activePrompts)
			
			// Should group by category
			expect(summary).toContain("Analysis: eda-analysis")
			expect(summary).toContain("Visualization: chart-visualization")
			expect(summary).toContain("Reporting: statistical-reporting")
		})
	})

	describe("createActivePrompt", () => {
		it("should create active prompt config", () => {
			const config = enhanceUseCase.createActivePrompt(
				analysisBlock, 
				{ key: "value" }, 
				95
			)

			expect(config.block).toBe(analysisBlock)
			expect(config.variables).toEqual({ key: "value" })
			expect(config.priority).toBe(95)
		})

		it("should use block priority as default", () => {
			const config = enhanceUseCase.createActivePrompt(analysisBlock)

			expect(config.priority).toBe(80) // Block's priority
		})
	})
})