import '../styles.css'
import React, { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CloudDownload, Download, ExternalLink, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { useAccessor, useIsDark } from '../util/services.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { JCodesRelease, JCODES_DOWNLOADS_URL, JCODES_GITHUB_URL } from '../../../../common/voidUpdateServiceTypes.js'
import { Badge, Card, EmptyHint, SectionHeading, relativeTime } from '../project-brain-tsx/shared.js'

// ============================================================================
// helpers
// ============================================================================

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
const fmtSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(0)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

// friendly name for a release file, falling back to the raw file name
const assetLabel = (name: string): string => {
	if (/darwin-arm64|macos.*arm64/i.test(name)) return 'macOS (Apple Silicon)'
	if (/darwin|macos|\.dmg$/i.test(name)) return 'macOS'
	if (/\.exe$/i.test(name)) return 'Windows installer'
	if (/\.deb$/i.test(name)) return 'Linux (.deb)'
	if (/\.rpm$/i.test(name)) return 'Linux (.rpm)'
	if (/\.appimage$/i.test(name)) return 'Linux (AppImage)'
	return name
}

// release notes come from GitHub as markdown - this shows headings, bullets and plain text without rendering any html
const ReleaseNotes = ({ notes }: { notes: string }) => {
	const lines = notes.split('\n').map(l => l.trimEnd()).filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== ''))
	if (!notes.trim()) return <EmptyHint>No release notes were written for this version.</EmptyHint>
	return <div className='text-xs text-void-fg-2 space-y-1 break-words'>
		{lines.map((line, i) => {
			if (line === '') return <div key={i} className='h-1.5' />
			const heading = line.match(/^#{1,6}\s+(.*)$/)
			if (heading) return <div key={i} className='font-semibold text-void-fg-1 pt-1'>{heading[1]}</div>
			const bullet = line.match(/^\s*[*-]\s+(.*)$/)
			if (bullet) return <div key={i} className='flex gap-2'><span className='text-void-fg-4'>•</span><span>{bullet[1]}</span></div>
			return <div key={i}>{line}</div>
		})}
	</div>
}

// ============================================================================
// state
// ============================================================================

const useUpdates = () => {
	const accessor = useAccessor()
	const updatesService = accessor.get('IJCodesUpdatesService')
	const openerService = accessor.get('IOpenerService')

	const [state, setState] = useState(updatesService.state)
	useEffect(() => {
		const disposable = updatesService.onDidChangeState(() => setState(updatesService.state))
		setState(updatesService.state)
		// the status bar normally has already checked; only check here if nothing has been fetched yet
		if (updatesService.state.status === 'idle') updatesService.refresh()
		return () => disposable.dispose()
	}, [updatesService])

	const refresh = useCallback(() => { updatesService.refresh() }, [updatesService])
	const open = useCallback((url: string) => { openerService.open(URI.parse(url)) }, [openerService])

	return { state, refresh, open }
}

// ============================================================================
// sections
// ============================================================================

const Header = () => (
	<div className='flex items-center gap-3 px-4 py-3.5 border-b border-void-border-2 shrink-0'>
		<span className='flex items-center justify-center size-9 rounded-lg bg-void-bg-2 border border-void-border-2 shrink-0'>
			<CloudDownload className='size-4.5 text-void-fg-2' />
		</span>
		<div className='min-w-0'>
			<h1 className='text-base font-semibold text-void-fg-1 truncate leading-tight'>Updates</h1>
			<p className='text-xs text-void-fg-3 mt-0.5'>See what version you have, what is new, and download the latest J Codes</p>
		</div>
	</div>
)

const VersionRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
	<div>
		<div className='text-[11px] uppercase tracking-wide text-void-fg-4'>{label}</div>
		<div className='text-lg font-semibold text-void-fg-1 mt-0.5'>{value}</div>
	</div>
)

