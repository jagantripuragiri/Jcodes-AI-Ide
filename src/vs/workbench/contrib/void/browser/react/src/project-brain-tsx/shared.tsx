import React from 'react'
import {
	Play, Settings2, Component as ComponentIcon, Cog, Route, Database, KeyRound, Wrench,
	FlaskConical, FileText, File as FileIcon, LucideIcon, ChevronRight,
} from 'lucide-react'
import {
	FileCategory, HealthCategoryScore, IssueSeverity, ProjectBrainStatus, FILE_CATEGORY_LABELS,
} from '../../../../common/projectBrain/projectBrainTypes.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { useAccessor } from '../util/services.js'

// ============================================================================
// tone system — the single source of truth for semantic color across Project Brain
// ============================================================================

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export const toneTextClass = (tone: Tone): string => ({
	neutral: 'text-void-fg-3',
	success: 'text-green-600 dark:text-green-400',
	warning: 'text-amber-600 dark:text-amber-400',
	danger: 'text-red-600 dark:text-red-400',
	info: 'text-blue-600 dark:text-blue-400',
}[tone])

export const toneBarClass = (tone: Tone): string => ({
	neutral: 'bg-void-fg-4',
	success: 'bg-green-500',
	warning: 'bg-amber-500',
	danger: 'bg-red-500',
	info: 'bg-blue-500',
}[tone])

export const toneSoftBgClass = (tone: Tone): string => ({
	neutral: 'bg-void-bg-2',
	success: 'bg-green-500/10',
	warning: 'bg-amber-500/10',
	danger: 'bg-red-500/10',
	info: 'bg-blue-500/10',
}[tone])

export const toneBorderClass = (tone: Tone): string => ({
	neutral: 'border-void-border-2',
	success: 'border-green-500/30',
	warning: 'border-amber-500/30',
	danger: 'border-red-500/30',
	info: 'border-blue-500/30',
}[tone])

// ---------- health scoring → tone/label (thresholds match the bars/rings below) ----------

export const healthStatus = (score: HealthCategoryScore): { label: string, tone: Tone } => {
	if (typeof score !== 'number') return { label: 'No data', tone: 'neutral' }
	if (score >= 80) return { label: 'Excellent', tone: 'success' }
	if (score >= 60) return { label: 'Good', tone: 'info' }
	if (score >= 40) return { label: 'Fair', tone: 'warning' }
	return { label: 'Critical', tone: 'danger' }
}

// ---------- issue severity → tone ----------

export const severityTone = (severity: IssueSeverity): Tone => {
	if (severity === 'critical') return 'danger'
	if (severity === 'high') return 'warning'
	if (severity === 'medium') return 'info'
	return 'neutral'
}

// ============================================================================
// category → icon
// ============================================================================

export const FILE_CATEGORY_ICONS: { [c in FileCategory]: LucideIcon } = {
	entry: Play,
	config: Settings2,
	component: ComponentIcon,
	service: Cog,
	api: Route,
	model: Database,
	auth: KeyRound,
	util: Wrench,
	test: FlaskConical,
	doc: FileText,
	other: FileIcon,
}

export const FILE_CATEGORY_DESCRIPTIONS: { [c in FileCategory]: string } = {
	entry: 'Application entry point',
	config: 'Project or build configuration',
	component: 'UI component',
	service: 'Service or business logic',
	api: 'API route or handler',
	model: 'Data model or schema',
	auth: 'Authentication or authorization',
	util: 'Shared utility',
	test: 'Test file',
	doc: 'Documentation',
	other: 'Project file',
}

export const CategoryIcon = ({ category, className }: { category: FileCategory, className?: string }) => {
	const Icon = FILE_CATEGORY_ICONS[category]
	return <Icon className={className ?? 'size-3.5'} />
}

export const CategoryBadge = ({ category }: { category: FileCategory }) => {
	return <span className='inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-void-fg-3 bg-void-bg-2 border border-void-border-2 rounded px-1.5 py-0.5'>
		<CategoryIcon category={category} className='size-3' />
		{FILE_CATEGORY_LABELS[category]}
	</span>
}

// ============================================================================
// layout primitives
// ============================================================================

export const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
	<div className={`border border-void-border-2 rounded-lg bg-void-bg-1-alt ${className}`}>{children}</div>
)

