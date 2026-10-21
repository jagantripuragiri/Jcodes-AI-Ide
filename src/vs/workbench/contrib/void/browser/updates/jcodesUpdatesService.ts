// J Codes Updates — state for the Updates window and the status-bar badge (see updatesPane.ts / updatesStatusBar.ts).
// Fetches the latest GitHub releases once (through the main process) and compares them with the installed version.

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IntervalTimer } from '../../../../../base/common/async.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IVoidUpdateService } from '../../common/voidUpdateService.js';
import { IDLE_JCODES_UPDATE_PROGRESS, isNewerVersion, JCodesRelease, JCodesUpdateProgress } from '../../common/voidUpdateServiceTypes.js';

export type JCodesUpdatesState = {
	status: 'idle' | 'checking' | 'ready' | 'error',
	currentVersion: string | null,
	releases: JCodesRelease[],
	latest: JCodesRelease | null,
	updateAvailable: boolean,
	checkedAt: string | null, // ISO time of the last successful check
	install: JCodesUpdateProgress, // progress of "Update now"
}

export interface IJCodesUpdatesService {
	readonly _serviceBrand: undefined;
	readonly state: JCodesUpdatesState;
	readonly onDidChangeState: Event<void>;
	refresh(): Promise<void>;
	startInstall(): Promise<void>; // "Update now": download + verify the latest release in the background
	cancelInstall(): Promise<void>;
	restartToUpdate(): Promise<void>; // once the download is ready: quit, install and reopen
}

export const IJCodesUpdatesService = createDecorator<IJCodesUpdatesService>('JCodesUpdatesService');

class JCodesUpdatesService extends Disposable implements IJCodesUpdatesService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = new Emitter<void>();
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event;

	private _state: JCodesUpdatesState
	get state() { return this._state }

	private _refreshPromise: Promise<void> | null = null

	constructor(
		@IVoidUpdateService private readonly _voidUpdateService: IVoidUpdateService,
		@IProductService productService: IProductService,
	) {
		super()
		this._state = {
			status: 'idle',
			currentVersion: productService.jcodesVersion ?? null,
			releases: [],
			latest: null,
			updateAvailable: false,
			checkedAt: null,
			install: IDLE_JCODES_UPDATE_PROGRESS,
		}
	}

	private readonly _installPoll = this._register(new IntervalTimer())

	async startInstall(): Promise<void> {
		const tag = this._state.latest?.tag
		if (!tag || !this._state.updateAvailable) return

		this._setState({ install: { ...IDLE_JCODES_UPDATE_PROGRESS, phase: 'downloading', tag } })
		await this._voidUpdateService.startUpdate(tag)
		// keep watching while the main process downloads in the background (_pollInstall stops this once it is done)
		this._installPoll.cancelAndSet(() => this._pollInstall(), 500)
		await this._pollInstall()
	}

	async cancelInstall(): Promise<void> {
		this._installPoll.cancel()
		await this._voidUpdateService.cancelUpdate()
		this._setState({ install: IDLE_JCODES_UPDATE_PROGRESS })
	}

	async restartToUpdate(): Promise<void> {
		await this._voidUpdateService.restartToInstall()
		await this._pollInstall()
	}

	private async _pollInstall(): Promise<void> {
		const install = await this._voidUpdateService.getUpdateProgress()
		this._setState({ install })
		if (install.phase !== 'downloading' && install.phase !== 'preparing') this._installPoll.cancel()
	}

	refresh(): Promise<void> {
		// don't start a second request while one is in flight
		if (!this._refreshPromise) {
			this._refreshPromise = this._refresh().finally(() => { this._refreshPromise = null })
		}
		return this._refreshPromise
	}

	private async _refresh(): Promise<void> {
		this._setState({ status: 'checking' })

		const releases = await this._voidUpdateService.getRecentReleases()
		if (!releases) {
			this._setState({ status: 'error' })
			return
		}

		const latest = releases.find(r => !r.isPrerelease) ?? releases[0] ?? null
		const { currentVersion } = this._state
		const updateAvailable = !!latest && !!currentVersion && isNewerVersion(latest.tag, currentVersion)

		this._setState({ status: 'ready', releases, latest, updateAvailable, checkedAt: new Date().toISOString() })
	}

	private _setState(partial: Partial<JCodesUpdatesState>) {
		this._state = { ...this._state, ...partial }
		this._onDidChangeState.fire()
	}
}

registerSingleton(IJCodesUpdatesService, JCodesUpdatesService, InstantiationType.Delayed);
