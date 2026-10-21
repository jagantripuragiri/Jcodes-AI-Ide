import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { IVoidUpdateService } from '../common/voidUpdateService.js';
import { ILifecycleMainService } from '../../../../platform/lifecycle/electron-main/lifecycleMainService.js';
import { isNewerVersion, JCODES_DOWNLOADS_URL, JCODES_GITHUB_URL, JCODES_LATEST_RELEASE_API_URL, JCODES_RECENT_RELEASES_API_URL, JCODES_RELEASE_BY_TAG_API_URL, JCodesRelease, JCodesUpdateProgress, VoidCheckUpdateRespose } from '../common/voidUpdateServiceTypes.js';
import { JCodesInstaller, pickInstallableAsset } from './jcodesInstaller.js';

type GitHubReleaseJSON = {
	tag_name?: string,
	name?: string | null,
	published_at?: string | null,
	body?: string | null,
	html_url?: string,
	draft?: boolean,
	prerelease?: boolean,
	assets?: { name?: string, browser_download_url?: string, size?: number, digest?: string | null }[],
}

// only ever hand the UI links that point at our own repo
const isOwnRepoUrl = (url: string | undefined): url is string => !!url && url.startsWith(JCODES_GITHUB_URL)

const releaseOfGitHubJSON = (r: GitHubReleaseJSON): JCodesRelease => ({
	tag: r.tag_name ?? '',
	name: r.name || r.tag_name || '',
	publishedAt: r.published_at ?? null,
	notes: r.body ?? '',
	url: isOwnRepoUrl(r.html_url) ? r.html_url : JCODES_DOWNLOADS_URL,
	isPrerelease: !!r.prerelease,
	assets: (r.assets ?? [])
		.filter(a => a.name && isOwnRepoUrl(a.browser_download_url))
		.map(a => ({
			name: a.name ?? '',
			url: a.browser_download_url ?? '',
			sizeBytes: a.size ?? 0,
			sha256: a.digest?.startsWith('sha256:') ? a.digest.slice('sha256:'.length) : null,
		})),
})



export class VoidMainUpdateService extends Disposable implements IVoidUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
		@ILifecycleMainService private readonly _lifecycleMainService: ILifecycleMainService,
	) {
		super()
	}

	private readonly _installer = new JCodesInstaller()


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
				.map(releaseOfGitHubJSON)
		}
		catch (e) {
			return null
		}
	}

	// ---- "Update now" ----

	async startUpdate(tag: string): Promise<void> {
		if (!this._envMainService.isBuilt) return this._installer.fail(`Updating only works in the installed app, not in a development build.`)
		if (!/^[\w.\-]{1,64}$/.test(tag)) return this._installer.fail(`That isn't a valid version.`)

		// never trust the UI for what to download: look the release up again and only allow a newer version
		const myVersion = this._productService.jcodesVersion
		if (myVersion && !isNewerVersion(tag, myVersion)) return this._installer.fail(`You already have this version or a newer one.`)

		let release: JCodesRelease
		try {
			const response = await fetch(JCODES_RELEASE_BY_TAG_API_URL + encodeURIComponent(tag))
			if (!response.ok) return this._installer.fail(`Couldn't find that release on GitHub (error ${response.status}). Please try again later.`)
			const data: GitHubReleaseJSON = await response.json()
			release = releaseOfGitHubJSON(data)
		}
		catch (e) {
			return this._installer.fail(`Couldn't reach GitHub. Check your internet connection and try again.`)
		}

		const asset = pickInstallableAsset(release.assets)
		if (!asset) return this._installer.fail(`J Codes can't update itself on this computer yet. Please download the update from GitHub.`)

		this._installer.start(tag, asset) // runs in the background - the UI watches getUpdateProgress()
	}

	async getUpdateProgress(): Promise<JCodesUpdateProgress> {
		return this._installer.progress
	}

	async cancelUpdate(): Promise<void> {
		await this._installer.cancel()
	}

	async restartToInstall(): Promise<void> {
		await this._installer.restartAndInstall(() => this._lifecycleMainService.quit(true))
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
