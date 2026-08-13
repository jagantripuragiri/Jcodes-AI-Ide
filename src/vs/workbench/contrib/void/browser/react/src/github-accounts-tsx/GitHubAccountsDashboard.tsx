import '../styles.css'
import React, { useCallback, useEffect, useState } from 'react'
import {
	Github, Plus, RefreshCw, Check, MoreVertical, Copy, ExternalLink, Loader2, AlertCircle,
	LogOut, ArrowLeftRight, Terminal, X, ShieldCheck, Users,
} from 'lucide-react'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { useAccessor, useGitHubAccountsState, useIsDark } from '../util/services.js'
import { Card, SectionHeading, EmptyState, Badge, Tone, toneTextClass } from '../project-brain-tsx/shared.js'
import { VoidButtonBgDarken } from '../util/inputs.js'
import { isMacintosh, isWindows } from '../../../../../../../base/common/platform.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { IGitHubAccount, GitHubCliStatus } from '../../../../common/voidGitHubTypes.js'

// ============================================================================
// install instructions — cross-platform, no assumption about which browser/shell is default (see rule:
// don't hardcode a single OS's install story)
// ============================================================================

const INSTALL_INSTRUCTIONS = isMacintosh
	? { label: 'macOS (Homebrew)', command: 'brew install gh' }
	: isWindows
		? { label: 'Windows (winget)', command: 'winget install --id GitHub.cli' }
		: { label: 'Linux', command: 'See github.com/cli/cli/blob/trunk/docs/install_linux.md for your distro' }

const CLI_DOCS_URI = URI.parse('https://cli.github.com/')
const githubProfileUri = (login: string) => URI.parse(`https://github.com/${login}`)

// ============================================================================
// small building blocks
// ============================================================================

const Avatar = ({ account, size = 36 }: { account: IGitHubAccount, size?: number }) => {
	if (account.avatarUrl) {
		return <img
			src={account.avatarUrl}
			alt=''
			width={size}
			height={size}
			className='rounded-full shrink-0 bg-void-bg-2 border border-void-border-2'
			style={{ width: size, height: size }}
		/>
	}
	return <span
		className='rounded-full shrink-0 bg-void-bg-2 border border-void-border-2 flex items-center justify-center text-void-fg-3'
		style={{ width: size, height: size }}
	>
		<Github className='size-4' />
	</span>
}

const IconButton = ({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean }) => (
	<button
		onClick={onClick}
		disabled={disabled}
		aria-label={label}
		title={label}
		className='flex items-center justify-center size-7 rounded-md text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-2-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
	>
		{icon}
	</button>
)

// a compact info tile for the status row (GitHub CLI / readiness / account count) — string-valued,
// unlike shared.tsx's numeric StatTile, and only ever fed real fields from GitHubAccountsState
const InfoTile = ({ icon, label, value, valueTone = 'neutral', sub }: {
	icon: React.ReactNode, label: string, value: string, valueTone?: Tone, sub?: string,
}) => (
	<div className='flex-1 min-w-[9rem] rounded-lg border border-void-border-2 bg-void-bg-1-alt px-3 py-2.5'>
		<div className='flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-void-fg-4 mb-1'>
			{icon}{label}
		</div>
		<div className={`text-xs font-semibold ${toneTextClass(valueTone)}`}>{value}</div>
		{sub && <div className='text-[10px] text-void-fg-4 mt-0.5'>{sub}</div>}
	</div>
)

// a single Actions-list entry in the detail panel — icon + label, optional danger tone
const ActionItem = ({ icon, label, onClick, tone = 'neutral', disabled }: {
	icon: React.ReactNode, label: string, onClick: () => void, tone?: 'neutral' | 'danger', disabled?: boolean,
}) => (
	<button
		onClick={onClick}
		disabled={disabled}
		className={`w-full flex items-center gap-2.5 text-left text-xs px-2.5 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${tone === 'danger'
			? 'text-red-500 hover:text-red-400 hover:bg-red-500/10'
			: 'text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-2-hover'
			}`}
	>
		<span className='shrink-0'>{icon}</span>{label}
	</button>
)

// ============================================================================
// per-account row — its own bordered card (active account gets a green accent), with an
// overflow menu (Switch / Refresh / Remove); clicking the row (not its buttons) selects it
// ============================================================================

