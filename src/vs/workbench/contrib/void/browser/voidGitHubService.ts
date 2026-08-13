// GitHub Account Manager — browser-side orchestration service.
// Thin IPC layer (channel.call/listen, same shape as sendLLMMessageService.ts) plus the state/persistence
// a stateful Void service normally owns (same shape as tokenUsageService.ts / projectBrainService.ts).
// The UI (github-accounts-tsx) and the command palette actions (github/githubAccountsActions.ts) both
// go through this service - neither talks to the IPC channel directly, so there's exactly one place that
// decides what "switched" or "added" really means (see rule of thumb: never fake account switching).

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { GITHUB_ACCOUNTS_CACHE_STORAGE_KEY } from '../common/storageKeys.js';
import {
	IGitHubAccount, GitHubCliStatus,
	EventGitHubLoginOnProgressParams, EventGitHubLoginOnSuccessParams, EventGitHubLoginOnErrorParams,
} from '../common/voidGitHubTypes.js';

export interface GitHubLoginProgress {
	requestId: string
	message: string
	code?: string
	verificationUri?: string
}

export interface GitHubAccountsState {
	accounts: IGitHubAccount[]
	cliStatus: GitHubCliStatus | null
	isRefreshing: boolean
	login: GitHubLoginProgress | null
	switchingLogin: string | null
	removingLogin: string | null
	lastError: string | null
}

const INITIAL_STATE: GitHubAccountsState = {
	accounts: [],
	cliStatus: null,
	isRefreshing: false,
	login: null,
	switchingLogin: null,
	removingLogin: null,
	lastError: null,
}

export interface IGitHubAccountService {
	readonly _serviceBrand: undefined
	readonly onDidChangeState: Event<void>
	readonly state: GitHubAccountsState
	/** Re-queries gh CLI availability + `gh auth status` and refreshes account metadata/avatars. */
	refresh(): Promise<void>
	/** Starts the browser-based device login flow; progress/success/error land in `state.login`. */
	startLogin(): void
	cancelLogin(): void
	switchAccount(login: string): Promise<void>
	/** Also signs the account out of the GitHub CLI (see rule: don't fake removal, gh's auth state is the source of truth). */
	removeAccount(login: string): Promise<void>
	clearError(): void
}

export const IGitHubAccountService = createDecorator<IGitHubAccountService>('githubAccountService')

interface CachedAccounts {
	accounts: IGitHubAccount[]
}

class GitHubAccountService extends Disposable implements IGitHubAccountService {
	readonly _serviceBrand: undefined

	private readonly _onDidChangeState = new Emitter<void>()
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event

	private _state: GitHubAccountsState = INITIAL_STATE
	get state(): GitHubAccountsState { return this._state }