export const SectionHeading = ({ children, action, subtitle }: { children: React.ReactNode, action?: React.ReactNode, subtitle?: React.ReactNode }) => (
	<div className='flex items-start justify-between gap-3 mb-3'>
		<div className='min-w-0'>
			<h3 className='text-[11px] font-semibold uppercase tracking-wide text-void-fg-3 truncate'>{children}</h3>
			{subtitle && <p className='text-[11px] text-void-fg-4 mt-0.5'>{subtitle}</p>}
		</div>
		{action && <div className='shrink-0'>{action}</div>}
	</div>
)

// a clickable/static row with icon, title, subtitle and an optional trailing element — the
// workhorse list-item used across Important Files, Codebase, Architecture detail panels, etc.
export const Row = ({ icon, title, subtitle, trailing, onClick, mono = false }: {
	icon?: React.ReactNode, title: React.ReactNode, subtitle?: React.ReactNode, trailing?: React.ReactNode,
	onClick?: () => void, mono?: boolean,
}) => {
	const Wrapper = onClick ? 'button' : 'div'
	return <Wrapper
		onClick={onClick}
		className={`group w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md transition-colors ${onClick ? 'hover:bg-void-bg-2-hover cursor-pointer' : ''}`}
	>
		{icon && <span className='shrink-0 text-void-fg-3'>{icon}</span>}
		<span className='min-w-0 flex-1'>
			<span className={`block text-xs text-void-fg-1 truncate ${mono ? 'font-mono' : ''}`}>{title}</span>
			{subtitle && <span className='block text-[11px] text-void-fg-4 truncate mt-0.5'>{subtitle}</span>}
		</span>
		{trailing !== undefined ? <span className='shrink-0'>{trailing}</span> : onClick && (
			<ChevronRight className='size-3.5 shrink-0 text-void-fg-4 opacity-0 group-hover:opacity-100 transition-opacity' />
		)}
	</Wrapper>
}

// ============================================================================
// badges / pills
// ============================================================================

