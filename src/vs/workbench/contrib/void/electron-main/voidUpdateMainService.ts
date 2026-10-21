import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { IVoidUpdateService } from '../common/voidUpdateService.js';
import { isNewerVersion, JCODES_DOWNLOADS_URL, JCODES_GITHUB_URL, JCODES_LATEST_RELEASE_API_URL, JCODES_RECENT_RELEASES_API_URL, JCodesRelease, VoidCheckUpdateRespose } from '../common/voidUpdateServiceTypes.js';

type GitHubReleaseJSON = {
	tag_name?: string,
	name?: string | null,
	published_at?: string | null,
	body?: string | null,
	html_url?: string,
	draft?: boolean,
	prerelease?: boolean,
	assets?: { name?: string, browser_download_url?: string, size?: number }[],
}

// only ever hand the UI links that point at our own repo
const isOwnRepoUrl = (url: string | undefined): url is string => !!url && url.startsWith(JCODES_GITHUB_URL)



export class VoidMainUpdateService extends Disposable implements IVoidUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
	) {
		super()
	}


	async check(explicit: boolean): Promise<VoidCheckUpdateRespose> {

		const isDevMode = !this._envMainService.isBuilt // found in abstractUpdateService.ts

		if (isDevMode) {
			return { message: null } as const
		}

		// if disabled and not explicitly checking, return early
		if (this._updateService.state.type === StateType.Disabled) {
			if (!explicit)
				return { message: null } as const
		}

		this._updateService.checkForUpdates(false) // implicity check, then handle result ourselves

		console.log('updateState', this._updateService.state)

		if (this._updateService.state.type === StateType.Uninitialized) {
			// The update service hasn't been initialized yet
			return { message: explicit ? 'Checking for updates soon...' : null, action: explicit ? 'reinstall' : undefined } as const
		}

		if (this._updateService.state.type === StateType.Idle) {
			// No updates currently available
			return { message: explicit ? 'No updates found!' : null, action: explicit ? 'reinstall' : undefined } as const
		}

		if (this._updateService.state.type === StateType.CheckingForUpdates) {
			// Currently checking for updates
			return { message: explicit ? 'Checking for updates...' : null } as const
		}

		if (this._updateService.state.type === StateType.AvailableForDownload) {
			// Update available but requires manual download (mainly for Linux)
			return { message: 'A new update is available!', action: 'download', } as const
		}

		if (this._updateService.state.type === StateType.Downloading) {
			// Update is currently being downloaded
			return { message: explicit ? 'Currently downloading update...' : null } as const
		}

		if (this._updateService.state.type === StateType.Downloaded) {
			// Update has been downloaded but not yet ready
			return { message: explicit ? 'An update is ready to be applied!' : null, action: 'apply' } as const
		}

		if (this._updateService.state.type === StateType.Updating) {
			// Update is being applied
			return { message: explicit ? 'Applying update...' : null } as const
		}

		if (this._updateService.state.type === StateType.Ready) {
			// Update is ready
			return { message: 'Restart J Codes to update!', action: 'restart' } as const
		}

		if (this._updateService.state.type === StateType.Disabled) {
			return await this._manualCheckGHTagIfDisabled(explicit)
		}
		return null
	}






	// the latest few GitHub releases (newest first), for the Updates window. Returns null if they couldn't be fetched
	async getRecentReleases(): Promise<JCodesRelease[] | null> {
		try {
			const response = await fetch(JCODES_RECENT_RELEASES_API_URL)
			if (!response.ok) return null

			const data: GitHubReleaseJSON[] = await response.json()
			if (!Array.isArray(data)) return null

			return data
				.filter(r => !r.draft && r.tag_name)
				.map(r => ({
					tag: r.tag_name ?? '',
					name: r.name || r.tag_name || '',
					publishedAt: r.published_at ?? null,
					notes: r.body ?? '',
					url: isOwnRepoUrl(r.html_url) ? r.html_url : JCODES_DOWNLOADS_URL,
					isPrerelease: !!r.prerelease,
					assets: (r.assets ?? [])
						.filter(a => a.name && isOwnRepoUrl(a.browser_download_url))
						.map(a => ({ name: a.name ?? '', url: a.browser_download_url ?? '', sizeBytes: a.size ?? 0 })),
				}))
		}
		catch (e) {
			return null
		}
	}

	private async _manualCheckGHTagIfDisabled(explicit: boolean): Promise<VoidCheckUpdateRespose> {
		try {
			const response = await fetch(JCODES_LATEST_RELEASE_API_URL);

			const data = await response.json();
			const version = data.tag_name;

			const myVersion = this._productService.jcodesVersion
			const latestVersion = version

			// if we can't tell what the versions are, don't nag the user (only makes sense if response.ok)
			const isUpToDate = !myVersion || typeof latestVersion !== 'string' || !isNewerVersion(latestVersion, myVersion)

			let message: string | null
			let action: 'reinstall' | undefined

			// explicit
			if (explicit) {
				if (response.ok) {
					if (!isUpToDate) {
						message = 'A new version of J Codes is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!'
						action = 'reinstall'
					}
					else {
						message = 'J Codes is up-to-date!'
					}
				}
				else {
					message = `An error occurred when fetching the latest GitHub release tag. Please try again in ~5 minutes, or reinstall.`
					action = 'reinstall'
				}
			}
			// not explicit
			else {
				if (response.ok && !isUpToDate) {
					message = 'A new version of J Codes is available! Please reinstall (auto-updates are disabled on this OS) - it only takes a second!'
					action = 'reinstall'
				}
				else {
					message = null
				}
			}
			return { message, action } as const
		}
		catch (e) {
			if (explicit) {
				return {
					message: `An error occurred when fetching the latest GitHub release tag: ${e}. Please try again in ~5 minutes.`,
					action: 'reinstall',
				}
			}
			else {
				return { message: null } as const
			}
		}
	}
}
