import '../styles.css'
import React, { useMemo, useRef, useState, useCallback } from 'react'
import {
	Coins, CalendarDays, CalendarRange, Archive, Eye, Download, MessageSquare, Sparkles, GitCompare, FileCode,
} from 'lucide-react'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { useAccessor, useChatThreadsState, useIsDark, useTokenUsageChangeListener } from '../util/services.js'
import { DailyUsagePoint, TokenUsageWindow } from '../../../tokenUsageService.js'
import { TOKEN_USAGE_SOFT_TARGETS } from '../../../../common/tokenUsageTypes.js'
import { Card, SectionHeading, EmptyHint, Tone, toneBarClass } from '../project-brain-tsx/shared.js'

// ============================================================================
// formatting / derived-data helpers
// ============================================================================

const fmt = (n: number) => Math.round(n).toLocaleString()
const fmtAxis = (n: number) => n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : `${Math.round(n)}`
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const fmtDayShort = (dayISO: string) => new Date(`${dayISO}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const totalOf = (w: TokenUsageWindow) => w.inputTokens + w.outputTokens + w.systemTokens

const { day: DAY_TARGET, week: WEEK_TARGET, month: MONTH_TARGET } = TOKEN_USAGE_SOFT_TARGETS

type SeriesKey = 'input' | 'output' | 'system'
// palette validated with dataviz's contrast/CVD checker for both light (500-step) and dark (600-step, since dark
// surfaces need less lightness than light ones) — see scripts/validate_palette.js in the dataviz skill
const SERIES: { [K in SeriesKey]: { label: string, bar: string, stroke: string, fill: string, text: string, dot: string } } = {
	input: { label: 'Input Tokens', bar: 'bg-green-500 dark:bg-green-600', stroke: 'stroke-green-500 dark:stroke-green-600', fill: 'fill-green-500 dark:fill-green-600', text: 'text-green-600 dark:text-green-500', dot: 'bg-green-500 dark:bg-green-600' },
	output: { label: 'Output Tokens', bar: 'bg-blue-500', stroke: 'stroke-blue-500', fill: 'fill-blue-500', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
	system: { label: 'System Tokens', bar: 'bg-amber-500 dark:bg-amber-600', stroke: 'stroke-amber-500 dark:stroke-amber-600', fill: 'fill-amber-500 dark:fill-amber-600', text: 'text-amber-600 dark:text-amber-500', dot: 'bg-amber-500 dark:bg-amber-600' },
}

type Bucket = { key: string, label: string, input: number, output: number }

const aggregateDaily = (points: DailyUsagePoint[]): Bucket[] =>
	points.map(p => ({ key: p.day, label: fmtDayShort(p.day), input: p.inputTokens, output: p.outputTokens }))

const aggregateWeekly = (points: DailyUsagePoint[]): Bucket[] => {
	const byWeek = new Map<string, Bucket>()
	for (const p of points) {
		const d = new Date(`${p.day}T00:00:00`)
		const dayOfWeek = (d.getDay() + 6) % 7 // 0 = Monday
		const monday = new Date(d)
		monday.setDate(d.getDate() - dayOfWeek)
		const key = monday.toISOString().slice(0, 10)
		const existing = byWeek.get(key) ?? { key, label: fmtDayShort(key), input: 0, output: 0 }
		existing.input += p.inputTokens
		existing.output += p.outputTokens
		byWeek.set(key, existing)
	}
	return [...byWeek.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-10)
}

const aggregateMonthly = (points: DailyUsagePoint[]): Bucket[] => {
	const byMonth = new Map<string, Bucket>()
	for (const p of points) {
		const key = p.day.slice(0, 7) // YYYY-MM
		const existing = byMonth.get(key) ?? { key, label: new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' }), input: 0, output: 0 }
		existing.input += p.inputTokens
		existing.output += p.outputTokens
		byMonth.set(key, existing)
	}
	return [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12)
}

const niceMax = (n: number): number => {
	if (n <= 0) return 10
	const magnitude = Math.pow(10, Math.floor(Math.log10(n)))
	const residual = n / magnitude
	const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
	return niceResidual * magnitude
}

// ============================================================================
// stat cards
// ============================================================================

const Sparkline = ({ values }: { values: number[] }) => {
	const max = Math.max(1, ...values)
	return <div className='flex items-end gap-0.5 h-6'>
		{values.map((v, i) => (
			<div key={i} className='flex-1 rounded-sm bg-void-bg-2 overflow-hidden' style={{ height: '100%' }}>
				<div className={`w-full ${SERIES.input.bar} opacity-60 rounded-sm`} style={{ height: `${Math.max(4, (v / max) * 100)}%`, marginTop: `${100 - Math.max(4, (v / max) * 100)}%` }} />
			</div>
		))}
	</div>
}

const StatCard = ({ icon, label, window, target, sparkline, sinceLabel }: {
	icon: React.ReactNode, label: string, window: TokenUsageWindow, target?: number, sparkline: number[], sinceLabel?: string,
}) => {
	const total = totalOf(window)
	const pct = target ? Math.min(100, Math.round((total / target) * 100)) : undefined
	const tone: Tone = pct === undefined ? 'neutral' : pct >= 90 ? 'warning' : 'success'
	return <Card className='p-4'>
		<div className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-void-fg-4 mb-2'>{icon}{label}</div>
		<div className='text-2xl font-semibold text-void-fg-1 tabular-nums leading-none'>{fmt(total)}</div>
		<div className='text-[11px] text-void-fg-4 mt-1 mb-2.5'>tokens</div>
		{target !== undefined && pct !== undefined ? <>
			<div className='h-1.5 rounded-full bg-void-bg-2 overflow-hidden'>
				<span className={`block h-full rounded-full transition-[width] duration-300 ${toneBarClass(tone)}`} style={{ width: `${Math.max(2, pct)}%` }} />
			</div>
			<div className='mt-1 text-[10px] text-void-fg-4'>{pct}% of {fmt(target)} limit</div>
		</> : <div className='text-[10px] text-void-fg-4 mb-1'>{sinceLabel}</div>}
		<div className='mt-2.5'><Sparkline values={sparkline} /></div>
	</Card>
}

// ============================================================================
// usage overview line chart (daily / weekly / monthly)
// ============================================================================

const CHART_W = 760, CHART_H = 200
const PAD_L = 38, PAD_R = 10, PAD_T = 10, PAD_B = 22
const INNER_W = CHART_W - PAD_L - PAD_R, INNER_H = CHART_H - PAD_T - PAD_B

const UsageLineChart = ({ buckets }: { buckets: Bucket[] }) => {
	const svgRef = useRef<SVGSVGElement>(null)
	const [hoverIdx, setHoverIdx] = useState<number | null>(null)

	const n = buckets.length
	const maxVal = niceMax(Math.max(1, ...buckets.map(b => Math.max(b.input, b.output))))
	const xAt = useCallback((i: number) => PAD_L + (n <= 1 ? INNER_W / 2 : (i / (n - 1)) * INNER_W), [n])
	const yAt = (v: number) => PAD_T + INNER_H - (v / maxVal) * INNER_H

	const onMove = (e: React.MouseEvent) => {
		const svg = svgRef.current
		if (!svg || n === 0) return
		const rect = svg.getBoundingClientRect()
		const xView = ((e.clientX - rect.left) / rect.width) * CHART_W
		const idx = n <= 1 ? 0 : Math.round(((xView - PAD_L) / INNER_W) * (n - 1))
		setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
	}

	const linePath = (key: 'input' | 'output') => buckets.map((b, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(b[key])}`).join(' ')
	const areaPath = (key: 'input' | 'output') => n === 0 ? '' : `${linePath(key)} L ${xAt(n - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`

	const gridFracs = [0, 0.25, 0.5, 0.75, 1]
	const labelStride = Math.max(1, Math.ceil(n / 8))

	if (n === 0) return <EmptyHint>No usage recorded yet.</EmptyHint>

	const hover = hoverIdx !== null ? buckets[hoverIdx] : null
	const hoverX = hoverIdx !== null ? xAt(hoverIdx) : 0
	const tooltipAlign = hoverX > CHART_W * 0.66 ? 'end' : hoverX < CHART_W * 0.34 ? 'start' : 'center'

	return <div className='relative'>
		<svg
			ref={svgRef}
			viewBox={`0 0 ${CHART_W} ${CHART_H}`}
			className='w-full h-auto'
			onMouseMove={onMove}
			onMouseLeave={() => setHoverIdx(null)}
		>
			{gridFracs.map(f => {
				const v = maxVal * f
				const y = yAt(v)
				return <g key={f}>
					<line x1={PAD_L} x2={CHART_W - PAD_R} y1={y} y2={y} className='stroke-void-border-2' strokeWidth={1} />
					<text x={PAD_L - 6} y={y} textAnchor='end' dominantBaseline='middle' className='fill-void-fg-4' fontSize={9}>{fmtAxis(v)}</text>
				</g>
			})}
			{buckets.map((b, i) => (i % labelStride === 0 || i === n - 1) && (
				<text key={b.key} x={xAt(i)} y={CHART_H - 6} textAnchor='middle' className='fill-void-fg-4' fontSize={9}>{b.label}</text>
			))}
			<path d={areaPath('output')} className={SERIES.output.fill} fillOpacity={0.08} />
			<path d={areaPath('input')} className={SERIES.input.fill} fillOpacity={0.08} />
			<path d={linePath('output')} className={SERIES.output.stroke} strokeWidth={2} fill='none' strokeLinejoin='round' strokeLinecap='round' />
			<path d={linePath('input')} className={SERIES.input.stroke} strokeWidth={2} fill='none' strokeLinejoin='round' strokeLinecap='round' />
			<circle cx={xAt(n - 1)} cy={yAt(buckets[n - 1].output)} r={4} className={`${SERIES.output.fill} stroke-void-bg-1-alt`} strokeWidth={2} />
			<circle cx={xAt(n - 1)} cy={yAt(buckets[n - 1].input)} r={4} className={`${SERIES.input.fill} stroke-void-bg-1-alt`} strokeWidth={2} />
			{hover && <>
				<line x1={hoverX} x2={hoverX} y1={PAD_T} y2={CHART_H - PAD_B} className='stroke-void-border-1' strokeWidth={1} strokeDasharray='3 3' />
				<circle cx={hoverX} cy={yAt(hover.output)} r={4} className={`${SERIES.output.fill} stroke-void-bg-1-alt`} strokeWidth={2} />
				<circle cx={hoverX} cy={yAt(hover.input)} r={4} className={`${SERIES.input.fill} stroke-void-bg-1-alt`} strokeWidth={2} />
			</>}
		</svg>
		{hover && <div
			className='absolute top-0 pointer-events-none bg-void-bg-1 border border-void-border-2 rounded-md px-2.5 py-1.5 text-[11px] shadow-lg min-w-[7rem]'
			style={{
				left: `${(hoverX / CHART_W) * 100}%`,
				transform: tooltipAlign === 'end' ? 'translateX(-100%)' : tooltipAlign === 'start' ? 'translateX(0)' : 'translateX(-50%)',
			}}
		>
			<div className='text-void-fg-2 font-medium mb-1'>{hover.label}</div>
			<div className='flex items-center gap-1.5'><span className={`size-1.5 rounded-full shrink-0 ${SERIES.input.dot}`} /><span className='text-void-fg-3'>Input</span><span className='text-void-fg-1 tabular-nums ml-auto'>{fmt(hover.input)}</span></div>
			<div className='flex items-center gap-1.5'><span className={`size-1.5 rounded-full shrink-0 ${SERIES.output.dot}`} /><span className='text-void-fg-3'>Output</span><span className='text-void-fg-1 tabular-nums ml-auto'>{fmt(hover.output)}</span></div>
		</div>}
	</div>
}