export const Badge = ({ children, tone = 'neutral' }: { children: React.ReactNode, tone?: Tone }) => {
	return <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full border px-1.5 py-0.5 leading-none ${toneTextClass(tone)} ${toneSoftBgClass(tone)} ${toneBorderClass(tone)}`}>{children}</span>
}

export const Kbd = ({ children }: { children: React.ReactNode }) => (
	<kbd className='inline-flex items-center justify-center h-4.5 min-w-[18px] px-1 text-[10px] font-sans text-void-fg-4 bg-void-bg-2 border border-void-border-2 rounded'>{children}</kbd>
)

// ============================================================================
// health visualization
// ============================================================================

export const HealthBar = ({ label, score, onClick, size = 'sm' }: { label: string, score: HealthCategoryScore, onClick?: () => void, size?: 'sm' | 'lg' }) => {
	const Wrapper = onClick ? 'button' : 'div'
	const { tone } = healthStatus(score)
	return <Wrapper onClick={onClick} className={`w-full flex items-center gap-3 text-left ${size === 'lg' ? 'py-1' : 'py-1'} ${onClick ? 'hover:bg-void-bg-2-hover rounded px-1 -mx-1' : ''}`}>
		{label && <span className='w-28 shrink-0 text-xs text-void-fg-2'>{label}</span>}
		{typeof score === 'number' ? <>
			<span className={`flex-1 rounded-full bg-void-bg-2 overflow-hidden ${size === 'lg' ? 'h-2' : 'h-1.5'}`}>
				<span className={`block h-full rounded-full transition-[width] duration-300 ${toneBarClass(tone)}`} style={{ width: `${Math.max(2, score)}%` }} />
			</span>
			<span className={`shrink-0 text-right text-xs tabular-nums font-medium ${size === 'lg' ? 'w-10' : 'w-8'} ${toneTextClass(tone)}`}>{score}</span>
		</> : <span className='flex-1 text-xs text-void-fg-4 italic'>Not enough data</span>}
	</Wrapper>
}

export const HealthRing = ({ score, size = 72 }: { score: HealthCategoryScore, size?: number }) => {
	const radius = (size - 8) / 2
	const circumference = 2 * Math.PI * radius
	const n = typeof score === 'number' ? score : 0
	const offset = circumference * (1 - n / 100)
	const { tone } = healthStatus(score)
	return <div className='relative shrink-0' style={{ width: size, height: size }}>
		<svg width={size} height={size} className='-rotate-90'>
			<circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={5} className='stroke-void-bg-2' fill='none' />
			{typeof score === 'number' && <circle
				cx={size / 2} cy={size / 2} r={radius} strokeWidth={5} fill='none'
				strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap='round'
				className={`transition-[stroke-dashoffset] duration-500 ${toneBarClass(tone).replace('bg-', 'stroke-')}`}
			/>}
		</svg>
		<div className='absolute inset-0 flex items-center justify-center'>
			{typeof score === 'number'
				? <span className={`text-lg font-semibold tabular-nums ${toneTextClass(tone)}`}>{score}</span>
				: <span className='text-[10px] text-void-fg-4 italic px-2 text-center leading-tight'>No data</span>}
		</div>
	</div>
}

// a compact metric card for a single health category — score, progress bar, and status label
export const MetricCard = ({ label, score, onClick }: { label: string, score: HealthCategoryScore, onClick?: () => void }) => {
	const { label: statusLabel, tone } = healthStatus(score)
	const Wrapper = onClick ? 'button' : 'div'
	return <Wrapper
		onClick={onClick}
		className={`w-full text-left border rounded-lg px-3 py-2.5 transition-colors ${toneBorderClass(tone === 'neutral' ? 'neutral' : tone)} bg-void-bg-1-alt ${onClick ? 'hover:bg-void-bg-2-hover cursor-pointer' : ''}`}
	>
		<div className='flex items-center justify-between gap-2'>
			<span className='text-xs text-void-fg-2 truncate'>{label}</span>
			<span className={`text-sm font-semibold tabular-nums ${toneTextClass(tone)}`}>{typeof score === 'number' ? score : '—'}</span>
		</div>
		<div className='mt-2 h-1.5 rounded-full bg-void-bg-2 overflow-hidden'>
			<span className={`block h-full rounded-full transition-[width] duration-300 ${toneBarClass(tone)}`} style={{ width: `${typeof score === 'number' ? Math.max(2, score) : 0}%` }} />
		</div>
		<div className={`mt-1.5 text-[10px] font-medium ${toneTextClass(tone)}`}>{statusLabel}</div>
	</Wrapper>
}

// ============================================================================
// stat tiles (issue counts, etc.)
// ============================================================================

export const StatTile = ({ label, value, tone = 'neutral', active = false, onClick }: {
	label: string, value: number, tone?: Tone, active?: boolean, onClick?: () => void,
}) => {
	const Wrapper = onClick ? 'button' : 'div'
	const highlighted = value > 0 && tone !== 'neutral'
	return <Wrapper
		onClick={onClick}
		className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition-colors ${active ? `${toneBorderClass(tone)} ${toneSoftBgClass(tone)}` : 'border-void-border-2 bg-void-bg-1-alt'} ${onClick ? 'hover:bg-void-bg-2-hover cursor-pointer' : ''}`}
	>
		<span className={`text-lg font-semibold tabular-nums ${highlighted ? toneTextClass(tone) : 'text-void-fg-1'}`}>{value}</span>
		<span className='text-[10px] text-void-fg-3'>{label}</span>
	</Wrapper>
}

// ============================================================================
// empty states
// ============================================================================

export const EmptyState = ({ icon: Icon, title, description, tone = 'neutral', action }: {
	icon: LucideIcon, title: string, description?: string, tone?: Tone, action?: React.ReactNode,
}) => (
	<div className='flex flex-col items-center text-center gap-2 py-10 px-6'>
		<span className={`flex items-center justify-center size-9 rounded-full mb-1 ${toneSoftBgClass(tone)}`}>
			<Icon className={`size-4.5 ${tone === 'neutral' ? 'text-void-fg-3' : toneTextClass(tone)}`} />
		</span>
		<div className='text-sm font-medium text-void-fg-1'>{title}</div>
		{description && <p className='text-xs text-void-fg-3 max-w-sm leading-relaxed'>{description}</p>}
		{action}
	</div>
)

// small inline empty hint (used mid-panel, not full-section)
export const EmptyHint = ({ children }: { children: React.ReactNode }) => (
	<div className='text-xs text-void-fg-4 italic py-2'>{children}</div>
)

// ============================================================================
// timeline (Recent Activity)
// ============================================================================

