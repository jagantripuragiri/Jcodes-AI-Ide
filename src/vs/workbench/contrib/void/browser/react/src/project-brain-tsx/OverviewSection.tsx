import React from 'react'
import { CheckCircle2, Star, GitCommit, Network, FolderTree, Activity as ActivityIcon, Package, GitCommitHorizontal, Sparkles, Send } from 'lucide-react'
import { DecisionStatus, FILE_CATEGORY_LABELS, ProjectBrainIndex, ProjectBrainTab } from '../../../../common/projectBrain/projectBrainTypes.js'
import {
	Card, SectionHeading, CategoryIcon, Badge, useOpenProjectFile,
	HealthBar, EmptyState, TimelineItem, Row, healthStatus, toneTextClass, Tone, relativeTime,
} from './shared.js'
import { ArchitectureDiagram, ArchitectureLayerList } from './ArchitectureDiagram.js'

type OnNavigate = (tab: ProjectBrainTab, focusRelPath?: string, prefillQuestion?: string) => void

const ViewAll = ({ onClick }: { onClick: () => void }) => (
	<button onClick={onClick} className='text-[11px] text-void-fg-3 hover:text-void-fg-1 transition-colors'>View all →</button>
)

const StatCardShell = ({ icon, label, onClick, children }: { icon: React.ReactNode, label: string, onClick: () => void, children: React.ReactNode }) => (
	<Card className='p-4 flex flex-col'>
		<button onClick={onClick} className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-void-fg-4 hover:text-void-fg-2 transition-colors mb-3'>
			{icon}{label}
		</button>
		<div className='flex-1'>{children}</div>
	</Card>
)

// ---------- derived, presentation-only data (no backend changes — everything below is computed from real index fields) ----------

const extensionBreakdown = (index: ProjectBrainIndex) => {
	const counts = new Map<string, number>()
	for (const f of index.files) {
		const ext = (f.ext || 'other').replace(/^\./, '').toUpperCase() || 'OTHER'
		counts.set(ext, (counts.get(ext) ?? 0) + 1)
	}
	const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
	const top = sorted.slice(0, 4)
	const otherCount = sorted.slice(4).reduce((sum, [, n]) => sum + n, 0)
	return otherCount > 0 ? [...top, ['Others', otherCount] as [string, number]] : top
}

const commitsPerDay = (index: ProjectBrainIndex) => {
	const days: { label: string, count: number }[] = []
	const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
	for (let i = 6; i >= 0; i--) {
		const start = new Date()
		start.setHours(0, 0, 0, 0)
		start.setDate(start.getDate() - i)
		const end = new Date(start)
		end.setDate(start.getDate() + 1)
		const count = index.gitActivity.filter(c => {
			const t = new Date(c.date).getTime()
			return t >= start.getTime() && t < end.getTime()
		}).length
		days.push({ label: dayLabels[start.getDay()], count })
	}
	return days
}

type Insight = { text: string, tone: Tone, label: string }

const deriveInsights = (index: ProjectBrainIndex): Insight[] => {
	const insights: Insight[] = []

	const critical = index.issues.filter(i => i.severity === 'critical').length
	const high = index.issues.filter(i => i.severity === 'high').length
	if (critical > 0) insights.push({ text: `${critical} critical issue${critical === 1 ? '' : 's'} need${critical === 1 ? 's' : ''} attention`, tone: 'danger', label: 'Important' })
	else if (high > 0) insights.push({ text: `${high} high-severity issue${high === 1 ? '' : 's'} found`, tone: 'warning', label: 'Warning' })

	if (typeof index.health.categories.testing === 'number' && index.health.categories.testing < 60) {
		insights.push({ text: 'Test coverage may need attention', tone: 'warning', label: 'Warning' })
	}

	const unusedDeps = index.dependencies.filter(d => !d.dev && d.usedByFileCount === 0).length
	if (unusedDeps > 0) insights.push({ text: `${unusedDeps} dependenc${unusedDeps === 1 ? 'y appears' : 'ies appear'} unused`, tone: 'info', label: 'Info' })

	const recentlyChanged = new Set(index.gitActivity.slice(0, 5).flatMap(c => c.filesChanged))
	const authTouched = index.files.some(f => f.category === 'auth' && recentlyChanged.has(f.relPath))
	if (authTouched) insights.push({ text: 'Authentication code was modified recently', tone: 'info', label: 'Info' })

	if (insights.length === 0 && typeof index.health.overall === 'number' && index.health.overall >= 80) {
		insights.push({ text: 'Project health looks solid', tone: 'success', label: 'Success' })
	}

	return insights.slice(0, 4)
}

const ASK_SUGGESTIONS = [
	'How does authentication work?',
	'Explain the overall architecture',
	'Where is data stored?',
	'Show all API endpoints',
]

