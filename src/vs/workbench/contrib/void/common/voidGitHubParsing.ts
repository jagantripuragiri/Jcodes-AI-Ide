// Pure text-parsing helpers for the `gh` CLI's human-readable output.
// Kept dependency-free (no child_process/electron imports) so they're easy to unit test and so a future
// `gh --json`-capable command can replace the regexes here without touching the IPC/process-management code
// in voidGitHubChannel.ts. See rule of thumb in that file: prefer structured output, fall back to parsing.

const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_ESCAPE_RE, '')

/**
 * Parses `gh --version` output, eg:
 *   gh version 2.45.0 (2024-03-04)
 * Returns null if the version can't be found (still lets callers treat the CLI as "installed", just with an unknown version).
 */
export function parseGhVersion(stdout: string): string | null {
	const match = stripAnsi(stdout).match(/gh version\s+([^\s]+)/i)
	return match ? match[1] : null
}

export interface ParsedGhAccount {
	login: string
	isActive: boolean
}

/**
 * Parses `gh auth status` output for the github.com host specifically (JCode manages github.com accounts;
 * GitHub Enterprise hosts are out of scope for this feature). Typical output looks like:
 *
 *   github.com
 *     ✓ Logged in to github.com account octocat (keyring)
 *     - Active account: true
 *     - Git operations protocol: https
 *     - Token: gho_************************************
 *
 *     ✓ Logged in to github.com account monalisa (keyring)
 *     - Active account: false
 *     ...
 *
 * Resilient to: extra/missing indentation, the "(keyring)"/"(oauth_token)" suffix varying, and additional
 * "- ..." detail lines we don't care about (git protocol, token scopes, etc). Not resilient to a wholesale
 * rename of "Logged in to" / "Active account:" - if `gh` ever changes those phrases, this needs an update.
 */
export function parseGhAuthStatus(output: string): ParsedGhAccount[] {
	const lines = stripAnsi(output).split('\n')
	const accounts: ParsedGhAccount[] = []

	let inGithubDotComSection = false
	let current: ParsedGhAccount | null = null

	const flush = () => {
		if (current) accounts.push(current)
		current = null
	}

	for (const rawLine of lines) {
		const line = rawLine.trim()
		if (line.length === 0) continue

		// a host header is a bare hostname with no leading indentation in the raw line, eg "github.com"
		const isHostHeader = rawLine.length > 0 && !/^\s/.test(rawLine) && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(line)
		if (isHostHeader) {
			flush()
			inGithubDotComSection = line.toLowerCase() === 'github.com'
			continue
		}

		if (!inGithubDotComSection) continue

		const loginMatch = line.match(/Logged in to\s+\S+\s+account\s+([^\s]+)/i)
		if (loginMatch) {
			flush()
			current = { login: loginMatch[1], isActive: false }
			continue
		}

		const activeMatch = line.match(/Active account:\s*(true|false)/i)
		if (activeMatch && current) {
			current.isActive = activeMatch[1].toLowerCase() === 'true'
			continue
		}
	}
	flush()

	return accounts
}

export interface ParsedLoginProgress {
	code?: string
	verificationUri?: string
}

/**
 * Scans a chunk of `gh auth login --web` output for the one-time device code it prints before opening
 * the browser, eg:
 *   ! First copy your one-time code: ABCD-1234
 *   Press Enter to open github.com in your browser...
 */
export function parseLoginProgress(chunk: string): ParsedLoginProgress | null {
	const clean = stripAnsi(chunk)
	const codeMatch = clean.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i)
	if (!codeMatch) return null
	return { code: codeMatch[1], verificationUri: 'https://github.com/login/device' }
}

/**
 * Best-effort extraction of the username `gh auth login` just authenticated, eg "✓ Logged in as octocat".
 * Only used as a hint - the caller always re-verifies via `gh auth status` after the process exits
 * successfully (see rule #8/#15: never trust a single string match as proof of the real auth state).
 */
export function parseLoginUsername(output: string): string | null {
	const match = stripAnsi(output).match(/Logged in as\s+([^\s]+)/i)
	return match ? match[1] : null
}

/** True if gh's output indicates the user backed out of the login flow rather than hitting a real error. */
export function looksLikeUserCancelledLogin(output: string): boolean {
	const clean = stripAnsi(output).toLowerCase()
	return clean.includes('cancelled') || clean.includes('canceled') || clean.includes('interrupt')
}
