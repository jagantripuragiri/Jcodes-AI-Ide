import React, { useState } from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { IssueSeverity, ProjectBrainIndex } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Badge, Card, EmptyState, StatTile, severityTone, useOpenProjectFile } from './shared.js'

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'high', 'medium', 'todo']
const SEVERITY_LABELS: { [s in IssueSeverity]: string } = { critical: 'Critical', high: 'High', medium: 'Medium', todo: 'TODO' }

export const IssuesSection = ({ index }: { index: ProjectBrainIndex }) => {
	const openFile = useOpenProjectFile()
	const [filter, setFilter] = useState<IssueSeverity | 'all'>('all')

	if (index.issues.length === 0) {
		return <EmptyState
			icon={CheckCircle2}
			tone='success'
			title='No critical issues detected'
			description='No TODOs, FIXMEs, deprecated markers, likely hardcoded secrets, or missing-test gaps were found.'
		/>
	}

	const counts: { [s in IssueSeverity]: number } = { critical: 0, high: 0, medium: 0, todo: 0 }
	for (const i of index.issues) counts[i.severity]++

	const filtered = (filter === 'all' ? index.issues : index.issues.filter(i => i.severity === filter))
		.slice()
		.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))

	return <div className='max-w-3xl'>
		<div className='grid grid-cols-4 gap-2 mb-4'>
			{SEVERITY_ORDER.map(sev => (
				<StatTile
					key={sev}
					label={SEVERITY_LABELS[sev]}
					value={counts[sev]}
					tone={severityTone(sev)}
					active={filter === sev}
					onClick={() => setFilter(f => f === sev ? 'all' : sev)}
				/>
			))}
		</div>

		<Card className='divide-y divide-void-border-2 max-h-[32rem] overflow-y-auto'>
			{filtered.length === 0
				? <div className='p-4 text-xs text-void-fg-4 italic'>No issues in this category.</div>
				: filtered.map(issue => (
					<button key={issue.id} onClick={() => openFile(issue.relPath, { line: issue.line })}
						className='group w-full text-left px-3 py-2.5 hover:bg-void-bg-2-hover transition-colors flex items-center gap-3'>
						<Badge tone={severityTone(issue.severity)}>{issue.kind}</Badge>
						<div className='min-w-0 flex-1'>
							<div className='text-xs text-void-fg-1 truncate font-mono'>{issue.snippet || '(no preview)'}</div>
							<div className='text-[11px] text-void-fg-4 mt-0.5'>{issue.relPath}:{issue.line}</div>
						</div>
						<ChevronRight className='size-3.5 shrink-0 text-void-fg-4 opacity-0 group-hover:opacity-100 transition-opacity' />
					</button>
				))}
		</Card>
	</div>
}