export const TimelineItem = ({ icon, title, timestamp, meta, isLast = false, onClick }: {
	icon: React.ReactNode, title: React.ReactNode, timestamp: string, meta?: React.ReactNode, isLast?: boolean, onClick?: () => void,
}) => (
	<div className='relative flex gap-3 pb-4 last:pb-0'>
		{!isLast && <span className='absolute left-[11px] top-6 bottom-0 w-px bg-void-border-2' />}
		<span className='relative z-10 flex items-center justify-center size-6 rounded-full bg-void-bg-2 border border-void-border-2 text-void-fg-3 shrink-0'>
			{icon}
		</span>
		<div className='min-w-0 flex-1 pt-0.5'>
			{onClick
				? <button onClick={onClick} className='block text-left text-xs text-void-fg-1 hover:text-void-fg-1 hover:underline truncate w-full'>{title}</button>
				: <div className='text-xs text-void-fg-1 truncate'>{title}</div>}
			<div className='text-[11px] text-void-fg-4 mt-0.5'>{timestamp}</div>
			{meta}
		</div>
	</div>
)

// ============================================================================
// brain status
// ============================================================================

export const BrainStatusDot = ({ status }: { status: ProjectBrainStatus }) => {
	const cls = status === 'ready' ? 'bg-green-500' : status === 'scanning' ? 'bg-yellow-500 animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-void-fg-4'
	return <span className={`inline-block size-2 rounded-full ${cls}`} />
}

// ============================================================================
// tab bar — horizontal, scrollable, keyboard-accessible segmented navigation
// ============================================================================

export const TabBar = <T extends string>({ tabs, active, onChange }: {
	tabs: { id: T, label: string, icon: LucideIcon }[], active: T, onChange: (id: T) => void,
}) => {
	const onKeyDown = (e: React.KeyboardEvent, i: number) => {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
		e.preventDefault()
		const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length
		onChange(tabs[next].id)
			; (document.getElementById(`brain-tab-${tabs[next].id}`) as HTMLElement | null)?.focus()
	}

	return <div role='tablist' aria-label='Project Brain sections' className='flex items-center gap-1 overflow-x-auto px-3 py-1.5 border-b border-void-border-2 shrink-0 [scrollbar-width:thin]'>
		{tabs.map((t, i) => {
			const Icon = t.icon
			const isActive = active === t.id
			return <button
				key={t.id}
				id={`brain-tab-${t.id}`}
				role='tab'
				aria-selected={isActive}
				tabIndex={isActive ? 0 : -1}
				onKeyDown={e => onKeyDown(e, i)}
				onClick={() => onChange(t.id)}
				className={`relative flex items-center gap-1.5 shrink-0 text-xs px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${isActive ? 'text-void-fg-1 bg-void-bg-2 font-medium' : 'text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-2-hover'}`}
			>
				<Icon className={`size-3.5 shrink-0 ${isActive ? 'text-void-fg-1' : 'text-void-fg-4'}`} />
				{t.label}
			</button>
		})}
	</div>
}

// ============================================================================
// misc
// ============================================================================

export const relativeTime = (iso: string | null | undefined): string => {
	if (!iso) return 'never'
	const then = new Date(iso).getTime()
	if (Number.isNaN(then)) return 'unknown'
	const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
	if (diffSec < 5) return 'just now'
	if (diffSec < 60) return `${diffSec}s ago`
	const diffMin = Math.floor(diffSec / 60)
	if (diffMin < 60) return `${diffMin}m ago`
	const diffHr = Math.floor(diffMin / 60)
	if (diffHr < 24) return `${diffHr}h ago`
	const diffDay = Math.floor(diffHr / 24)
	if (diffDay < 30) return `${diffDay}d ago`
	return new Date(iso).toLocaleDateString()
}

// opens a workspace-relative file (optionally at a specific 1-indexed line) in the editor group
export const useOpenProjectFile = () => {
	const accessor = useAccessor()
	return (relPath: string, opts?: { line?: number }) => {
		const workspaceContextService = accessor.get('IWorkspaceContextService')
		const editorService = accessor.get('IEditorService')
		const folders = workspaceContextService.getWorkspace().folders
		if (folders.length === 0) return
		const resource = URI.joinPath(folders[0].uri, ...relPath.split('/'))
		editorService.openEditor({
			resource,
			options: opts?.line ? { selection: { startLineNumber: opts.line, startColumn: 1 } } : undefined,
		})
	}
}