const AccountRow = ({ account, isBusy, isSelected, onSelect, onSwitch, onRemove, onRefresh }: {
	account: IGitHubAccount
	isBusy: boolean
	isSelected: boolean
	onSelect: () => void
	onSwitch: () => void
	onRemove: () => void
	onRefresh: () => void
}) => {
	const [menuOpen, setMenuOpen] = useState(false)

	return <div
		onClick={onSelect}
		role='button'
		tabIndex={0}
		onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
		className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${account.isActive
			? 'border-green-500/40 bg-green-500/5'
			: isSelected
				? 'border-void-border-2 bg-void-bg-2-hover'
				: 'border-void-border-2 bg-void-bg-1-alt hover:bg-void-bg-2-hover'
			}`}
	>
		<Avatar account={account} />
		<div className='min-w-0 flex-1'>
			<div className='flex items-center gap-2'>
				<span className='text-xs font-medium text-void-fg-1 truncate'>@{account.login}</span>
				{account.isActive && (
					<span className='inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-1.5 py-0.5 leading-none'>
						<Check className='size-2.5' /> Active
					</span>
				)}
			</div>
			{account.name && <div className='text-[11px] text-void-fg-4 truncate mt-0.5'>{account.name}</div>}
		</div>

		{isBusy ? (
			<Loader2 className='size-4 text-void-fg-3 animate-spin shrink-0' />
		) : account.isActive ? (
			<span className='shrink-0' />
		) : (
			<span className='shrink-0' onClick={e => e.stopPropagation()}>
				<VoidButtonBgDarken className='!rounded-md !px-2.5 !py-1 text-[11px]' onClick={onSwitch}>
					Switch
				</VoidButtonBgDarken>
			</span>
		)}

		<div className='relative shrink-0' onClick={e => e.stopPropagation()}>
			<IconButton icon={<MoreVertical className='size-3.5' />} label='More actions' onClick={() => setMenuOpen(o => !o)} disabled={isBusy} />
			{menuOpen && <>
				<div className='fixed inset-0 z-10' onClick={() => setMenuOpen(false)} />
				<div className='absolute right-0 top-8 z-20 w-40 py-1 rounded-md border border-void-border-2 bg-void-bg-1-alt shadow-lg'>
					{!account.isActive && (
						<button
							onClick={() => { setMenuOpen(false); onSwitch() }}
							className='w-full flex items-center gap-2 text-left text-xs text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-2-hover px-2.5 py-1.5'
						>
							<ArrowLeftRight className='size-3.5' /> Switch Account
						</button>
					)}
					<button
						onClick={() => { setMenuOpen(false); onRefresh() }}
						className='w-full flex items-center gap-2 text-left text-xs text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-2-hover px-2.5 py-1.5'
					>
						<RefreshCw className='size-3.5' /> Refresh
					</button>
					<button
						onClick={() => { setMenuOpen(false); onRemove() }}
						className='w-full flex items-center gap-2 text-left text-xs text-red-500 hover:text-red-400 hover:bg-void-bg-2-hover px-2.5 py-1.5'
					>
						<LogOut className='size-3.5' /> Remove Account
					</button>
				</div>
			</>}
		</div>
	</div>
}

// ============================================================================
// right-side "Account Details" panel — mirrors the reference layout (avatar/header, an
// authentication summary, and an actions list) using only fields GitHubAccountsState actually has
// ============================================================================

const AccountDetailPanel = ({ account, cliStatus, isBusy, onSwitch, onRefresh, onRemove, onViewOnGitHub, onClose }: {
	account: IGitHubAccount
	cliStatus: GitHubCliStatus | null
	isBusy: boolean
	onSwitch: () => void
	onRefresh: () => void
	onRemove: () => void
	onViewOnGitHub: () => void
	onClose: () => void
}) => (
	<div className='flex flex-col h-full'>
		<div className='flex items-center justify-between px-4 py-3.5 border-b border-void-border-2 shrink-0'>
			<h2 className='text-xs font-semibold text-void-fg-1'>Account Details</h2>
			<IconButton icon={<X className='size-3.5' />} label='Close' onClick={onClose} />
		</div>

		<div className='flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5'>
			{/* identity */}
			<div className='flex items-center gap-3'>
				<Avatar account={account} size={44} />
				<div className='min-w-0'>
					<div className='flex items-center gap-2'>
						<span className='text-sm font-semibold text-void-fg-1 truncate'>@{account.login}</span>
						<Badge tone={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Active' : 'Inactive'}</Badge>
					</div>
					{account.name && <div className='text-xs text-void-fg-3 truncate mt-0.5'>{account.name}</div>}
				</div>
			</div>

			{/* authentication */}
			<div>
				<SectionHeading>Authentication</SectionHeading>
				<div className='grid grid-cols-2 gap-3'>
					<div>
						<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-0.5'>Method</div>
						<div className='text-xs text-void-fg-1'>GitHub CLI</div>
					</div>
					<div>
						<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-0.5'>Status</div>
						<div className='flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400'>
							<span className='size-1.5 rounded-full bg-green-500 shrink-0' /> Authenticated
						</div>
					</div>
					{cliStatus?.installed && (
						<div className='col-span-2'>
							<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-0.5'>gh CLI Version</div>
							<div className='text-xs text-void-fg-1'>{cliStatus.version !== 'unknown' ? cliStatus.version : 'unknown'}</div>
						</div>
					)}
				</div>
			</div>

			{/* actions */}
			<div>
				<SectionHeading>Actions</SectionHeading>
				<div className='flex flex-col gap-0.5 -mx-1'>
					{!account.isActive && (
						<ActionItem icon={<ArrowLeftRight className='size-3.5' />} label='Switch to This Account' onClick={onSwitch} disabled={isBusy} />
					)}
					<ActionItem icon={<RefreshCw className='size-3.5' />} label='Refresh Account' onClick={onRefresh} disabled={isBusy} />
					<ActionItem icon={<ExternalLink className='size-3.5' />} label='View on GitHub' onClick={onViewOnGitHub} disabled={isBusy} />
					<ActionItem icon={<LogOut className='size-3.5' />} label='Remove Account' onClick={onRemove} tone='danger' disabled={isBusy} />
				</div>
			</div>
		</div>
	</div>
)

// ============================================================================
// login-in-progress card (device code flow)
// ============================================================================

const LoginProgressCard = ({ message, code, verificationUri, onCancel, onCopyCode, onOpenBrowser, copied }: {
	message: string
	code?: string
	verificationUri?: string
	onCancel: () => void
	onCopyCode: () => void
	onOpenBrowser: () => void
	copied: boolean
}) => (
	<Card className='p-4'>
		<div className='flex items-center gap-2 mb-1'>
			<Terminal className='size-4 text-void-fg-2' />
			<span className='text-sm font-medium text-void-fg-1'>Connect a GitHub account</span>
		</div>
		{verificationUri && <p className='text-xs text-void-fg-4 mb-3'>Enter this code at {verificationUri.replace(/^https?:\/\//, '')}</p>}

		{code && <>
			<div className='mb-3 text-center text-lg font-mono font-medium tracking-[0.3em] text-void-fg-1 bg-void-bg-2 border border-dashed border-void-border-2 rounded-md py-3'>
				{code}
			</div>
			<div className='h-1 rounded-full bg-void-bg-2 overflow-hidden mb-3'>
				<span className='block h-full w-1/3 rounded-full bg-blue-500 animate-pulse' />
			</div>
			<div className='flex items-center gap-2 mb-3'>
				<VoidButtonBgDarken className='!rounded-md !px-3 !py-1.5 text-xs flex items-center gap-1.5' onClick={onCopyCode}>
					<Copy className='size-3.5' /> {copied ? 'Copied!' : 'Copy Code'}
				</VoidButtonBgDarken>
				{verificationUri && (
					<VoidButtonBgDarken className='!rounded-md !px-3 !py-1.5 text-xs flex items-center gap-1.5' onClick={onOpenBrowser}>
						<ExternalLink className='size-3.5' /> Open Browser
					</VoidButtonBgDarken>
				)}
			</div>
		</>}

		<div className='flex items-center gap-2 text-[11px] text-void-fg-4'>
			<Loader2 className='size-3 animate-spin shrink-0' /> {message}
		</div>

		<button onClick={onCancel} className='mt-2 text-[11px] text-void-fg-4 hover:text-void-fg-2 underline underline-offset-2'>
			Cancel
		</button>
	</Card>
)

// ============================================================================
// main dashboard
// ============================================================================

const GitHubAccountsDashboardInner = () => {
	const accessor = useAccessor()
	const githubAccountService = accessor.get('IGitHubAccountService')
	const dialogService = accessor.get('IDialogService')
	const openerService = accessor.get('IOpenerService')
	const clipboardService = accessor.get('IClipboardService')

	const state = useGitHubAccountsState()
	const { accounts, cliStatus, isRefreshing, login, switchingLogin, removingLogin, lastError } = state

	const [copied, setCopied] = useState(false)
	const [selectedLogin, setSelectedLogin] = useState<string | null>(null)

	// keep the selection valid as accounts are added/removed/switched
	useEffect(() => {
		if (selectedLogin && !accounts.some(a => a.login === selectedLogin)) setSelectedLogin(null)
	}, [accounts, selectedLogin])

	const handleAdd = useCallback(() => { githubAccountService.startLogin() }, [githubAccountService])
	const handleCancelLogin = useCallback(() => { githubAccountService.cancelLogin() }, [githubAccountService])
	const handleRefresh = useCallback(() => { githubAccountService.refresh() }, [githubAccountService])
	const handleSwitch = useCallback((login: string) => { githubAccountService.switchAccount(login) }, [githubAccountService])

	const handleCopyCode = useCallback(() => {
		if (!login?.code) return
		clipboardService.writeText(login.code).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		})
	}, [login, clipboardService])

	const handleOpenBrowser = useCallback(() => {
		if (login?.verificationUri) openerService.open(URI.parse(login.verificationUri))
	}, [login, openerService])

	const handleOpenInstallDocs = useCallback(() => { openerService.open(CLI_DOCS_URI) }, [openerService])
	const handleViewOnGitHub = useCallback((accountLogin: string) => { openerService.open(githubProfileUri(accountLogin)) }, [openerService])

	const handleRemove = useCallback(async (accountLogin: string) => {
		const { confirmed } = await dialogService.confirm({
			type: 'warning',
			message: `Remove @${accountLogin} from JCode?`,
			detail: `This also signs @${accountLogin} out of the GitHub CLI (gh) on this machine — JCode, the integrated terminal, and any other tool using gh for github.com will no longer be able to use this account until you sign in again.`,
			primaryButton: 'Remove',
		})
		if (confirmed) githubAccountService.removeAccount(accountLogin)
	}, [dialogService, githubAccountService])

	const cliInstalled = cliStatus?.installed === true
	const selectedAccount = selectedLogin ? accounts.find(a => a.login === selectedLogin) ?? null : null

	const statusLabel = login ? 'Signing in…' : isRefreshing ? 'Refreshing…' : cliInstalled ? 'Ready' : cliStatus ? 'Not Ready' : 'Checking…'
	const statusTone: Tone = login || isRefreshing ? 'info' : cliInstalled ? 'success' : cliStatus ? 'danger' : 'neutral'

	return <div className='size-full flex bg-void-bg-2 text-void-fg-1'>
		<div className='flex-1 min-w-0 overflow-y-auto'>
			<div className='max-w-2xl mx-auto px-6 py-8 flex flex-col gap-5'>

				{/* header */}
				<div className='flex items-start justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<span className='flex items-center justify-center size-9 rounded-full bg-void-bg-2 border border-void-border-2'>
							<Github className='size-4.5 text-void-fg-2' />
						</span>
						<div>
							<h1 className='text-base font-semibold text-void-fg-1'>GitHub Accounts</h1>
							<p className='text-xs text-void-fg-3 mt-0.5'>Manage the GitHub accounts connected to JCode and switch between them.</p>
						</div>
					</div>
					<IconButton
						icon={<RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
						label='Refresh'
						onClick={handleRefresh}
						disabled={isRefreshing || !!login}
					/>
				</div>

				{/* status pills */}
				<div className='flex flex-wrap items-center gap-2'>
					<Badge tone={cliInstalled ? 'success' : cliStatus ? 'danger' : 'neutral'}>
						GitHub CLI: {cliInstalled ? 'Installed' : cliStatus ? 'Not Installed' : 'Checking…'}
					</Badge>
					<Badge tone={statusTone}>Status: {statusLabel}</Badge>
					<Badge tone='neutral'>Accounts: {accounts.length} connected</Badge>
				</div>

				{/* error banner */}
				{lastError && (
					<div className='flex items-start gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2'>
						<AlertCircle className='size-3.5 shrink-0 mt-0.5' />
						<span className='flex-1'>{lastError}</span>
					</div>
				)}

				{/* first-load spinner, before we know whether gh is even installed */}
				{cliStatus === null && isRefreshing && (
					<div className='flex items-center gap-2 text-xs text-void-fg-4 py-6 justify-center'>
						<Loader2 className='size-3.5 animate-spin' /> Checking GitHub CLI…
					</div>
				)}

				{/* CLI missing */}
				{cliStatus && !cliStatus.installed && (
					<Card className='p-4'>
						<SectionHeading>GitHub CLI isn't installed</SectionHeading>
						<p className='text-xs text-void-fg-3 mb-3 leading-relaxed'>
							JCode uses the GitHub CLI (<code className='font-mono'>gh</code>) to securely manage GitHub authentication - it never handles your GitHub token directly.
						</p>
						<div className='flex items-center gap-2 text-xs text-void-fg-2 bg-void-bg-2 border border-void-border-2 rounded-md px-3 py-2 font-mono mb-3'>
							<Terminal className='size-3.5 shrink-0 text-void-fg-4' />
							{INSTALL_INSTRUCTIONS.command}
						</div>
						<div className='flex items-center gap-2'>
							<VoidButtonBgDarken className='!rounded-md !px-3 !py-1.5 text-xs flex items-center gap-1.5' onClick={handleOpenInstallDocs}>
								<ExternalLink className='size-3.5' /> Install Instructions
							</VoidButtonBgDarken>
							<VoidButtonBgDarken className='!rounded-md !px-3 !py-1.5 text-xs' onClick={handleRefresh}>
								Check Again
							</VoidButtonBgDarken>
						</div>
					</Card>
				)}

				{/* login in progress */}
				{login && (
					<LoginProgressCard
						message={login.message}
						code={login.code}
						verificationUri={login.verificationUri}
						onCancel={handleCancelLogin}
						onCopyCode={handleCopyCode}
						onOpenBrowser={handleOpenBrowser}
						copied={copied}
					/>
				)}

				{/* accounts */}
				{cliInstalled && !login && (
					accounts.length === 0 ? (
						<Card>
							<EmptyState
								icon={Github}
								title='No GitHub accounts connected'
								description='Connect GitHub to clone repositories, push code, create pull requests, and use GitHub features from JCode.'
								action={
									<VoidButtonBgDarken className='mt-2 !rounded-md !px-4 !py-2 text-sm font-medium flex items-center gap-1.5' onClick={handleAdd}>
										<Plus className='size-4' /> Add GitHub Account
									</VoidButtonBgDarken>
								}
							/>
						</Card>
					) : (
						<div className='flex flex-col gap-2'>
							{accounts.map(account => (
								<AccountRow
									key={account.login}
									account={account}
									isBusy={switchingLogin === account.login || removingLogin === account.login}
									isSelected={selectedLogin === account.login}
									onSelect={() => setSelectedLogin(cur => cur === account.login ? null : account.login)}
									onSwitch={() => handleSwitch(account.login)}
									onRemove={() => handleRemove(account.login)}
									onRefresh={handleRefresh}
								/>
							))}
						</div>
					)
				)}

				{cliInstalled && !login && accounts.length > 0 && (
					<VoidButtonBgDarken className='self-start !rounded-md !px-3 !py-1.5 text-xs flex items-center gap-1.5' onClick={handleAdd}>
						<Plus className='size-3.5' /> Add GitHub Account
					</VoidButtonBgDarken>
				)}

				{/* status tiles — real fields only (no fabricated scopes/protocol/sync-time) */}
				{cliInstalled && !login && (
					<div className='flex flex-wrap gap-2'>
						<InfoTile
							icon={<ShieldCheck className='size-3' />}
							label='GitHub CLI'
							value={cliStatus.version !== 'unknown' ? `v${cliStatus.version}` : 'Installed'}
							valueTone='success'
							sub='Up to date'
						/>
						<InfoTile
							icon={<Check className='size-3' />}
							label='Status'
							value={statusLabel}
							valueTone={statusTone}
						/>
						<InfoTile
							icon={<Users className='size-3' />}
							label='Accounts'
							value={`${accounts.length} connected`}
						/>
					</div>
				)}
			</div>
		</div>

		{/* account details side panel */}
		{selectedAccount && (
			<div className='w-72 shrink-0 border-l border-void-border-2 bg-void-bg-1-alt'>
				<AccountDetailPanel
					account={selectedAccount}
					cliStatus={cliStatus}
					isBusy={switchingLogin === selectedAccount.login || removingLogin === selectedAccount.login}
					onSwitch={() => handleSwitch(selectedAccount.login)}
					onRefresh={handleRefresh}
					onRemove={() => handleRemove(selectedAccount.login)}
					onViewOnGitHub={() => handleViewOnGitHub(selectedAccount.login)}
					onClose={() => setSelectedLogin(null)}
				/>
			</div>
		)}
	</div>
}

export const GitHubAccountsDashboard = () => {
	const isDark = useIsDark()
	return <div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
		<ErrorBoundary>
			<GitHubAccountsDashboardInner />
		</ErrorBoundary>
	</div>
}