	private readonly _channel: IChannel
	private _activeLoginRequestId: string | null = null

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IStorageService private readonly _storageService: IStorageService,
		@INotificationService private readonly _notificationService: INotificationService,
	) {
		super()
		this._channel = mainProcessService.getChannel('void-channel-github')

		const cached = this._readCache()
		if (cached) this._state = { ...this._state, accounts: cached.accounts }

		this._register((this._channel.listen('onProgress_login') satisfies Event<EventGitHubLoginOnProgressParams>)(e => this._onLoginProgress(e)))
		this._register((this._channel.listen('onSuccess_login') satisfies Event<EventGitHubLoginOnSuccessParams>)(e => this._onLoginSuccess(e)))
		this._register((this._channel.listen('onError_login') satisfies Event<EventGitHubLoginOnErrorParams>)(e => this._onLoginError(e)))

		this.refresh()
	}

	async refresh(): Promise<void> {
		this._setState({ isRefreshing: true, lastError: null })
		try {
			const cliStatus: GitHubCliStatus = await this._channel.call('checkCli')
			if (!cliStatus.installed) {
				this._setState({ cliStatus, isRefreshing: false, accounts: [] })
				return
			}
			const accounts: IGitHubAccount[] = await this._channel.call('listAccounts')
			this._setState({ cliStatus, accounts, isRefreshing: false })
			this._writeCache(accounts)
		} catch (e: any) {
			this._setState({ isRefreshing: false, lastError: e?.message ?? 'Failed to load GitHub accounts.' })
		}
	}

	startLogin(): void {
		if (this._state.login) return // already in progress
		const requestId = generateUuid()
		this._activeLoginRequestId = requestId
		this._setState({ login: { requestId, message: 'Starting GitHub authentication…' }, lastError: null })
		this._channel.call('login', { requestId }).catch((e: any) => {
			if (this._activeLoginRequestId !== requestId) return
			this._activeLoginRequestId = null
			this._setState({ login: null, lastError: e?.message ?? 'Failed to start GitHub authentication.' })
		})
	}

	cancelLogin(): void {
		const login = this._state.login
		if (!login) return
		this._channel.call('cancelLogin', { requestId: login.requestId }).catch(() => { })
	}

	async switchAccount(login: string): Promise<void> {
		if (this._state.switchingLogin) return
		this._setState({ switchingLogin: login, lastError: null })
		try {
			const accounts: IGitHubAccount[] = await this._channel.call('switchAccount', { login })
			this._setState({ accounts, switchingLogin: null })
			this._writeCache(accounts)
			const active = accounts.find(a => a.isActive)
			this._notificationService.info(active ? `Switched to GitHub account @${active.login}.` : `Switched GitHub account.`)
		} catch (e: any) {
			const message = e?.message ?? `Failed to switch to @${login}.`
			this._setState({ switchingLogin: null, lastError: message })
			this._notificationService.error(message)
		}
	}

	async removeAccount(login: string): Promise<void> {
		if (this._state.removingLogin) return
		this._setState({ removingLogin: login, lastError: null })
		try {
			const accounts: IGitHubAccount[] = await this._channel.call('removeAccount', { login })
			this._setState({ accounts, removingLogin: null })
			this._writeCache(accounts)
			this._notificationService.info(`Removed @${login} from JCode and signed it out of the GitHub CLI.`)
		} catch (e: any) {
			const message = e?.message ?? `Failed to remove @${login}.`
			this._setState({ removingLogin: null, lastError: message })
			this._notificationService.error(message)
		}
	}

	clearError(): void {
		this._setState({ lastError: null })
	}

	// ---------- login event handlers ----------

	private _onLoginProgress(e: EventGitHubLoginOnProgressParams): void {
		if (e.requestId !== this._activeLoginRequestId) return
		this._setState({ login: { requestId: e.requestId, message: e.message, code: e.code, verificationUri: e.verificationUri } })
	}

	private _onLoginSuccess(e: EventGitHubLoginOnSuccessParams): void {
		if (e.requestId !== this._activeLoginRequestId) return
		this._activeLoginRequestId = null
		const others = this._state.accounts.filter(a => a.login !== e.account.login).map(a => ({ ...a, isActive: false }))
		const accounts = [...others, e.account]
		this._setState({ login: null, accounts })
		this._writeCache(accounts)
		this._notificationService.info(`GitHub account @${e.account.login} connected to JCode.`)
	}

	private _onLoginError(e: EventGitHubLoginOnErrorParams): void {
		if (e.requestId !== this._activeLoginRequestId) return
		this._activeLoginRequestId = null
		this._setState({ login: null, lastError: e.cancelled ? null : e.message })
		if (!e.cancelled) this._notificationService.error(`GitHub authentication failed: ${e.message}`)
	}

	// ---------- persistence (metadata only - no tokens, gh owns those) ----------

	private _readCache(): CachedAccounts | null {
		const raw = this._storageService.get(GITHUB_ACCOUNTS_CACHE_STORAGE_KEY, StorageScope.APPLICATION)
		if (!raw) return null
		try {
			const parsed = JSON.parse(raw)
			return Array.isArray(parsed?.accounts) ? parsed : null
		} catch {
			return null
		}
	}

	private _writeCache(accounts: IGitHubAccount[]): void {
		const value: CachedAccounts = { accounts }
		this._storageService.store(GITHUB_ACCOUNTS_CACHE_STORAGE_KEY, JSON.stringify(value), StorageScope.APPLICATION, StorageTarget.MACHINE)
	}

	private _setState(partial: Partial<GitHubAccountsState>): void {
		this._state = { ...this._state, ...partial }
		this._onDidChangeState.fire()
	}
}

registerSingleton(IGitHubAccountService, GitHubAccountService, InstantiationType.Delayed)
