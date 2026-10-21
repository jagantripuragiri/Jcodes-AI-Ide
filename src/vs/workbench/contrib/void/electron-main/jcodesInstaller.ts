// J Codes self-updater (main process). Downloads the release file for this computer from GitHub, checks it against
// GitHub's SHA-256, and installs it when the user clicks "Restart to update":
//  - macOS:   unzips the new app next to the installed one, then a small script waits for J Codes to quit, swaps the two
//             and reopens it (the old app is kept as a backup until the swap worked, and put back if it didn't)
//  - Windows: a small script waits for J Codes to quit, then runs the release's own installer silently (it upgrades J Codes
//             in place and starts it again)
//  - others:  not supported, the UI sends people to the downloads page instead

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { ChildProcess, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { IDLE_JCODES_UPDATE_PROGRESS, JCodesReleaseAsset, JCodesUpdateProgress } from '../common/voidUpdateServiceTypes.js';

const execFileAsync = promisify(execFile)

// an error whose message is safe to show to the user as is
class InstallError extends Error { }

// the release file this computer can install by itself, or null (eg Linux or an Intel Mac)
export const pickInstallableAsset = (assets: JCodesReleaseAsset[]): JCodesReleaseAsset | null => {
	if (process.platform === 'darwin' && process.arch === 'arm64') return assets.find(a => /darwin-arm64.*\.zip$/i.test(a.name)) ?? null
	if (process.platform === 'win32' && process.arch === 'x64') return assets.find(a => /UserSetup-x64\.exe$/i.test(a.name)) ?? null
	return null
}

// $1 = pid of the running J Codes, $2 = the new app, $3 = the installed app, $4 = the staging folder
const MAC_SWAP_SCRIPT = `#!/bin/sh
PID="$1"; NEW="$2"; TARGET="$3"; STAGE="$4"
BACKUP="$TARGET.update-backup"

# wait (up to 60s) for J Codes to quit
i=0
while kill -0 "$PID" 2>/dev/null && [ "$i" -lt 120 ]; do sleep 0.5; i=$((i+1)); done
if kill -0 "$PID" 2>/dev/null; then exit 1; fi

rm -rf "$BACKUP"
if mv "$TARGET" "$BACKUP"; then
	if mv "$NEW" "$TARGET"; then
		xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null
		rm -rf "$BACKUP" "$STAGE"
	else
		# the swap failed: put the old version back
		rm -rf "$TARGET"
		mv "$BACKUP" "$TARGET"
	fi
fi
open "$TARGET"

# the downloaded zip (and this script) are no longer needed
rm -rf "$(dirname "$0")"
`

// -ProcessId = pid of the running J Codes, -Installer = the downloaded setup .exe
// (the installer refuses to run while J Codes is still open, so it has to wait for it to quit first)
const WINDOWS_INSTALL_SCRIPT = `param([int]$ProcessId, [string]$Installer)

# wait (up to 60s) for J Codes to quit
try { Wait-Process -Id $ProcessId -Timeout 60 -ErrorAction Stop } catch { }
if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) { exit 1 }

Start-Process -FilePath $Installer -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CLOSEAPPLICATIONS' -Wait

# the downloaded installer (and this script) are no longer needed
Remove-Item -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path) -Recurse -Force -ErrorAction SilentlyContinue
`

export class JCodesInstaller {

	private _progress: JCodesUpdateProgress = IDLE_JCODES_UPDATE_PROGRESS
	get progress(): JCodesUpdateProgress { return this._progress }

	private _abort: AbortController | null = null
	private _workDir = path.join(os.tmpdir(), 'jcodes-update')

	// what is ready to be installed once the user restarts
	private _prepared: { newApp: string, targetApp: string, stageDir: string } | { installer: string } | null = null

	private _isBusy() { return this._progress.phase === 'downloading' || this._progress.phase === 'preparing' || this._progress.phase === 'installing' }

	private _set(partial: Partial<JCodesUpdateProgress>) {
		this._progress = { ...this._progress, ...partial }
	}

	fail(message: string) {
		this._set({ phase: 'error', error: message })
	}

	// downloads + verifies + prepares the update (call without awaiting - watch .progress instead)
	async start(tag: string, asset: JCodesReleaseAsset): Promise<void> {
		if (this._isBusy()) return

		this._abort = new AbortController()
		this._progress = { phase: 'downloading', tag, receivedBytes: 0, totalBytes: asset.sizeBytes, error: null }

		try {
			if (!asset.sha256) throw new InstallError(`GitHub has no checksum for this download, so it can't be verified. Please download it manually.`)

			await fs.promises.rm(this._workDir, { recursive: true, force: true })
			await fs.promises.mkdir(this._workDir, { recursive: true })

			const filePath = path.join(this._workDir, path.basename(asset.name))
			await this._download(asset, filePath, this._abort.signal)

			this._set({ phase: 'preparing' })
			this._prepared = process.platform === 'darwin' ? await this._stageMacApp(filePath) : { installer: filePath }

			this._set({ phase: 'ready' })
		}
		catch (e) {
			await this._cleanup()
			if (this._abort?.signal.aborted) {
				this._progress = IDLE_JCODES_UPDATE_PROGRESS
			} else {
				this.fail(e instanceof InstallError ? e.message : `The update could not be downloaded: ${e}`)
			}
		}
	}

	async cancel(): Promise<void> {
		if (this._progress.phase === 'installing') return
		this._abort?.abort()
		await this._cleanup()
		this._progress = IDLE_JCODES_UPDATE_PROGRESS
	}

	// starts the install, then quits J Codes (the installer / swap script carries on without it)
	async restartAndInstall(quit: () => Promise<boolean /* veto */>): Promise<void> {
		const prepared = this._prepared
		if (this._progress.phase !== 'ready' || !prepared) return

		this._set({ phase: 'installing' })
		try {
			let child: ChildProcess
			if ('installer' in prepared) {
				const scriptPath = path.join(this._workDir, 'install.ps1')
				await fs.promises.writeFile(scriptPath, WINDOWS_INSTALL_SCRIPT)
				child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath, '-ProcessId', String(process.pid), '-Installer', prepared.installer], { detached: true, stdio: 'ignore', windowsHide: true })
			} else {
				const scriptPath = path.join(this._workDir, 'install.sh')
				await fs.promises.writeFile(scriptPath, MAC_SWAP_SCRIPT, { mode: 0o755 })
				child = spawn('/bin/sh', [scriptPath, String(process.pid), prepared.newApp, prepared.targetApp, prepared.stageDir], { detached: true, stdio: 'ignore' })
			}
			child.unref()

			const veto = await quit()
			if (veto) {
				// J Codes didn't quit (eg the user cancelled), so don't let the installer run behind their back
				child.kill()
				this._set({ phase: 'ready' })
			}
		}
		catch (e) {
			this.fail(`The update could not be installed: ${e}`)
		}
	}

	private async _download(asset: JCodesReleaseAsset, filePath: string, signal: AbortSignal): Promise<void> {
		const response = await fetch(asset.url, { signal })
		if (!response.ok || !response.body) throw new InstallError(`GitHub didn't send the download (error ${response.status}). Please try again later.`)

		const contentLength = Number(response.headers.get('content-length'))
		if (contentLength) this._set({ totalBytes: contentLength })

		const hash = createHash('sha256')
		const out = fs.createWriteStream(filePath)
		const streamErrors: Error[] = []
		out.on('error', e => { streamErrors.push(e) })

		const reader = response.body.getReader()
		let received = 0
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			if (streamErrors.length) throw streamErrors[0]
			hash.update(value)
			if (!out.write(value)) await new Promise<void>(resolve => out.once('drain', () => resolve()))
			received += value.byteLength
			this._set({ receivedBytes: received })
		}
		await new Promise<void>((resolve, reject) => { out.once('error', reject); out.end(() => resolve()) })

		if (hash.digest('hex') !== asset.sha256?.toLowerCase()) {
			throw new InstallError(`The download didn't match its checksum, so it was thrown away. Please try again or download it manually.`)
		}
	}

	// unzips the new app into a hidden folder next to the installed one (same disk, so the later swap is instant)
	private async _stageMacApp(zipPath: string): Promise<{ newApp: string, targetApp: string, stageDir: string }> {
		const targetApp = path.resolve(process.execPath, '..', '..', '..')
		if (!targetApp.endsWith('.app')) throw new InstallError(`J Codes isn't running from an app bundle, so it can't update itself. Please download it manually.`)
		if (targetApp.includes('/AppTranslocation/')) throw new InstallError(`Please move J Codes into your Applications folder first, then update.`)

		const parentDir = path.dirname(targetApp)
		try { await fs.promises.access(parentDir, fs.constants.W_OK) }
		catch { throw new InstallError(`J Codes can't change files in ${parentDir}. Please download the update manually.`) }

		const stageDir = path.join(parentDir, `.jcodes-update-${process.pid}`)
		await fs.promises.rm(stageDir, { recursive: true, force: true })
		await fs.promises.mkdir(stageDir)

		try {
			await execFileAsync('/usr/bin/ditto', ['-x', '-k', zipPath, stageDir])

			const apps = (await fs.promises.readdir(stageDir)).filter(name => name.endsWith('.app'))
			if (apps.length !== 1) throw new InstallError(`The downloaded update didn't contain the app as expected. Please download it manually.`)

			const newApp = path.join(stageDir, apps[0])
			try { await fs.promises.access(path.join(newApp, 'Contents', 'Info.plist')) }
			catch { throw new InstallError(`The downloaded update looks incomplete. Please download it manually.`) }

			return { newApp, targetApp, stageDir }
		}
		catch (e) {
			// don't leave a half-unpacked app lying around next to the real one
			await fs.promises.rm(stageDir, { recursive: true, force: true })
			throw e
		}
	}

	private async _cleanup(): Promise<void> {
		const prepared = this._prepared
		this._prepared = null
		try {
			if (prepared && 'stageDir' in prepared) await fs.promises.rm(prepared.stageDir, { recursive: true, force: true })
			await fs.promises.rm(this._workDir, { recursive: true, force: true })
		} catch { }
	}
}
