import { URI } from '../../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../../base/common/uuid.js';
import { StagingSelectionItem } from '../../../../common/chatThreadServiceTypes.js';
import { ImageMimeType } from '../../../../common/sendLLMMessageTypes.js';
import { IChatThreadService } from '../../../chatThreadService.js';

export const MAX_IMAGES_PER_MESSAGE = 5
export const MAX_IMAGE_SOURCE_BYTES = 20_000_000 // reject original file above this, before any resizing
const MAX_IMAGE_BASE64_CHARS = 4_000_000 // soft budget after resize/re-encode - Anthropic's hard cap is the strictest of the three providers at ~5MB

const SUPPORTED_MIME_TYPES: ImageMimeType[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const extensionForMime = (mime: ImageMimeType): string =>
	mime === 'image/png' ? '.png'
		: mime === 'image/jpeg' ? '.jpg'
			: mime === 'image/webp' ? '.webp'
				: '.gif'

// downscale thresholds ported from VS Code core's chat/browser/imageUtils.ts resizeImage(), tuned for OpenAI's vision tiling
const MAX_LONG_SIDE = 2048
const TARGET_SHORT_SIDE = 768

const loadImage = (objectUrl: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
	const img = new window.Image()
	img.onload = () => resolve(img)
	img.onerror = () => reject(new Error('failed to load image'))
	img.src = objectUrl
})

const blobToBase64 = (blob: Blob): Promise<{ base64Data: string; sizeBytes: number }> => new Promise((resolve, reject) => {
	const reader = new FileReader()
	reader.onerror = () => reject(reader.error ?? new Error('failed to read image'))
	reader.onload = () => {
		const dataUrl = reader.result as string
		const base64Data = dataUrl.slice(dataUrl.indexOf(',') + 1)
		resolve({ base64Data, sizeBytes: blob.size })
	}
	reader.readAsDataURL(blob)
})

const canvasToBase64 = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<{ base64Data: string; sizeBytes: number }> => new Promise((resolve, reject) => {
	canvas.toBlob(blob => {
		if (!blob) { reject(new Error('failed to encode image')); return }
		blobToBase64(blob).then(resolve, reject)
	}, mimeType, quality)
})

export const resizeImageToBase64 = async (file: File | Blob): Promise<{
	base64Data: string;
	mimeType: ImageMimeType;
	width: number;
	height: number;
	sizeBytes: number;
}> => {
	const objectUrl = URL.createObjectURL(file)
	try {
		const img = await loadImage(objectUrl)
		const { naturalWidth: w, naturalHeight: h } = img
		const originalMimeSupported = SUPPORTED_MIME_TYPES.includes(file.type as ImageMimeType)

		// fast path: already small and already a supported format - avoid re-encoding and losing quality
		if (w <= TARGET_SHORT_SIDE && h <= TARGET_SHORT_SIDE && originalMimeSupported) {
			const { base64Data, sizeBytes } = await blobToBase64(file)
			if (base64Data.length <= MAX_IMAGE_BASE64_CHARS) {
				return { base64Data, mimeType: file.type as ImageMimeType, width: w, height: h, sizeBytes }
			}
			// else fall through to canvas re-encode below (rare: small dims but large file, e.g. an animated/high-bit-depth PNG)
		}

		const scaleToLongCap = Math.min(1, MAX_LONG_SIDE / Math.max(w, h))
		const midW = w * scaleToLongCap
		const midH = h * scaleToLongCap
		const scaleToShortTarget = Math.min(1, TARGET_SHORT_SIDE / Math.min(midW, midH))
		const finalScale = scaleToLongCap * scaleToShortTarget
		const targetW = Math.max(1, Math.round(w * finalScale))
		const targetH = Math.max(1, Math.round(h * finalScale))

		const canvas = document.createElement('canvas')
		canvas.width = targetW
		canvas.height = targetH
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('canvas 2d context unavailable')
		ctx.drawImage(img, 0, 0, targetW, targetH)

		let { base64Data, sizeBytes } = await canvasToBase64(canvas, 'image/png')
		let mimeType: ImageMimeType = 'image/png'
		if (base64Data.length > MAX_IMAGE_BASE64_CHARS) {
			// PNG compresses screenshots/UI poorly - re-encode as JPEG to hit the size budget
			const jpeg = await canvasToBase64(canvas, 'image/jpeg', 0.8)
			base64Data = jpeg.base64Data
			sizeBytes = jpeg.sizeBytes
			mimeType = 'image/jpeg'
		}
		return { base64Data, mimeType, width: targetW, height: targetH, sizeBytes }
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

export const fileToStagingImageSelection = async (file: File | Blob, filename: string): Promise<StagingSelectionItem> => {
	const { base64Data, mimeType, width, height, sizeBytes } = await resizeImageToBase64(file)
	return {
		type: 'Image',
		uri: URI.from({ scheme: 'void-image', path: `/${generateUuid()}${extensionForMime(mimeType)}` }),
		filename,
		mimeType,
		base64Data,
		width,
		height,
		sizeBytes,
	}
}

export type ImageAttachRejection = { filename: string; reason: 'not_an_image' | 'too_large' | 'max_images_reached' }

// the single convergence point for all three capture paths (attach button, paste, drag-and-drop)
export const addImageFilesToStaging = async (
	chatThreadService: IChatThreadService,
	files: (File | Blob)[],
	opts?: { filenamePrefix?: string },
): Promise<ImageAttachRejection[]> => {
	const focusedMessageIdx = chatThreadService.getCurrentFocusedMessageIdx()
	const currentSelections = focusedMessageIdx === undefined
		? chatThreadService.getCurrentThreadState().stagingSelections
		: chatThreadService.getCurrentMessageState(focusedMessageIdx).stagingSelections
	let currentImageCount = currentSelections.filter(s => s.type === 'Image').length

	const rejections: ImageAttachRejection[] = []
	let idx = 0
	for (const file of files) {
		idx += 1
		const filename = file instanceof File ? file.name : `${opts?.filenamePrefix ?? 'Image'} ${idx}`

		if (!file.type.startsWith('image/')) {
			rejections.push({ filename, reason: 'not_an_image' })
			continue
		}
		if (currentImageCount >= MAX_IMAGES_PER_MESSAGE) {
			rejections.push({ filename, reason: 'max_images_reached' })
			continue
		}
		if (file.size > MAX_IMAGE_SOURCE_BYTES) {
			rejections.push({ filename, reason: 'too_large' })
			continue
		}

		const selection = await fileToStagingImageSelection(file, filename)
		chatThreadService.addNewStagingSelection(selection)
		currentImageCount += 1
	}
	return rejections
}