const ChartLegend = () => (
	<div className='flex items-center gap-4 text-[11px] text-void-fg-3'>
		<span className='flex items-center gap-1.5'><span className={`size-2 rounded-full ${SERIES.input.dot}`} />Input Tokens</span>
		<span className='flex items-center gap-1.5'><span className={`size-2 rounded-full ${SERIES.output.dot}`} />Output Tokens</span>
	</div>
)

// ============================================================================
// token breakdown donut
// ============================================================================

const Donut = ({ segments, size = 128, strokeWidth = 16 }: { segments: { key: SeriesKey, value: number }[], size?: number, strokeWidth?: number }) => {
	const total = segments.reduce((s, x) => s + x.value, 0)
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const gap = 3
	let cumulative = 0
	return <svg width={size} height={size} className='-rotate-90 shrink-0'>
		<circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className='stroke-void-bg-2' fill='none' />
		{total > 0 && segments.filter(s => s.value > 0).map(seg => {
			const segLen = (seg.value / total) * circumference
			const visibleLen = Math.max(0, segLen - gap)
			const offset = -cumulative - gap / 2
			cumulative += segLen
			return <circle
				key={seg.key} cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill='none'
				className={SERIES[seg.key].stroke} strokeDasharray={`${visibleLen} ${circumference - visibleLen}`}
				strokeDashoffset={offset} strokeLinecap='round'
			/>
		})}
	</svg>
}

