// oacode_change - new file
import React, { useEffect, useState } from "react"
import { SelectDropdown, DropdownOptionType } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { TemplateListPayload } from "@roo/WebviewMessage"
import { TemplateUploadModal } from "./TemplateUploadModal"

interface TemplateSelectorProps {
	disabled?: boolean
	className?: string
}

interface TemplateInfo {
	name: string
	filename: string
	modeCount: number
	modes: Array<{ slug: string; name: string }>
}

export const TemplateSelector = ({ disabled = false, className }: TemplateSelectorProps) => {
	const { t } = useAppTranslation()
	const [templates, setTemplates] = useState<TemplateInfo[]>([])
	const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [showUploadModal, setShowUploadModal] = useState(false)
	const [dragActive, setDragActive] = useState(false)

	// Load template list on mount
	useEffect(() => {
		vscode.postMessage({ type: "getTemplateList" })
	}, [])

	// Listen for template list updates
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "templateList") {
				const payload = message.payload as TemplateListPayload
				setTemplates(payload.templates)
				setActiveTemplate(payload.activeTemplate)
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	// Global drag & drop listeners for better UX
	useEffect(() => {
		const handleGlobalDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes('Files')) {
				setDragActive(true)
			}
		}

		const handleGlobalDragLeave = (e: DragEvent) => {
			// Only set dragActive to false if we're leaving the window
			if (!e.relatedTarget) {
				setDragActive(false)
			}
		}

		const handleGlobalDrop = (e: DragEvent) => {
			e.preventDefault()
			setDragActive(false)
		}

		document.addEventListener("dragenter", handleGlobalDragEnter)
		document.addEventListener("dragleave", handleGlobalDragLeave)
		document.addEventListener("drop", handleGlobalDrop)
		document.addEventListener("dragover", (e) => e.preventDefault())

		return () => {
			document.removeEventListener("dragenter", handleGlobalDragEnter)
			document.removeEventListener("dragleave", handleGlobalDragLeave)
			document.removeEventListener("drop", handleGlobalDrop)
			document.removeEventListener("dragover", (e) => e.preventDefault())
		}
	}, [])

	const handleChange = React.useCallback((selectedValue: string) => {
		if (selectedValue === "none") {
			// Deactivate current template
			vscode.postMessage({ type: "deactivateTemplate" })
			setActiveTemplate(null)
		} else if (selectedValue !== activeTemplate) {
			// Activate selected template
			vscode.postMessage({ 
				type: "activateTemplate", 
				templateName: selectedValue 
			})
			setActiveTemplate(selectedValue)
		}
	}, [activeTemplate])

	const handleUploadSuccess = React.useCallback(() => {
		// Refresh template list after successful upload
		vscode.postMessage({ type: "getTemplateList" })
	}, [])

	const handleAction = React.useCallback((actionValue: string) => {
		if (actionValue === "upload") {
			setShowUploadModal(true)
		}
	}, [])

	const handleFileDrop = React.useCallback((files: FileList) => {
		const file = files[0]
		if (file && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
			// Handle direct file drop
			file.text().then(content => {
				vscode.postMessage({
					type: 'uploadTemplateFile',
					filename: file.name,
					content: content
				})
				// Refresh after upload
				setTimeout(() => {
					vscode.postMessage({ type: "getTemplateList" })
				}, 500)
			}).catch(error => {
				console.error('Failed to read dropped file:', error)
			})
		}
	}, [])


	// const handleDelete = React.useCallback((templateName: string) => {
	// 	if (confirm(`Are you sure you want to delete template "${templateName}"?`)) {
	// 		vscode.postMessage({
	// 			type: "deleteTemplate",
	// 			templateName
	// 		})
	// 		// Refresh template list
	// 		setTimeout(() => {
	// 			vscode.postMessage({ type: "getTemplateList" })
	// 		}, 100)
	// 	}
	// }, [])

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<span>Loading templates...</span>
			</div>
		)
	}

	const options = [
		{
			value: "none",
			label: "No Template",
			description: "Use built-in modes only",
		},
		...templates.map(template => ({
			value: template.name,
			label: template.name,
			description: `${template.modeCount} mode(s): ${template.modes.map(m => m.name).join(", ")}`,
		})),
		{
			value: "upload",
			label: "📁 Upload New Template...",
			description: "Add a new YAML template file",
			type: DropdownOptionType.ACTION,
		},
	]

	const currentValue = activeTemplate || "none"

	return (
		<div className={className}>
			<SelectDropdown
				value={currentValue}
				title="Select Template"
				disabled={disabled}
				placeholder={templates.length === 0 ? "No templates available" : "Select template..."}
				options={options}
				onChange={handleChange}
				onAction={handleAction}
				onDrop={handleFileDrop}
				dragActive={dragActive}
			/>
			
			<TemplateUploadModal
				isOpen={showUploadModal}
				onClose={() => setShowUploadModal(false)}
				onUploadSuccess={handleUploadSuccess}
			/>
		</div>
	)
}