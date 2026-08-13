import React, { useState } from 'react'
import { Network } from 'lucide-react'
import { ArchitectureLayer, ProjectBrainIndex } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Card, EmptyState, SectionHeading, useOpenProjectFile } from './shared.js'
import { ArchitectureDiagram } from './ArchitectureDiagram.js'

export const ArchitectureSection = ({ index }: { index: ProjectBrainIndex }) => {
	const openFile = useOpenProjectFile()
	const [selectedId, setSelectedId] = useState<string | null>(index.layers[0]?.id ?? null)
	const selected = index.layers.find(l => l.id === selectedId) ?? null

	if (index.layers.length === 0) {
		return <EmptyState
			icon={Network}
			title='Not enough signal to detect an architecture yet'
			description='Project Brain looks for frontend, API, service, auth, and database code and dependencies to build this map.'
		/>
	}

	const usedByOf = (layer: ArchitectureLayer) => index.layers.filter(l => l.dependsOn.includes(layer.id)).map(l => l.label)

	return <div className='max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6'>
		<Card className='p-4'>
			<ArchitectureDiagram layers={index.layers} selectedId={selectedId ?? undefined} onSelect={setSelectedId} />
		</Card>

		{selected && <Card className='p-4 h-fit lg:sticky lg:top-5'>
			<SectionHeading>{selected.label}</SectionHeading>

			{selected.files.length > 0 && <div className='mb-4'>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1.5'>Files</div>
				<ul className='space-y-0.5 max-h-48 overflow-y-auto'>
					{selected.files.map(f => (
						<li key={f}>
							<button onClick={() => openFile(f)} className='text-xs text-void-fg-2 hover:text-void-fg-1 hover:underline truncate block w-full text-left py-0.5'>{f}</button>
						</li>
					))}
				</ul>
			</div>}

			{selected.deps.length > 0 && <div className='mb-4'>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1.5'>Dependencies</div>
				<div className='flex flex-wrap gap-1'>
					{selected.deps.map(d => <span key={d} className='text-[11px] text-void-fg-2 bg-void-bg-2 border border-void-border-2 rounded px-1.5 py-0.5'>{d}</span>)}
				</div>
			</div>}

			<div>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1.5'>Used by</div>
				{usedByOf(selected).length > 0
					? <div className='flex flex-wrap gap-1'>{usedByOf(selected).map(l => <span key={l} className='text-[11px] text-void-fg-3 bg-void-bg-2 border border-void-border-2 rounded px-1.5 py-0.5'>{l}</span>)}</div>
					: <span className='text-[11px] text-void-fg-4 italic'>Nothing else in the detected architecture depends on this</span>}
			</div>
		</Card>}
	</div>
}