// ============================================================================
// prompt efficiency — real, measured savings from this app's own edit mechanism
// (not a comparison to other tools — we have no way to measure their usage)
// ============================================================================

const CompareBar = ({ label, value, max, tone }: { label: string, value: number, max: number, tone: Tone }) => {
	const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
	return <div>
		<div className='flex items-baseline justify-between text-[11px] mb-1'>
			<span className='text-void-fg-3'>{label}</span>
			<span className='text-void-fg-1 tabular-nums font-medium'>{fmt(value)} tokens</span>
		</div>
		<div className='h-2 rounded-full bg-void-bg-2 overflow-hidden'>
			<span className={`block h-full rounded-full ${toneBarClass(tone)}`} style={{ width: `${pct}%` }} />
		</div>
	</div>
}

const EditEfficiencyCard = ({ editCount, fullFileTokens, diffTokens }: { editCount: number, fullFileTokens: number, diffTokens: number }) => {
	const tokensSaved = Math.max(0, fullFileTokens - diffTokens)
	const pctSaved = fullFileTokens > 0 ? Math.round((tokensSaved / fullFileTokens) * 100) : 0
	return <Card className='p-4'>
		<SectionHeading subtitle='Targeted diffs vs. rewriting the whole file, for edits this app actually applied'>
			<span className='inline-flex items-center gap-1.5'><GitCompare className='size-3' />Edit Efficiency</span>
		</SectionHeading>
		{editCount === 0 ? <EmptyHint>No diff-based edits yet — this fills in as you accept AI edits.</EmptyHint> : <>
			<div className='flex items-baseline gap-2 mb-3'>
				<span className='text-2xl font-semibold tabular-nums text-green-600 dark:text-green-500'>{pctSaved}%</span>
				<span className='text-xs text-void-fg-3'>fewer tokens sent, across {fmt(editCount)} edit{editCount === 1 ? '' : 's'}</span>
			</div>
			<div className='space-y-2.5'>
				<CompareBar label='Sent as targeted diffs' value={diffTokens} max={fullFileTokens} tone='success' />
				<CompareBar label="Would've cost as full-file rewrites" value={fullFileTokens} max={fullFileTokens} tone='neutral' />
			</div>
			<div className='mt-2 text-[10px] text-void-fg-4'>~{fmt(tokensSaved)} tokens not sent, based on each file's size at the time of the edit (estimated).</div>
		</>}
	</Card>
}

