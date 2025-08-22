// oacode_change - new file
import React, { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

interface TemplateUploadModalProps {
	isOpen: boolean
	onClose: () => void
	onUploadSuccess: () => void
}

export const TemplateUploadModal = ({ isOpen, onClose, onUploadSuccess }: TemplateUploadModalProps) => {
	const { t } = useAppTranslation()
	const [isUploading, setIsUploading] = useState(false)
	const [dragActive, setDragActive] = useState(false)

	const handleFileUpload = useCallback(async (file: File) => {
		if (!file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
			console.error('Please select a YAML file (.yaml or .yml extension)')
			return
		}

		setIsUploading(true)
		try {
			const content = await file.text()
			
			vscode.postMessage({
				type: 'uploadTemplateFile',
				filename: file.name,
				content: content
			})

			onUploadSuccess()
			onClose()
		} catch (error) {
			console.error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
		} finally {
			setIsUploading(false)
		}
	}, [onUploadSuccess, onClose])

	const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			handleFileUpload(file)
		}
		// Reset input to allow same file selection again
		event.target.value = ''
	}, [handleFileUpload])

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragActive(true)
	}, [])

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragActive(false)
	}, [])

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
	}, [])

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragActive(false)

		const files = e.dataTransfer.files
		if (files.length > 0) {
			handleFileUpload(files[0])
		}
	}, [handleFileUpload])

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-vscode-input-background border border-vscode-dropdown-border rounded-lg p-6 w-96 max-w-full mx-4">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-vscode-foreground">Upload Template</h3>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						disabled={isUploading}
						className="p-1"
					>
						×
					</Button>
				</div>

				<div className="space-y-4">
					{/* File Input */}
					<div className="relative">
						<Input
							type="file"
							accept=".yaml,.yml"
							onChange={handleFileSelect}
							disabled={isUploading}
							className="sr-only"
							id="template-file-input"
						/>
						<Button
							variant="outline"
							size="sm"
							disabled={isUploading}
							onClick={() => document.getElementById('template-file-input')?.click()}
							className="w-full"
						>
							{isUploading ? 'Uploading...' : 'Choose YAML File'}
						</Button>
					</div>

					{/* Drag & Drop Area */}
					<div
						onDragEnter={handleDragEnter}
						onDragLeave={handleDragLeave}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
						className={`
							border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
							${dragActive 
								? 'border-vscode-focusBorder bg-vscode-input-background' 
								: 'border-vscode-dropdown-border'
							}
							${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-vscode-focusBorder'}
						`}
						onClick={() => !isUploading && document.getElementById('template-file-input')?.click()}
					>
						<div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
							<div className="text-2xl">📁</div>
							<div>
								{isUploading ? (
									<span>Uploading template...</span>
								) : dragActive ? (
									<span className="text-vscode-input-foreground">Drop YAML file here</span>
								) : (
									<>
										<span>Drag & drop a YAML template file</span>
										<br />
										<span className="text-xs">or click to browse</span>
									</>
								)}
							</div>
						</div>
					</div>

					<div className="text-xs text-muted-foreground text-center">
						Supported formats: .yaml, .yml
					</div>

					{/* Actions */}
					<div className="flex gap-2 pt-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							disabled={isUploading}
							className="flex-1"
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}