const StatusCard = () => {
	const { state, refresh, open } = useUpdates()
	const { status, currentVersion, latest, updateAvailable, checkedAt } = state
	const isChecking = status === 'checking'

	const badge = isChecking ? <Badge tone='info'><Loader2 className='size-3 animate-spin' />Checking…</Badge>
		: status === 'error' ? <Badge tone='danger'><TriangleAlert className='size-3' />Couldn't check</Badge>
			: updateAvailable ? <Badge tone='warning'><Download className='size-3' />Update available</Badge>
				: status === 'ready' ? <Badge tone='success'><CheckCircle2 className='size-3' />Up to date</Badge>
					: null

	return <Card className='p-4'>
		<div className='flex items-start justify-between gap-3 flex-wrap'>
			<div className='flex items-start gap-8 flex-wrap'>
				<VersionRow label='Installed' value={currentVersion ? `v${currentVersion.replace(/^v/i, '')}` : 'Unknown'} />
				<VersionRow label='Latest' value={latest?.tag ?? '—'} />
			</div>
			{badge}
		</div>

		{status === 'error' && <div className='text-xs text-void-fg-3 mt-3'>Couldn't reach GitHub. Check your internet connection and try again.</div>}

		<div className='flex items-center gap-2 mt-4 flex-wrap'>
			<button
				onClick={() => open(JCODES_DOWNLOADS_URL)}
				className='flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-void-fg-1 text-void-bg-1 hover:opacity-90 transition-opacity'
			>
				<Download className='size-3.5' />Download latest
			</button>
			<button
				onClick={refresh}
				disabled={isChecking}
				className='flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-void-border-2 text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-2 disabled:opacity-50 transition-colors'
			>
				<RefreshCw className={`size-3.5 ${isChecking ? 'animate-spin' : ''}`} />Check now
			</button>
			<button
				onClick={() => open(JCODES_GITHUB_URL)}
				className='flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-void-fg-3 hover:text-void-fg-1 transition-colors'
			>
				<ExternalLink className='size-3.5' />J Codes on GitHub
			</button>
			{checkedAt && <span className='text-[11px] text-void-fg-4 ml-auto'>Checked {relativeTime(checkedAt)}</span>}
		</div>
	</Card>
}

const DownloadsCard = ({ release, open }: { release: JCodesRelease, open: (url: string) => void }) => (
	<Card className='p-4'>
		<SectionHeading subtitle={`Files attached to ${release.tag}`}>Downloads</SectionHeading>
		{release.assets.length === 0
			? <EmptyHint>No files are attached to this release yet.</EmptyHint>
			: <div className='divide-y divide-void-border-2'>
				{release.assets.map(asset => (
					<div key={asset.url} className='flex items-center justify-between gap-3 py-2'>
						<div className='min-w-0'>
							<div className='text-xs text-void-fg-1 truncate'>{assetLabel(asset.name)}</div>
							<div className='text-[11px] text-void-fg-4 truncate'>{asset.name} · {fmtSize(asset.sizeBytes)}</div>
						</div>
						<button
							onClick={() => open(asset.url)}
							className='flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border border-void-border-2 text-void-fg-2 hover:text-void-fg-1 hover:bg-void-bg-2 transition-colors shrink-0'
						>
							<Download className='size-3' />Download
						</button>
					</div>
				))}
			</div>}
	</Card>
)

const LatestNotesCard = ({ release }: { release: JCodesRelease }) => (
	<Card className='p-4'>
		<SectionHeading subtitle={release.publishedAt ? `Released ${fmtDate(release.publishedAt)}` : undefined}>What's new in {release.tag}</SectionHeading>
		<ReleaseNotes notes={release.notes} />
	</Card>
)

const HistoryCard = ({ releases, open }: { releases: JCodesRelease[], open: (url: string) => void }) => (
	<Card className='p-4'>
		<SectionHeading subtitle='The last few releases'>Release history</SectionHeading>
		<div className='divide-y divide-void-border-2'>
			{releases.map(release => (
				<details key={release.tag} className='py-2 group'>
					<summary className='flex items-center gap-2 cursor-pointer list-none text-xs text-void-fg-1'>
						<span className='font-semibold'>{release.tag}</span>
						{release.isPrerelease && <Badge tone='warning'>Pre-release</Badge>}
						<span className='text-void-fg-4'>{fmtDate(release.publishedAt)}</span>
						<span className='ml-auto text-void-fg-4 group-open:hidden'>Show notes</span>
						<span className='ml-auto text-void-fg-4 hidden group-open:inline'>Hide notes</span>
					</summary>
					<div className='mt-2 pl-1'>
						<ReleaseNotes notes={release.notes} />
						<button onClick={() => open(release.url)} className='flex items-center gap-1.5 text-[11px] text-void-fg-3 hover:text-void-fg-1 mt-2 transition-colors'>
							<ExternalLink className='size-3' />View on GitHub
						</button>
					</div>
				</details>
			))}
		</div>
	</Card>
)

const UpdatesContent = () => {
	const { state, open } = useUpdates()
	const { latest, releases } = state

	return <div className='max-w-3xl mx-auto space-y-4'>
		<StatusCard />
		{latest && <>
			<DownloadsCard release={latest} open={open} />
			<LatestNotesCard release={latest} />
		</>}
		{releases.length > 0 && <HistoryCard releases={releases} open={open} />}
	</div>
}

// ============================================================================
// root
// ============================================================================

const DashboardInner = () => (
	<div className='h-full w-full flex flex-col overflow-hidden bg-void-bg-1'>
		<Header />
		<main className='flex-1 overflow-y-auto'>
			<div className='p-5 sm:p-6'>
				<UpdatesContent />
			</div>
		</main>
	</div>
)

export const UpdatesDashboard = () => {
	const isDark = useIsDark()
	return <div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
		<ErrorBoundary>
			<DashboardInner />
		</ErrorBoundary>
	</div>
}