const SystemOverheadCard = ({ avgSystemTokens, avgInputTokens, sampleSize }: { avgSystemTokens: number, avgInputTokens: number, sampleSize: number }) => {
	const pctOfInput = avgInputTokens > 0 ? Math.round((avgSystemTokens / avgInputTokens) * 100) : 0
	return <Card className='p-4'>
		<SectionHeading subtitle={`Avg. across your last ${fmt(sampleSize)} message${sampleSize === 1 ? '' : 's'} (estimated)`}>
			<span className='inline-flex items-center gap-1.5'><FileCode className='size-3' />System Prompt Overhead</span>
		</SectionHeading>
		{sampleSize === 0 ? <EmptyHint>No messages recorded yet.</EmptyHint> : <>
			<div className='flex items-baseline gap-2 mb-1'>
				<span className='text-2xl font-semibold tabular-nums text-void-fg-1'>{fmt(avgSystemTokens)}</span>
				<span className='text-xs text-void-fg-3'>tokens / message</span>
			</div>
			<div className='text-[11px] text-void-fg-4 mb-3'>{pctOfInput}% of the average input size — instructions, workspace context, and tool definitions the model needs on every turn.</div>
			<div className='h-1.5 rounded-full bg-void-bg-2 overflow-hidden'>
				<span className={`block h-full rounded-full ${SERIES.system.bar}`} style={{ width: `${Math.max(2, Math.min(100, pctOfInput))}%` }} />
			</div>
		</>}
	</Card>
}

