import React from 'react'
import { BrainCircuit, Loader2, CircleCheck, Circle } from 'lucide-react'
import { useAccessor, useProjectBrainState } from '../util/services.js'
import { VoidButtonBgDarken } from '../util/inputs.js'

export const ProjectBrainEmptyState = () => {
	const state = useProjectBrainState()
	const accessor = useAccessor()

	if (state.status === 'scanning') {
		const doneCount = state.scanProgress.filter(s => s.status === 'done').length
		return <div className='h-full flex items-center justify-center overflow-auto'>
			<div className='w-full max-w-xs px-4'>
				<div className='flex flex-col items-center gap-3 mb-6 text-center'>
					<span className='relative flex items-center justify-center size-11 rounded-full bg-void-bg-2 border border-void-border-2'>
						<BrainCircuit className='size-5 text-void-fg-2' />
						<Loader2 className='absolute -bottom-1 -right-1 size-4 text-void-fg-1 bg-void-bg-1 rounded-full animate-spin' />
					</span>
					<div>
						<div className='text-sm font-semibold text-void-fg-1'>Building Project Brain</div>
						<div className='text-[11px] text-void-fg-4 mt-0.5 tabular-nums'>{doneCount} / {state.scanProgress.length} steps complete</div>
					</div>
				</div>
				<ul className='space-y-2'>
					{state.scanProgress.map(step => (
						<li key={step.id} className='flex items-center gap-2 text-xs'>
							{step.status === 'done' ? <CircleCheck className='size-3.5 text-green-500 shrink-0' />
								: step.status === 'active' ? <Loader2 className='size-3.5 text-void-fg-2 animate-spin shrink-0' />
									: <Circle className='size-3.5 text-void-fg-4 shrink-0' />}
							<span className={step.status === 'pending' ? 'text-void-fg-4' : 'text-void-fg-1'}>{step.label}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	}

	return <div className='h-full flex items-center justify-center overflow-auto'>
		<div className='max-w-md text-center flex flex-col items-center gap-3 px-4'>
			<span className='flex items-center justify-center size-14 rounded-full bg-void-bg-2 border border-void-border-2 mb-1'>
				<BrainCircuit className='size-6 text-void-fg-3' />
			</span>
			<h2 className='text-lg font-semibold text-void-fg-1'>Project Brain</h2>
			<p className='text-sm text-void-fg-3 leading-relaxed'>
				Your project's intelligence layer. It scans your architecture, dependencies, file relationships, decisions, and important code so you don't have to explore the whole repository by hand.
			</p>
			{state.status === 'error' && state.errorMessage && (
				<p className='text-xs text-red-500'>{state.errorMessage}</p>
			)}
			<VoidButtonBgDarken className='mt-2 !rounded-md !px-4 !py-2 text-sm font-medium' onClick={() => { accessor.get('IProjectBrainService').buildBrain() }}>
				Build Project Brain
			</VoidButtonBgDarken>
			<span className='text-[11px] text-void-fg-4'>Usually takes well under a minute</span>
		</div>
	</div>
}
