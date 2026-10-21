export const JCODES_GITHUB_URL = 'https://github.com/jagantripuragiri/Jcodes-AI-Ide'
export const JCODES_DOWNLOADS_URL = `${JCODES_GITHUB_URL}/releases/latest`
export const JCODES_LATEST_RELEASE_API_URL = 'https://api.github.com/repos/jagantripuragiri/Jcodes-AI-Ide/releases/latest'

export type VoidCheckUpdateRespose = {
	message: string,
	action?: 'reinstall' | 'restart' | 'download' | 'apply'
} | {
	message: null,
	actions?: undefined,
} | null