export const OverviewSection = ({ index, onNavigate }: { index: ProjectBrainIndex, onNavigate: OnNavigate }) => {
	const openFile = useOpenProjectFile()

	const importantFiles = index.files
		.filter(f => f.category === 'entry' || f.category === 'auth' || f.category === 'api' || f.category === 'model')
		.slice(0, 6)

	const recentActivity = index.gitActivity.slice(0, 5)
	const overall = healthStatus(index.health.overall)

	const extBreakdown = extensionBreakdown(index)
	const days = commitsPerDay(index)
	const maxDayCount = Math.max(1, ...days.map(d => d.count))
	const todayCount = days[days.length - 1]?.count ?? 0

	const archStatus = healthStatus(index.health.categories.architecture)

	const sortedDeps = [...index.dependencies].sort((a, b) => b.usedByFileCount - a.usedByFileCount || a.name.localeCompare(b.name))
	const topDeps = sortedDeps.slice(0, 5)
	const unusedDeps = index.dependencies.filter(d => !d.dev && d.usedByFileCount === 0).length

	const decisionOrder: DecisionStatus[] = ['confirmed', 'inferred', 'unknown']
	const topDecisions = [...index.decisions].sort((a, b) => decisionOrder.indexOf(a.status) - decisionOrder.indexOf(b.status)).slice(0, 3)

	const insights = deriveInsights(index)

	return <div className='max-w-[100rem] space-y-4'>
		{/* Row 1 — at-a-glance stat cards */}
		<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
			<StatCardShell icon={<CheckCircle2 className='size-3.5' />} label='Project Health' onClick={() => onNavigate('issues')}>
				<div className='flex items-baseline gap-1.5'>
					<span className={`text-2xl font-semibold tabular-nums ${toneTextClass(overall.tone)}`}>{typeof index.health.overall === 'number' ? index.health.overall : '—'}</span>
					<span className='text-xs text-void-fg-4'>/100</span>
				</div>
				<div className='mt-2 space-y-1'>
					<HealthBar label='Architecture' score={index.health.categories.architecture} />
					<HealthBar label='Code Quality' score={index.health.categories.codeQuality} />
					<HealthBar label='Security' score={index.health.categories.security} />
				</div>
			</StatCardShell>

			<StatCardShell icon={<Network className='size-3.5' />} label='Architecture' onClick={() => onNavigate('architecture')}>
				{index.layers.length === 0 ? <span className='text-xs text-void-fg-4 italic'>Not enough signal yet</span> : <>
					<div className='flex items-center justify-between mb-1.5'>
						<span className='text-2xl font-semibold text-void-fg-1'>{index.layers.length}</span>
						<Badge tone={archStatus.tone}>{archStatus.label}</Badge>
					</div>
					<ArchitectureLayerList layers={index.layers} />
				</>}
			</StatCardShell>

			<StatCardShell icon={<FolderTree className='size-3.5' />} label='Codebase' onClick={() => onNavigate('codebase')}>
				<div className='text-2xl font-semibold text-void-fg-1 mb-2'>{index.meta.filesIndexed.toLocaleString()} <span className='text-xs font-normal text-void-fg-4'>files</span></div>
				<div className='space-y-1'>
					{extBreakdown.map(([ext, count]) => (
						<div key={ext} className='flex items-center justify-between text-[11px]'>
							<span className='text-void-fg-3'>{ext}</span>
							<span className='text-void-fg-2 tabular-nums'>{count}</span>
						</div>
					))}
				</div>
			</StatCardShell>

			<StatCardShell icon={<ActivityIcon className='size-3.5' />} label='Activity' onClick={() => onNavigate('activity')}>
				<div className='text-2xl font-semibold text-void-fg-1 mb-0.5'>{todayCount}</div>
				<div className='text-[11px] text-void-fg-4 mb-2.5'>Changes today</div>
				<div className='flex items-end gap-1.5 h-10'>
					{days.map((d, i) => (
						<div key={i} className='flex-1 flex flex-col items-center gap-1'>
							<div className='w-full rounded-sm bg-void-bg-2 relative overflow-hidden' style={{ height: 28 }}>
								<div className={`absolute bottom-0 left-0 right-0 rounded-sm ${d.count > 0 ? 'bg-green-500/70' : ''}`} style={{ height: `${(d.count / maxDayCount) * 100}%` }} />
							</div>
							<span className='text-[9px] text-void-fg-4'>{d.label}</span>
						</div>
					))}
				</div>
			</StatCardShell>
		</div>

		{/* Row 2 — Architecture Map */}
		{index.layers.length > 0 && <Card className='p-4'>
			<SectionHeading action={<ViewAll onClick={() => onNavigate('architecture')} />}>Architecture Map</SectionHeading>
			<ArchitectureDiagram layers={index.layers} />
		</Card>}

		{/* Row 3+ — main column (Important Files / Dependencies / Decisions) + right sidebar */}
		<div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4'>
			<div className='space-y-4'>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<Card className='p-4'>
						<SectionHeading action={<ViewAll onClick={() => onNavigate('files')} />}>Important Files</SectionHeading>
						{importantFiles.length === 0 ? (
							<EmptyState icon={Star} title='No entry points detected' />
						) : <div className='-mx-1'>
							{importantFiles.map(f => (
								<Row
									key={f.relPath}
									icon={<CategoryIcon category={f.category} className='size-3.5' />}
									title={f.relPath.split('/').pop()}
									subtitle={FILE_CATEGORY_LABELS[f.category]}
									onClick={() => openFile(f.relPath)}
									mono
								/>
							))}
						</div>}
					</Card>

					<Card className='p-4'>
						<SectionHeading action={<ViewAll onClick={() => onNavigate('dependencies')} />}>Top Dependencies</SectionHeading>
						{topDeps.length === 0 ? (
							<EmptyState icon={Package} title='No manifest found' />
						) : <>
							<div className='-mx-1'>
								{topDeps.map(d => (
									<Row key={d.name} title={d.name} subtitle={d.version} mono trailing={<span className='text-[10px] text-void-fg-4'>{d.usedByFileCount} use{d.usedByFileCount === 1 ? '' : 's'}</span>} />
								))}
							</div>
							<div className='mt-2 pt-2 border-t border-void-border-2 text-[11px] text-void-fg-4 flex items-center gap-2'>
								<span>{index.dependencies.length} dependencies</span>
								{unusedDeps > 0 && <span className='text-amber-600 dark:text-amber-400'>· {unusedDeps} unused</span>}
							</div>
						</>}
					</Card>

					<Card className='p-4'>
						<SectionHeading action={<ViewAll onClick={() => onNavigate('decisions')} />}>Project Decisions</SectionHeading>
						{topDecisions.length === 0 ? (
							<EmptyState icon={GitCommitHorizontal} title='No decisions recorded yet' />
						) : <>
							<div className='space-y-3'>
								{topDecisions.map(d => (
									<div key={d.id}>
										<div className='text-xs font-medium text-void-fg-1'>{d.topic}</div>
										<div className='text-[11px] text-void-fg-3 mt-0.5 leading-relaxed line-clamp-2'>{d.summary}</div>
									</div>
								))}
							</div>
							<div className='mt-3 pt-2 border-t border-void-border-2 text-[11px] text-void-fg-4'>{index.decisions.length} decisions recorded</div>
						</>}
					</Card>
				</div>
			</div>

			<div className='space-y-4'>
				<Card className='p-4'>
					<SectionHeading action={<ViewAll onClick={() => onNavigate('activity')} />}>Recent Changes</SectionHeading>
					{recentActivity.length === 0 ? (
						<EmptyState icon={GitCommit} title='No activity yet' />
					) : <div>
						{recentActivity.map((c, i) => (
							<TimelineItem
								key={c.hash}
								icon={<GitCommit className='size-3' />}
								title={c.subject}
								timestamp={relativeTime(c.date)}
								meta={c.filesChanged[0] && <div className='text-[10px] text-void-fg-4 truncate mt-0.5'>{c.filesChanged[0]}</div>}
								isLast={i === recentActivity.length - 1}
							/>
						))}
					</div>}
				</Card>

				{insights.length > 0 && <Card className='p-4'>
					<SectionHeading>Project Insights</SectionHeading>
					<div className='space-y-2.5'>
						{insights.map((ins, i) => (
							<div key={i} className='flex items-start justify-between gap-2'>
								<span className='text-xs text-void-fg-2 leading-relaxed'>{ins.text}</span>
								<Badge tone={ins.tone}>{ins.label}</Badge>
							</div>
						))}
					</div>
				</Card>}

				<Card className='p-4'>
					<SectionHeading>Ask Project Brain</SectionHeading>
					<button
						onClick={() => onNavigate('ask')}
						className='w-full flex items-center gap-2 text-xs text-void-fg-4 bg-void-bg-1 border border-void-border-2 rounded-md px-3 py-2 hover:border-void-border-1 transition-colors mb-2.5'
					>
						<Sparkles className='size-3.5 shrink-0' />
						Ask anything about your project…
						<Send className='size-3.5 shrink-0 ml-auto' />
					</button>
					<div className='flex flex-wrap gap-1.5'>
						{ASK_SUGGESTIONS.map(q => (
							<button
								key={q}
								onClick={() => onNavigate('ask', undefined, q)}
								className='text-[11px] text-void-fg-3 bg-void-bg-2 border border-void-border-2 rounded-full px-2.5 py-1 hover:bg-void-bg-2-hover hover:text-void-fg-1 transition-colors'
							>
								{q}
							</button>
						))}
					</div>
				</Card>
			</div>
		</div>
	</div>
}
