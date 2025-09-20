import { PromptBlock, PromptBlockValidationError } from "../domain/PromptBlock"
import { PromptCategory } from "../domain/PromptCategory"

describe("PromptBlock", () => {
	describe("create", () => {
		it("should create a valid prompt block", () => {
			const data = {
				name: "test-block",
				description: "Test description",
				category: "analysis" as const,
				tags: ["test", "analysis"],
				prompt: "This is a test prompt.",
				priority: 80,
				enabled: true
			}

			const block = PromptBlock.create(data)

			expect(block.name).toBe("test-block")
			expect(block.description).toBe("Test description")
			expect(block.category).toBe(PromptCategory.ANALYSIS)
			expect(block.tags).toEqual(["test", "analysis"])
			expect(block.prompt).toBe("This is a test prompt.")
			expect(block.priority).toBe(80)
			expect(block.enabled).toBe(true)
		})

		it("should throw validation error for missing name", () => {
			const data = {
				name: "",
				category: "analysis" as const,
				prompt: "Test prompt"
			}

			expect(() => PromptBlock.create(data)).toThrow(PromptBlockValidationError)
		})

		it("should throw validation error for missing prompt", () => {
			const data = {
				name: "test-block",
				category: "analysis" as const,
				prompt: ""
			}

			expect(() => PromptBlock.create(data)).toThrow(PromptBlockValidationError)
		})

		it("should throw validation error for invalid category", () => {
			const data = {
				name: "test-block",
				category: "invalid-category" as any,
				prompt: "Test prompt"
			}

			expect(() => PromptBlock.create(data)).toThrow(PromptBlockValidationError)
		})

		it("should throw validation error for invalid name format", () => {
			const data = {
				name: "invalid name with spaces",
				category: "analysis" as const,
				prompt: "Test prompt"
			}

			expect(() => PromptBlock.create(data)).toThrow(PromptBlockValidationError)
		})

		it("should set default values", () => {
			const data = {
				name: "test-block",
				category: "analysis" as const,
				prompt: "Test prompt"
			}

			const block = PromptBlock.create(data)

			expect(block.description).toBe("")
			expect(block.tags).toEqual([])
			expect(block.variables).toEqual([])
			expect(block.outputs).toEqual([])
			expect(block.priority).toBe(50)
			expect(block.enabled).toBe(true)
		})
	})

	describe("resolvePrompt", () => {
		it("should return original prompt when no variables", () => {
			const data = {
				name: "test-block",
				category: "analysis" as const,
				prompt: "Simple prompt without variables."
			}

			const block = PromptBlock.create(data)
			const resolved = block.resolvePrompt()

			expect(resolved).toBe("Simple prompt without variables.")
		})

		it("should resolve variables in prompt", () => {
			const data = {
				name: "test-block",
				category: "analysis" as const,
				prompt: "Hello {{name}}, your role is {{role}}.",
				variables: [
					{ name: "name", description: "User name", required: true },
					{ name: "role", description: "User role", required: false, defaultValue: "analyst" }
				]
			}

			const block = PromptBlock.create(data)
			const resolved = block.resolvePrompt({ name: "Alice", role: "developer" })

			expect(resolved).toBe("Hello Alice, your role is developer.")
		})

		it("should use default values for missing variables", () => {
			const data = {
				name: "test-block",
				category: "analysis" as const,
				prompt: "Hello {{name}}, your role is {{role}}.",
				variables: [
					{ name: "name", description: "User name", required: true },
					{ name: "role", description: "User role", required: false, defaultValue: "analyst" }
				]
			}

			const block = PromptBlock.create(data)
			const resolved = block.resolvePrompt({ name: "Alice" })

			expect(resolved).toBe("Hello Alice, your role is analyst.")
		})
	})

	describe("utility methods", () => {
		let block: PromptBlock

		beforeEach(() => {
			block = PromptBlock.create({
				name: "test-block",
				category: "analysis" as const,
				prompt: "Test prompt",
				tags: ["test", "analysis"],
				variables: [
					{ name: "required-var", description: "Required variable", required: true },
					{ name: "optional-var", description: "Optional variable", required: false }
				]
			})
		})

		it("should check if block has variables", () => {
			expect(block.hasVariables()).toBe(true)
		})

		it("should get required variables", () => {
			const required = block.getRequiredVariables()
			expect(required).toHaveLength(1)
			expect(required[0].name).toBe("required-var")
		})

		it("should check if block has specific tag", () => {
			expect(block.hasTag("test")).toBe(true)
			expect(block.hasTag("nonexistent")).toBe(false)
		})

		it("should generate unique ID", () => {
			const id = block.getId()
			expect(id).toBe("analysis:test-block")
		})

		it("should convert to data object", () => {
			const data = block.toData()
			expect(data.name).toBe("test-block")
			expect(data.category).toBe("analysis")
		})

		it("should create copy with different enabled state", () => {
			const disabled = block.withEnabled(false)
			expect(disabled.enabled).toBe(false)
			expect(block.enabled).toBe(true) // Original unchanged
		})
	})
})