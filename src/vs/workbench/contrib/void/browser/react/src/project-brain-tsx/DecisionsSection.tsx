import React, { useState } from 'react'
import { GitCommitHorizontal } from 'lucide-react'
import { DecisionEntry, DecisionStatus, ProjectBrainIndex } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Badge, Card, EmptyState, SectionHeading, Tone } from './shared.js'
import { useAccessor } from '../util/services.js'

const STATUS_META: { [s in DecisionStatus]: { label: string, tone: Tone } } = {
	confirmed: { label: 'Confirmed', tone: 'success' },
	inferred: { label: 'Inferred', tone: 'warning' },
	unknown: { label: 'Unknown', tone: 'neutral' },
}

const DecisionCard = ({ decision }: { decision: DecisionEntry }) => {
	const accessor = useAccessor()
	const [editing, setEditing] = useState(false)
	const [note, setNote] = useState(decision.note ?? '')
	const meta = STATUS_META[decision.status]

	return <Card className='p-3.5'>
		<div className='flex items-start justify-between gap-3'>
			<div className='min-w-0'>
				<div className='text-xs font-medium text-void-fg-1'>{decision.topic}</div>
				<div className='text-xs text-void-fg-2 mt-0.5 leading-relaxed'>{decision.summary}</div>
			</div>
			<Badge tone={meta.tone}>{meta.label}</Badge>
		</div>
		{decision.evidence.length > 0 && <div className='text-[11px] text-void-fg-4 mt-2 truncate'>Evidence: {decision.evidence.join(', ')}</div>}
		{decision.note && !editing && <div className='text-xs text-void-fg-2 italic mt-2 border-l-2 border-void-border-2 pl-2'>"{decision.note}"</div>}

		<div className='flex items-center gap-3 mt-2.5'>
			{decision.status === 'inferred' && <button
				onClick={() => accessor.get('IProjectBrainService').setDecisionStatus(decision.id, 'confirmed')}
				className='text-[11px] font-medium text-green-600 dark:text-green-400 hover:underline'>Confirm</button>}
			{decision.status !== 'unknown' && <button
				onClick={() => accessor.get('IProjectBrainService').setDecisionStatus(decision.id, 'unknown')}
				className='text-[11px] text-void-fg-4 hover:text-void-fg-1 hover:underline'>Mark unknown</button>}
			<button onClick={() => setEditing(v => !v)} className='text-[11px] text-void-fg-4 hover:text-void-fg-1 hover:underline'>{editing ? 'Cancel' : decision.note ? 'Edit note' : 'Add note'}</button>
		</div>

		{editing && <div className='flex gap-2 mt-2.5'>
			<input
				value={note} onChange={e => setNote(e.target.value)} placeholder='Add a note…'
				className='flex-1 text-xs bg-void-bg-1 border border-void-border-2 rounded-md px-2.5 py-1.5 text-void-fg-1 placeholder:text-void-fg-4 focus:outline-none focus:border-void-border-1'
			/>
			<button
				onClick={() => { accessor.get('IProjectBrainService').setDecisionStatus(decision.id, decision.status, note); setEditing(false) }}
				className='text-[11px] font-medium text-void-fg-1 hover:bg-void-bg-2-hover border border-void-border-2 rounded-md px-3'>Save</button>
		</div>}
	</Card>
}

export const DecisionsSection = ({ index }: { index: ProjectBrainIndex }) => {
	if (index.decisions.length === 0) {
		return <EmptyState
			icon={GitCommitHorizontal}
			title='No architecture decisions detected'
			description='No architecture decisions could be derived from configuration, dependencies, or documentation yet.'
		/>
	}

	const groups: DecisionStatus[] = ['confirmed', 'inferred', 'unknown']

	return <div className='max-w-2xl space-y-6'>
		{groups.map(status => {
			const items = index.decisions.filter(d => d.status === status)
			if (items.length === 0) return null
			return <div key={status}>
				<SectionHeading>{STATUS_META[status].label} ({items.length})</SectionHeading>
				<div className='space-y-2'>{items.map(d => <DecisionCard key={d.id} decision={d} />)}</div>
			</div>
		})}
	</div>
}
