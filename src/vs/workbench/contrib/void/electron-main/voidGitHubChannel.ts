// registered in app.ts as 'void-channel-github' (same convention as sendLLMMessageChannel.ts: a
// hand-rolled IServerChannel, not a plain ProxyChannel.fromService, because `login` streams
// progress/success/error events keyed by requestId instead of returning a single Promise).
//
// This is the only place JCode shells out to the `gh` CLI. It never stores or logs GitHub tokens -
// `gh` owns its own token storage (OS keychain / gh's own encrypted config), we only ever ask it
// "who's logged in" and "switch to this login", and we use execFile (argv arrays, no shell) so
// account names never pass through a shell.

import { execFile as _execFile, spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
	IGitHubAccount, GitHubCliStatus, MainGitHubLoginParams, MainGitHubLoginAbortParams,
	EventGitHubLoginOnProgressParams, EventGitHubLoginOnSuccessParams, EventGitHubLoginOnErrorParams,
	MainGitHubSwitchAccountParams, MainGitHubRemoveAccountParams,
} from '../common/voidGitHubTypes.js';
import { parseGhVersion, parseGhAuthStatus, parseLoginProgress, looksLikeUserCancelledLogin } from '../common/voidGitHubParsing.js';

const execFile = promisify(_execFile)

// GUI apps launched from Finder/Dock/Spotlight (as opposed to a terminal) inherit macOS's minimal
// default PATH, not the one set up by the user's shell profile - so Homebrew's `gh` (typically at
// /opt/homebrew/bin or /usr/local/bin) can be invisible to us even though it's on PATH in a terminal.
// Widen PATH with the common install locations before spawning `gh` so this doesn't get misreported
// as "not installed".
const GH_EXTRA_PATH_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin']
function ghEnv(): NodeJS.ProcessEnv {
	const existing = (process.env.PATH ?? '').split(':')
	const merged = [...existing, ...GH_EXTRA_PATH_DIRS.filter(d => !existing.includes(d))]
	return { ...process.env, PATH: merged.join(':') }
}

const GH_HOSTNAME = 'github.com'
// GitHub's device codes are typically valid for ~15 minutes; this is a backstop so a browser tab the
// user never returns to doesn't leave JCode waiting forever.
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

async function fetchPublicProfile(login: string): Promise<{ name: string | null; avatarUrl: string | null }> {
	// unauthenticated, public GitHub REST endpoint - lets us show a name/avatar per account without ever
	// touching that account's token (gh doesn't expose other accounts' tokens to us, only the active one).
	try {
		const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
			headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'JCode' },
		})
		if (!res.ok) return { name: null, avatarUrl: null }
		const json = await res.json() as { name?: string; avatar_url?: string }
		return { name: json.name ?? null, avatarUrl: json.avatar_url ?? null }
	} catch {
		return { name: null, avatarUrl: null }
	}
}

export class GitHubChannel implements IServerChannel {

	private readonly _loginEmitters = {
		onProgress: new Emitter<EventGitHubLoginOnProgressParams>(),
		onSuccess: new Emitter<EventGitHubLoginOnSuccessParams>(),
		onError: new Emitter<EventGitHubLoginOnErrorParams>(),
	}

	private readonly _runningLogins: Record<string, { proc: ChildProcessWithoutNullStreams; timeout: ReturnType<typeof setTimeout> }> = {}

	listen(_: unknown, event: string): Event<any> {
		if (event === 'onProgress_login') return this._loginEmitters.onProgress.event
		if (event === 'onSuccess_login') return this._loginEmitters.onSuccess.event
		if (event === 'onError_login') return this._loginEmitters.onError.event
		throw new Error(`GitHubChannel: event not found: ${event}`)
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		if (command === 'checkCli') return this._checkCli()
		if (command === 'listAccounts') return this._listAccountsWithProfiles()
		if (command === 'switchAccount') return this._switchAccount(params as MainGitHubSwitchAccountParams)
		if (command === 'removeAccount') return this._removeAccount(params as MainGitHubRemoveAccountParams)
		if (command === 'login') { this._startLogin(params as MainGitHubLoginParams); return }
		if (command === 'cancelLogin') { this._cancelLogin(params as MainGitHubLoginAbortParams); return }
		throw new Error(`GitHubChannel: command not recognized: ${command}`)
	}

	// ---------- simple request/response commands ----------

	private async _checkCli(): Promise<GitHubCliStatus> {
		try {
			const { stdout } = await execFile('gh', ['--version'], { env: ghEnv() })
			return { installed: true, version: parseGhVersion(stdout) ?? 'unknown' }
		} catch {
			return { installed: false }
		}
	}

	private async _listAccounts(): Promise<{ login: string; isActive: boolean }[]> {
		try {
			const { stdout, stderr } = await execFile('gh', ['auth', 'status', '--hostname', GH_HOSTNAME], { env: ghEnv() })
			return parseGhAuthStatus(`${stdout}\n${stderr}`)
		} catch (e: any) {
			// `gh auth status` exits non-zero when nobody's logged in to this host - it still writes the
			// (empty) status text to stdout/stderr, so treat that as data rather than a real failure.
			if (typeof e?.stdout === 'string' || typeof e?.stderr === 'string') {
				return parseGhAuthStatus(`${e.stdout ?? ''}\n${e.stderr ?? ''}`)
			}
			return []
		}
	}

