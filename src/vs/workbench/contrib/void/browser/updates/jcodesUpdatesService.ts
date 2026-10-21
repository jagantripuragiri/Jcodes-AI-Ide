// J Codes Updates — state for the Updates window and the status-bar badge (see updatesPane.ts / updatesStatusBar.ts).
// Fetches the latest GitHub releases once (through the main process) and compares them with the installed version.

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IVoidUpdateService } from '../../common/voidUpdateService.js';
import { isNewerVersion, JCodesRelease } from '../../common/voidUpdateServiceTypes.js';

export type JCodesUpdatesState = {
	status: 'idle' | 'checking' | 'ready' | 'error',
	currentVersion: string | null,
	releases: JCodesRelease[],
	latest: JCodesRelease | null,
	updateAvailable: boolean,
	checkedAt: string | null, // ISO time of the last successful check
}

export interface IJCodesUpdatesService {
	readonly _serviceBrand: undefined;
	readonly state: JCodesUpdatesState;
	readonly onDidChangeState: Event<void>;
	refresh(): Promise<void>;
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
		}
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