// ============================================================================
// header
// ============================================================================

const TokenUsageHeader = () => (
	<div className='flex items-center gap-3 px-4 py-3.5 border-b border-void-border-2 shrink-0'>
		<span className='flex items-center justify-center size-9 rounded-lg bg-void-bg-2 border border-void-border-2 shrink-0'>
			<Coins className='size-4.5 text-void-fg-2' />
		</span>
		<div className='min-w-0'>
			<h1 className='text-base font-semibold text-void-fg-1 truncate leading-tight'>Token Usage</h1>
			<p className='text-xs text-void-fg-3 mt-0.5'>Track how many tokens your chats have used, across every conversation</p>
		</div>
	</div>
)

// ============================================================================
// main content
// ============================================================================

const TokenUsageContent = () => {
	const accessor = useAccessor()
	const tokenUsageService = accessor.get('ITokenUsageService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const chatThreadsState = useChatThreadsState()

	const [, setRerenderTick] = useState(0)
	useTokenUsageChangeListener(useCallback(() => setRerenderTick(n => n + 1), []))

	const [chartMode, setChartMode] = useState<'daily' | 'weekly' | 'monthly'>('daily')
	const [showAllRows, setShowAllRows] = useState(false)
	const tableRef = useRef<HTMLDivElement>(null)

	const today = tokenUsageService.getUsageOverLastNDays(1)
	const thisWeek = tokenUsageService.getUsageOverLastNDays(7)
	const thisMonth = tokenUsageService.getUsageOverLastNDays(30)
	const allTime = tokenUsageService.getAllTimeUsage()

	const dailyPoints7 = tokenUsageService.getDailySeries(7)
	const sparkline7 = dailyPoints7.map(p => p.inputTokens + p.outputTokens + p.systemTokens)

	const chartDays = chartMode === 'daily' ? 14 : chartMode === 'weekly' ? 70 : 365
	const dailyPointsForChart = tokenUsageService.getDailySeries(chartDays)
	const buckets = chartMode === 'daily' ? aggregateDaily(dailyPointsForChart)
		: chartMode === 'weekly' ? aggregateWeekly(dailyPointsForChart)
			: aggregateMonthly(dailyPointsForChart)

	const records = tokenUsageService.getRecentRecords()
	const editSavings = tokenUsageService.getEditSavings()

	const systemStats = useMemo(() => {
		if (records.length === 0) return { avgSystemTokens: 0, avgInputTokens: 0, sampleSize: 0 }
		const sumSystem = records.reduce((s, r) => s + r.systemTokens, 0)
		const sumInput = records.reduce((s, r) => s + r.inputTokens, 0)
		return { avgSystemTokens: sumSystem / records.length, avgInputTokens: sumInput / records.length, sampleSize: records.length }
	}, [records])

	const topUsageToday = useMemo(() => {
		const todayKey = new Date().toISOString().slice(0, 10)
		const byThread = new Map<string, { title: string, input: number, output: number }>()
		for (const r of records) {
			if (r.timestamp.slice(0, 10) !== todayKey) continue
			const e = byThread.get(r.threadId) ?? { title: r.threadTitle, input: 0, output: 0 }
			e.input += r.inputTokens
			e.output += r.outputTokens
			byThread.set(r.threadId, e)
		}
		return [...byThread.entries()]
			.map(([id, v]) => ({ id, ...v, total: v.input + v.output }))
			.sort((a, b) => b.total - a.total)
	}, [records])

	const topFour = topUsageToday.slice(0, 4)
	const otherTotal = topUsageToday.slice(4).reduce((s, c) => s + c.total, 0)
	const todayTotalForShare = today.inputTokens + today.outputTokens

	const visibleRecords = showAllRows ? records : records.slice(0, 8)

	const openThread = (threadId: string) => chatThreadsService.switchToThread(threadId)

	const exportCSV = () => {
		const header = ['Conversation', 'Model', 'Provider', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Time']
		const rows = records.map(r => [r.threadTitle, r.model, r.providerName, r.inputTokens, r.outputTokens, r.inputTokens + r.outputTokens, r.timestamp])
		const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `token-usage-${new Date().toISOString().slice(0, 10)}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	return <div className='max-w-[100rem] space-y-4'>
		{/* Row 1 — stat cards */}
		<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
			<StatCard icon={<Coins className='size-3.5' />} label='Today' window={today} target={DAY_TARGET} sparkline={sparkline7} />
			<StatCard icon={<CalendarDays className='size-3.5' />} label='This Week' window={thisWeek} target={WEEK_TARGET} sparkline={sparkline7} />
			<StatCard icon={<CalendarRange className='size-3.5' />} label='This Month' window={thisMonth} target={MONTH_TARGET} sparkline={sparkline7} />
			<StatCard icon={<Archive className='size-3.5' />} label='All Time' window={allTime} sparkline={sparkline7} sinceLabel={`Since ${new Date(allTime.since).toLocaleDateString()}`} />
		</div>

		{/* Row 2 — usage overview chart */}
		<Card className='p-4'>
			<div className='flex items-start justify-between gap-3 mb-1'>
				<SectionHeading subtitle='Input vs. output tokens over time'>Usage Overview</SectionHeading>
				<div className='flex items-center gap-0.5 bg-void-bg-2 rounded-md p-0.5 shrink-0'>
					{(['daily', 'weekly', 'monthly'] as const).map(m => (
						<button
							key={m}
							onClick={() => setChartMode(m)}
							className={`text-[11px] px-2 py-1 rounded transition-colors capitalize ${chartMode === m ? 'bg-void-bg-1-alt text-void-fg-1 font-medium shadow-sm' : 'text-void-fg-3 hover:text-void-fg-1'}`}
						>
							{m}
						</button>
					))}
				</div>
			</div>
			<div className='mb-2'><ChartLegend /></div>
			<UsageLineChart buckets={buckets} />
		</Card>

		{/* Row 3 — breakdown + top usage */}
		<div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
			<Card className='p-4'>
				<SectionHeading>Token Breakdown</SectionHeading>
				{totalOf(today) === 0 ? <EmptyHint>No usage recorded today.</EmptyHint> : <div className='flex items-center gap-5'>
					<div className='relative shrink-0'>
						<Donut segments={[{ key: 'input', value: today.inputTokens }, { key: 'output', value: today.outputTokens }, { key: 'system', value: today.systemTokens }]} />
						<div className='absolute inset-0 flex flex-col items-center justify-center'>
							<span className='text-lg font-semibold tabular-nums text-void-fg-1'>{fmt(totalOf(today))}</span>
							<span className='text-[9px] text-void-fg-4 text-center leading-tight px-2'>Total Tokens<br />Today</span>
						</div>
					</div>
					<div className='flex-1 space-y-2'>
						{(['input', 'output', 'system'] as const).map(k => {
							const value = k === 'input' ? today.inputTokens : k === 'output' ? today.outputTokens : today.systemTokens
							const pct = totalOf(today) > 0 ? Math.round((value / totalOf(today)) * 100) : 0
							return <div key={k} className='flex items-center gap-2 text-[11px]'>
								<span className={`size-2 rounded-full shrink-0 ${SERIES[k].dot}`} />
								<span className='text-void-fg-3 flex-1'>{SERIES[k].label}</span>
								<span className='text-void-fg-1 tabular-nums'>{fmt(value)}</span>
								<span className='text-void-fg-4 tabular-nums w-9 text-right'>{pct}%</span>
							</div>
						})}
					</div>
				</div>}
			</Card>

			<Card className='p-4'>
				<SectionHeading action={topUsageToday.length > 0 && (
					<button
						onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
						className='text-[11px] text-void-fg-3 hover:text-void-fg-1 transition-colors'
					>
						View all conversations →
					</button>
				)}>Top Token Usage (Today)</SectionHeading>
				{topFour.length === 0 ? <EmptyHint>No conversations today yet.</EmptyHint> : <div className='space-y-2.5'>
					{topFour.map(c => {
						const pct = todayTotalForShare > 0 ? Math.round((c.total / todayTotalForShare) * 100) : 0
						return <div key={c.id}>
							<div className='flex items-baseline justify-between gap-2 mb-1'>
								<span className='text-xs text-void-fg-2 truncate'>{c.title}</span>
								<span className='text-[11px] text-void-fg-4 tabular-nums shrink-0'>{fmt(c.total)} tokens</span>
							</div>
							<div className='h-1.5 rounded-full bg-void-bg-2 overflow-hidden'>
								<span className={`block h-full rounded-full ${SERIES.input.bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
							</div>
						</div>
					})}
					{otherTotal > 0 && <div className='flex items-center justify-between text-[11px] text-void-fg-4 pt-1'>
						<span>Other conversations</span>
						<span className='tabular-nums'>{fmt(otherTotal)} tokens</span>
					</div>}
				</div>}
			</Card>
		</div>

		{/* Row 3.5 — prompt efficiency (real, measured — not a comparison to other tools) */}
		<div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
			<EditEfficiencyCard editCount={editSavings.editCount} fullFileTokens={editSavings.fullFileTokens} diffTokens={editSavings.diffTokens} />
			<SystemOverheadCard avgSystemTokens={systemStats.avgSystemTokens} avgInputTokens={systemStats.avgInputTokens} sampleSize={systemStats.sampleSize} />
		</div>

		{/* Row 4 — conversation details table */}
		<div ref={tableRef}><Card className='p-4'>
			<div className='flex items-start justify-between gap-3 mb-1'>
				<SectionHeading>Conversation Details</SectionHeading>
				<button
					onClick={exportCSV}
					disabled={records.length === 0}
					className='flex items-center gap-1.5 text-[11px] text-void-fg-3 hover:text-void-fg-1 disabled:opacity-40 disabled:hover:text-void-fg-3 transition-colors shrink-0'
				>
					<Download className='size-3' />Export Usage Report
				</button>
			</div>
			{records.length === 0 ? <EmptyHint>No conversations recorded yet — usage will appear here once you chat.</EmptyHint> : <>
				<div className='overflow-x-auto -mx-1'>
					<table className='w-full text-xs'>
						<thead>
							<tr className='text-[10px] uppercase tracking-wide text-void-fg-4 border-b border-void-border-2'>
								<th className='text-left font-semibold px-1 py-1.5'>Conversation</th>
								<th className='text-left font-semibold px-1 py-1.5'>Model</th>
								<th className='text-right font-semibold px-1 py-1.5'>Input</th>
								<th className='text-right font-semibold px-1 py-1.5'>Output</th>
								<th className='text-right font-semibold px-1 py-1.5'>Total</th>
								<th className='text-right font-semibold px-1 py-1.5'>Time</th>
								<th className='text-right font-semibold px-1 py-1.5'>Actions</th>
							</tr>
						</thead>
						<tbody>
							{visibleRecords.map(r => (
								<tr key={r.id} className='border-b border-void-border-2 last:border-0 hover:bg-void-bg-2-hover'>
									<td className='px-1 py-1.5 max-w-[16rem]'>
										<span className='flex items-center gap-1.5 text-void-fg-1 truncate'>
											<MessageSquare className='size-3 text-void-fg-4 shrink-0' />
											<span className='truncate'>{r.threadTitle}</span>
										</span>
									</td>
									<td className='px-1 py-1.5 text-void-fg-3 font-mono text-[11px] whitespace-nowrap'>{r.model}</td>
									<td className='px-1 py-1.5 text-right text-void-fg-2 tabular-nums'>{fmt(r.inputTokens)}</td>
									<td className='px-1 py-1.5 text-right text-void-fg-2 tabular-nums'>{fmt(r.outputTokens)}</td>
									<td className='px-1 py-1.5 text-right text-void-fg-1 font-medium tabular-nums'>{fmt(r.inputTokens + r.outputTokens)}</td>
									<td className='px-1 py-1.5 text-right text-void-fg-4 whitespace-nowrap'>{fmtTime(r.timestamp)}</td>
									<td className='px-1 py-1.5 text-right'>
										{chatThreadsState.allThreads[r.threadId] && <button
											onClick={() => openThread(r.threadId)}
											className='inline-flex items-center justify-center size-5 rounded text-void-fg-4 hover:text-void-fg-1 hover:bg-void-bg-2 transition-colors'
											title='Open conversation'
										>
											<Eye className='size-3.5' />
										</button>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{records.length > visibleRecords.length && (
					<button onClick={() => setShowAllRows(true)} className='mt-2 text-[11px] text-void-fg-3 hover:text-void-fg-1 transition-colors'>
						Show {records.length - visibleRecords.length} more…
					</button>
				)}
				{showAllRows && records.length > 8 && (
					<button onClick={() => setShowAllRows(false)} className='mt-2 text-[11px] text-void-fg-3 hover:text-void-fg-1 transition-colors'>
						Show less
					</button>
				)}
			</>}
			<div className='mt-3 pt-2 border-t border-void-border-2 text-[10px] text-void-fg-4 flex items-center gap-1.5'>
				<Sparkles className='size-3' />Counts are estimated for some providers.
			</div>
		</Card></div>
	</div>
}

// ============================================================================
// top-level export — mirrors ProjectBrainDashboard.tsx's outer wrapper
// ============================================================================

const DashboardInner = () => (
	<div className='h-full w-full flex flex-col overflow-hidden bg-void-bg-1'>
		<TokenUsageHeader />
		<main className='flex-1 overflow-y-auto'>
			<div className='p-5 sm:p-6'>
				<TokenUsageContent />
			</div>
		</main>
	</div>
)

export const TokenUsageDashboard = () => {
	const isDark = useIsDark()
	return <div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
		<ErrorBoundary>
			<DashboardInner />
		</ErrorBoundary>
	</div>
}
