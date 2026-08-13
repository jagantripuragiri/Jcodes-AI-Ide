import React, { useEffect, useRef, useState } from 'react'
import { Globe, Server, KeyRound, Cog, Database, Cloud, LucideIcon } from 'lucide-react'
import { ArchitectureLayer, ArchitectureLayerId } from '../../../../common/projectBrain/projectBrainTypes.js'

// below this rendered width, the fixed 136px-wide cards at the 16.7/50/83.3% positions start
// overlapping each other — switch to the vertical list instead. Measured via ResizeObserver
// (not a Tailwind breakpoint) because the diagram sits in a flexible grid column that can be
// squeezed by a sibling panel (e.g. the layer-detail sidebar) even on a wide viewport.
const NARROW_THRESHOLD = 620

// fixed 3x3 layout so connectors can be drawn as simple straight lines instead of a full graph-layout algorithm
const POSITION: { [id in ArchitectureLayerId]: { x: number, y: number } } = {
	frontend: { x: 16.7, y: 16.7 },
	api: { x: 50, y: 16.7 },
	auth: { x: 83.3, y: 16.7 },
	services: { x: 50, y: 50 },
	database: { x: 16.7, y: 83.3 },
	external: { x: 83.3, y: 83.3 },
}

// candidate edges the fixed layout can render as a straight line; only drawn when present in the data
const CANDIDATE_EDGES: [ArchitectureLayerId, ArchitectureLayerId][] = [
	['frontend', 'api'],
	['api', 'auth'],
	['api', 'services'],
	['services', 'database'],
	['services', 'external'],
	['auth', 'services'],
]

const LAYER_STYLE: { [id in ArchitectureLayerId]: { icon: LucideIcon, bg: string, text: string, border: string } } = {
	frontend: { icon: Globe, bg: 'bg-blue-500/10', text: 'text-blue-500 dark:text-blue-400', border: 'border-blue-500/30' },
	api: { icon: Server, bg: 'bg-violet-500/10', text: 'text-violet-500 dark:text-violet-400', border: 'border-violet-500/30' },
	auth: { icon: KeyRound, bg: 'bg-amber-500/10', text: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/30' },
	services: { icon: Cog, bg: 'bg-emerald-500/10', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/30' },
	database: { icon: Database, bg: 'bg-cyan-500/10', text: 'text-cyan-500 dark:text-cyan-400', border: 'border-cyan-500/30' },
	external: { icon: Cloud, bg: 'bg-orange-500/10', text: 'text-orange-500 dark:text-orange-400', border: 'border-orange-500/30' },
}

export const ArchitectureDiagram = ({ layers, selectedId, onSelect }: {
	layers: ArchitectureLayer[], selectedId?: string, onSelect?: (id: string) => void,
}) => {
	const containerRef = useRef<HTMLDivElement>(null)
	// starts narrow so the very first paint never shows overlapping cards while ResizeObserver measures
	const [isNarrow, setIsNarrow] = useState(true)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const observer = new ResizeObserver(entries => {
			const width = entries[0]?.contentRect.width ?? 0
			if (width > 0) setIsNarrow(width < NARROW_THRESHOLD)
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	if (isNarrow) {
		return <div ref={containerRef}><ArchitectureLayerList layers={layers} selectedId={selectedId} onSelect={onSelect} /></div>
	}

	const byId = new Map(layers.map(l => [l.id, l]))

	const edges = CANDIDATE_EDGES.filter(([a, b]) => {
		const la = byId.get(a), lb = byId.get(b)
		if (!la || !lb) return false
		return la.dependsOn.includes(b) || lb.dependsOn.includes(a)
	})

	return <div ref={containerRef} className='relative w-full' style={{ height: 260 }}>
		<svg className='absolute inset-0 w-full h-full pointer-events-none' viewBox='0 0 100 100' preserveAspectRatio='none'>
			{edges.map(([a, b]) => {
				const pa = POSITION[a], pb = POSITION[b]
				return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className='stroke-void-border-1' strokeWidth={0.4} vectorEffect='non-scaling-stroke' />
			})}
		</svg>
		{layers.map(layer => {
			const pos = POSITION[layer.id]
			if (!pos) return null
			const style = LAYER_STYLE[layer.id]
			const Icon = style.icon
			const isSelected = selectedId === layer.id
			const Wrapper = onSelect ? 'button' : 'div'
			return <Wrapper
				key={layer.id}
				{...(onSelect ? { onClick: () => onSelect(layer.id) } : {})}
				className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-lg border bg-void-bg-1 px-3 py-2 text-left shadow-sm transition-colors ${isSelected ? 'border-void-border-1 ring-1 ring-void-border-1' : `${style.border} hover:bg-void-bg-2-hover`}`}
				style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: 136 }}
			>
				<span className={`shrink-0 size-6 rounded-md flex items-center justify-center ${style.bg}`}>
					<Icon className={`size-3.5 ${style.text}`} />
				</span>
				<span className='min-w-0'>
					<span className='block text-[11px] font-medium text-void-fg-1 truncate'>{layer.label}</span>
					<span className='block text-[10px] text-void-fg-4 truncate'>{layer.files.length > 0 ? `${layer.files.length} file${layer.files.length === 1 ? '' : 's'}` : (layer.deps[0] ?? 'detected')}</span>
				</span>
			</Wrapper>
		})}
	</div>
}

// narrow-card-friendly summary — a plain vertical list instead of the spatial diagram, which needs
// real width for its fixed-size, percentage-positioned boxes. Used both as ArchitectureDiagram's
// own narrow-width fallback and directly by callers (e.g. the Overview stat card) that are always narrow.
export const ArchitectureLayerList = ({ layers, selectedId, onSelect }: {
	layers: ArchitectureLayer[], selectedId?: string, onSelect?: (id: string) => void,
}) => (
	<div className='flex flex-col gap-1'>
		{layers.map(layer => {
			const style = LAYER_STYLE[layer.id]
			const Icon = style.icon
			const isSelected = selectedId === layer.id
			const Wrapper = onSelect ? 'button' : 'div'
			return <Wrapper
				key={layer.id}
				{...(onSelect ? { onClick: () => onSelect(layer.id) } : {})}
				className={`flex items-center gap-2 w-full -mx-1 px-1 py-0.5 rounded text-left transition-colors ${isSelected ? 'bg-void-bg-2' : onSelect ? 'hover:bg-void-bg-2-hover' : ''}`}
			>
				<span className={`shrink-0 size-5 rounded-md flex items-center justify-center ${style.bg}`}>
					<Icon className={`size-3 ${style.text}`} />
				</span>
				<span className='min-w-0 flex-1 text-[11px] text-void-fg-2 truncate'>{layer.label}</span>
				<span className='shrink-0 text-[10px] text-void-fg-4 tabular-nums'>{layer.files.length > 0 ? `${layer.files.length} file${layer.files.length === 1 ? '' : 's'}` : (layer.deps[0] ?? 'detected')}</span>
			</Wrapper>
		})}
	</div>
)