	private async _listAccountsWithProfiles(): Promise<IGitHubAccount[]> {
		const bare = await this._listAccounts()
		const profiles = await Promise.all(bare.map(a => fetchPublicProfile(a.login)))
		return bare.map((a, i) => ({ login: a.login, isActive: a.isActive, name: profiles[i].name, avatarUrl: profiles[i].avatarUrl }))
	}

	private async _switchAccount(params: MainGitHubSwitchAccountParams): Promise<IGitHubAccount[]> {
		await execFile('gh', ['auth', 'switch', '--hostname', GH_HOSTNAME, '--user', params.login], { env: ghEnv() })
		// always re-derive from gh's real state rather than assuming the switch call did what we asked
		return this._listAccountsWithProfiles()
	}

	private async _removeAccount(params: MainGitHubRemoveAccountParams): Promise<IGitHubAccount[]> {
		await execFile('gh', ['auth', 'logout', '--hostname', GH_HOSTNAME, '--user', params.login], { env: ghEnv() })
		return this._listAccountsWithProfiles()
	}

	// ---------- login (streamed) ----------

	private _startLogin(params: MainGitHubLoginParams): void {
		const { requestId } = params
		if (requestId in this._runningLogins) return

		this._loginEmitters.onProgress.fire({ requestId, message: 'Starting GitHub authentication…' })

		let proc: ChildProcessWithoutNullStreams
		try {
			proc = spawn('gh', ['auth', 'login', '--hostname', GH_HOSTNAME, '--git-protocol', 'https', '--web'], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: ghEnv(),
			})
		} catch (err: any) {
			this._loginEmitters.onError.fire({ requestId, message: `Failed to start GitHub authentication: ${err?.message ?? err}`, cancelled: false })
			return
		}

		let buffer = ''
		let codeSent = false

		const onChunk = (data: Buffer) => {
			const text = data.toString('utf8')
			buffer += text
			if (!codeSent) {
				const progress = parseLoginProgress(buffer)
				if (progress?.code) {
					codeSent = true
					this._loginEmitters.onProgress.fire({ requestId, message: 'Waiting for you to finish in your browser…', ...progress })
				}
			}
		}

		proc.stdout.on('data', onChunk)
		proc.stderr.on('data', onChunk)
		proc.stdin.on('error', () => { /* stdin can close before we write if gh exits immediately (eg not installed) */ })
		// gh's interactive "Press Enter to open browser" prompt only appears on a real TTY; sending a
		// newline is a harmless no-op when it's not needed and unblocks it when it is.
		try { proc.stdin.write('\n') } catch { /* ignore, see stdin 'error' handler above */ }

		const timeout = setTimeout(() => this._finishLogin(requestId, 'timeout'), LOGIN_TIMEOUT_MS)
		this._runningLogins[requestId] = { proc, timeout }

		proc.on('close', async (code) => {
			if (!(requestId in this._runningLogins)) return // already cancelled/timed out
			clearTimeout(timeout)
			delete this._runningLogins[requestId]

			if (code === 0) {
				// don't trust stdout text as proof of success - re-verify against gh's real auth state
				const accounts = await this._listAccountsWithProfiles()
				const active = accounts.find(a => a.isActive) ?? accounts[accounts.length - 1]
				if (active) {
					this._loginEmitters.onSuccess.fire({ requestId, account: active })
				} else {
					this._loginEmitters.onError.fire({ requestId, message: 'gh reported success but no authenticated account was found.', cancelled: false })
				}
			} else {
				const cancelled = looksLikeUserCancelledLogin(buffer)
				const lastLine = buffer.trim().split('\n').filter(Boolean).pop()
				this._loginEmitters.onError.fire({
					requestId,
					message: cancelled ? 'Authentication was cancelled.' : (lastLine || 'GitHub authentication failed.'),
					cancelled,
				})
			}
		})

		proc.on('error', (err: NodeJS.ErrnoException) => {
			if (!(requestId in this._runningLogins)) return
			clearTimeout(timeout)
			delete this._runningLogins[requestId]
			const message = err.code === 'ENOENT'
				? 'GitHub CLI (gh) is not installed or not on PATH.'
				: `Failed to run GitHub authentication: ${err.message}`
			this._loginEmitters.onError.fire({ requestId, message, cancelled: false })
		})
	}

	private _cancelLogin(params: MainGitHubLoginAbortParams): void {
		this._finishLogin(params.requestId, 'cancel')
	}

	private _finishLogin(requestId: string, reason: 'cancel' | 'timeout'): void {
		const running = this._runningLogins[requestId]
		if (!running) return
		clearTimeout(running.timeout)
		delete this._runningLogins[requestId]
		running.proc.kill()
		this._loginEmitters.onError.fire({
			requestId,
			message: reason === 'timeout' ? 'GitHub authentication timed out.' : 'Authentication was cancelled.',
			cancelled: true,
		})
	}
}
