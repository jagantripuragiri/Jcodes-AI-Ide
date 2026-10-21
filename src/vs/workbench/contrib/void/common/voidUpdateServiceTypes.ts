export const JCODES_GITHUB_URL = 'https://github.com/jagantripuragiri/Jcodes-AI-Ide'
export const JCODES_DOWNLOADS_URL = `${JCODES_GITHUB_URL}/releases/latest`
export const JCODES_LATEST_RELEASE_API_URL = 'https://api.github.com/repos/jagantripuragiri/Jcodes-AI-Ide/releases/latest'
export const JCODES_RECENT_RELEASES_API_URL = 'https://api.github.com/repos/jagantripuragiri/Jcodes-AI-Ide/releases?per_page=5'
export const JCODES_RELEASE_BY_TAG_API_URL = 'https://api.github.com/repos/jagantripuragiri/Jcodes-AI-Ide/releases/tags/'

export type JCodesReleaseAsset = {
	name: string,
	url: string,
	sizeBytes: number,
	sha256: string | null, // GitHub's checksum of the file, used to verify downloads
}

// progress of "Update now" (download -> verify -> ready to restart), kept in the main process and polled by the UI
export type JCodesUpdateProgress = {
	phase: 'idle' | 'downloading' | 'preparing' | 'ready' | 'installing' | 'error',
	tag: string | null,
	receivedBytes: number,
	totalBytes: number,
	error: string | null, // a human-readable reason when phase is 'error'
}

export const IDLE_JCODES_UPDATE_PROGRESS: JCodesUpdateProgress = { phase: 'idle', tag: null, receivedBytes: 0, totalBytes: 0, error: null }

export type JCodesRelease = {
	tag: string,
	name: string,
	publishedAt: string | null,
	notes: string,
	url: string,
	isPrerelease: boolean,
	assets: JCodesReleaseAsset[],
}

// compares dotted numeric versions, ignoring a leading 'v' (so 'v1.10' is newer than '1.6')
export const isNewerVersion = (latest: string, current: string): boolean => {
	const partsOf = (v: string) => v.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0)
	const latestParts = partsOf(latest)
	const currentParts = partsOf(current)
	for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
		const diff = (latestParts[i] ?? 0) - (currentParts[i] ?? 0)
		if (diff !== 0) return diff > 0
	}
	return false
}

export type VoidCheckUpdateRespose = {
	message: string,
	action?: 'reinstall' | 'restart' | 'download' | 'apply'
} | {
	message: null,
	actions?: undefined,
} | null


