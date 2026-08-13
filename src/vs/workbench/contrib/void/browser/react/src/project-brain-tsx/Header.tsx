import React from 'react'
import { BrainCircuit, RefreshCw, Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { useAccessor, useProjectBrainState } from '../util/services.js'
import { ProjectBrainIndex, ProjectBrainTab } from '../../../../common/projectBrain/projectBrainTypes.js'
import { HealthRing, relativeTime } from './shared.js'
import { ProjectBrainSearchBar } from './SearchBar.js'

export const ProjectBrainHeader = ({ index, onNavigate }: { index: ProjectBrainIndex, onNavigate: (tab: ProjectBrainTab, focusRelPath?: string) => void }) => {
	const accessor = useAccessor()
	const state = useProjectBrainState()

	const activeStepLabel = state.scanProgress.find(s => s.status === 'active')?.label
	const subtitle = [index.identity.primaryLanguage, index.identity.runtime].filter(Boolean).join(' · ')
	const techStackLine = index.techStack.slice(0, 6).map(t => t.name).join(' · ')

	return <div className='flex items-start justify-between gap-4 px-4 py-3.5 border-b border-void-border-2 shrink-0'>
		<div className='min-w-0 flex items-start gap-3'>
			<span className='flex items-center justify-center size-9 rounded-lg bg-void-bg-2 border border-void-border-2 shrink-0'>
				<BrainCircuit className='size-4.5 text-void-fg-2' />
			</span>
			<div className='min-w-0'>
				<h1 className='text-base font-semibold text-void-fg-1 truncate leading-tight'>{index.identity.name}</h1>
				{(techStackLine || subtitle) && <p className='text-xs text-void-fg-3 mt-0.5 truncate'>{techStackLine || subtitle}</p>}
				{index.identity.description && <p className='text-[11px] text-void-fg-4 mt-1 max-w-xl line-clamp-2'>{index.identity.description}</p>}

				<div className='flex items-center gap-2 mt-2 text-[11px]'>
					{state.status === 'scanning'
						? <span className='inline-flex items-center gap-1.5 text-void-fg-3'><Loader2 className='size-3 animate-spin' />{activeStepLabel ?? 'Updating…'}</span>
						: state.status === 'error'
							? <span className='inline-flex items-center gap-1.5 text-red-500'><TriangleAlert className='size-3' />Brain needs attention</span>
							: <span className='inline-flex items-center gap-1.5 text-void-fg-3'>
								<span className='relative flex size-1.5'>
									<span className='absolute inline-flex size-full rounded-full bg-green-500/60 animate-ping' />
									<span className='relative inline-flex size-1.5 rounded-full bg-green-500' />
								</span>
								Brain synced · updated {relativeTime(index.meta.lastIncrementalUpdate ?? index.meta.lastFullScan)}
							</span>}
				</div>
			</div>
		</div>

		<div className='flex items-center gap-3 shrink-0'>
			<ProjectBrainSearchBar index={index} onNavigate={onNavigate} compact />
			<HealthRing score={index.health.overall} size={44} />
			<div className='flex items-center gap-1.5'>
				<button
					disabled={state.status === 'scanning'}
					onClick={() => { accessor.get('IProjectBrainService').refreshBrain() }}
					aria-label='Refresh Project Brain'
					title='Refresh Project Brain'
					className='flex items-center justify-center size-7 text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-2-hover disabled:opacity-40 disabled:cursor-not-allowed border border-void-border-2 rounded-md transition-colors'
				>
					<RefreshCw className={`size-3.5 ${state.status === 'scanning' ? 'animate-spin' : ''}`} />
				</button>
				<button
					onClick={() => onNavigate('ask')}
					className='flex items-center gap-1.5 text-xs font-medium text-vscode-button-fg bg-vscode-button-bg hover:bg-vscode-button-hover-bg rounded-md pl-2 pr-2.5 py-1.5 transition-colors'
				>
					<Sparkles className='size-3.5' />
					Ask Brain
				</button>
			</div>
		</div>
	</div>
}
