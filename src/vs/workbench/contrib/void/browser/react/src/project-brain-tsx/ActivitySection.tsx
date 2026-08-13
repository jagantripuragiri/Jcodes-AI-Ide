import React, { useState } from 'react'
import { GitCommit, History, Sparkles, TriangleAlert, X } from 'lucide-react'
import { ProjectBrainIndex, WhatChangedResult } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Badge, Card, EmptyState, SectionHeading, TimelineItem, useOpenProjectFile } from './shared.js'
import { useAccessor } from '../util/services.js'

export const ActivitySection = ({ index }: { index: ProjectBrainIndex }) => {
	const accessor = useAccessor()
	const openFile = useOpenProjectFile()
	const [whatChanged, setWhatChanged] = useState<WhatChangedResult | null>(null)

	if (index.gitActivity.length === 0) {
		return <EmptyState icon={History} title='No Git history available' description='This workspace may not be a Git repository, or has no commits yet.' />
	}

	return <div className='max-w-2xl'>
		<button
			onClick={() => setWhatChanged(accessor.get('IProjectBrainService').getWhatChanged())}
			className='mb-4 flex items-center gap-1.5 text-xs font-medium text-void-fg-1 border border-void-border-2 rounded-md px-3 py-1.5 hover:bg-void-bg-2-hover transition-colors'
		>
			<Sparkles className='size-3.5 text-void-fg-3' />
			What changed?
		</button>

		{whatChanged && <Card className='p-3.5 mb-4'>
			<SectionHeading action={<button onClick={() => setWhatChanged(null)} aria-label='Dismiss' className='text-void-fg-4 hover:text-void-fg-1 transition-colors'><X className='size-3.5' /></button>}>
				What changed?
			</SectionHeading>
			<p className='text-xs text-void-fg-1 mb-2 leading-relaxed'>{whatChanged.summary}</p>
			{whatChanged.impacted.length > 0 && <div className='space-y-1 mb-2'>
				{whatChanged.impacted.map(i => (
					<button key={i.relPath} onClick={() => openFile(i.relPath)} className='w-full flex items-center gap-2 text-left text-xs hover:bg-void-bg-2-hover rounded-md px-1.5 py-1 -mx-1.5 transition-colors'>
						<Badge tone={i.level === 'critical' ? 'danger' : i.level === 'high' ? 'warning' : 'neutral'}>{i.level}</Badge>
						<span className='truncate text-void-fg-2 font-mono'>{i.relPath}</span>
					</button>
				))}
			</div>}
			{whatChanged.concern && <p className='flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-2'>
				<TriangleAlert className='size-3.5 shrink-0 mt-0.5' /> {whatChanged.concern}
			</p>}
		</Card>}

		<Card className='p-4'>
			{index.gitActivity.map((commit, i) => (
				<TimelineItem
					key={commit.hash}
					icon={<GitCommit className='size-3' />}
					title={commit.subject}
					timestamp={`${new Date(commit.date).toLocaleString()} · ${commit.hash.slice(0, 7)}`}
					isLast={i === index.gitActivity.length - 1}
					meta={commit.filesChanged.length > 0 && <div className='mt-1.5 flex flex-wrap gap-x-2 gap-y-1'>
						{commit.filesChanged.slice(0, 6).map(f => (
							<button key={f} onClick={() => openFile(f)} className='text-[11px] text-void-fg-3 hover:text-void-fg-1 hover:underline truncate max-w-[12rem] font-mono'>{f}</button>
						))}
						{commit.filesChanged.length > 6 && <span className='text-[11px] text-void-fg-4'>+{commit.filesChanged.length - 6} more</span>}
					</div>}
				/>
			))}
		</Card>
	</div>
}
