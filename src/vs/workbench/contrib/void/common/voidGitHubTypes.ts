// Shared types for the GitHub Account Manager feature.
// electron-main (voidGitHubChannel.ts) produces these; browser (voidGitHubService.ts) consumes them
// over the 'void-channel-github' IPC channel, the same shape sendLLMMessageTypes.ts uses for sendLLMMessage.

export interface IGitHubAccount {
	/** GitHub login/username, eg "octocat" */
	login: string
	/** GitHub display name, if the public profile has one */
	name: string | null
	/** Public avatar URL (fetched unauthenticated from api.github.com/users/<login>) */
	avatarUrl: string | null
	/** Whether this is the account `gh` currently uses for github.com operations */
	isActive: boolean
}

export type GitHubCliStatus =
	| { installed: false }
	| { installed: true; version: string }

// ---------- login (device/browser flow) — streamed over IPC, keyed by requestId ----------

export interface MainGitHubLoginParams {
	requestId: string
}

export interface MainGitHubLoginAbortParams {
	requestId: string
}

export interface EventGitHubLoginOnProgressParams {
	requestId: string
	message: string
	/** One-time device code the user enters/confirms at verificationUri, once `gh` has printed it */
	code?: string
	/** Where the user completes authentication - defaults to GitHub's device-flow URL if gh doesn't print one explicitly */
	verificationUri?: string
}

export interface EventGitHubLoginOnSuccessParams {
	requestId: string
	account: IGitHubAccount
}

export interface EventGitHubLoginOnErrorParams {
	requestId: string
	message: string
	/** true if the user (or the UI) cancelled the in-progress login, as opposed to a real failure */
	cancelled: boolean
}

// ---------- simple request/response params ----------

export interface MainGitHubSwitchAccountParams {
	login: string
}

export interface MainGitHubRemoveAccountParams {
	login: string
}
