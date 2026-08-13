import React from 'react'
import { Package, TriangleAlert } from 'lucide-react'
import { ProjectBrainIndex } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Badge, Card, EmptyState, SectionHeading } from './shared.js'

export const DependenciesSection = ({ index }: { index: ProjectBrainIndex }) => {
	if (index.dependencies.length === 0) {
		return <EmptyState icon={Package} title='No dependencies found' description='No package manifest was found in this workspace.' />
	}

	const sorted = [...index.dependencies].sort((a, b) => b.usedByFileCount - a.usedByFileCount || a.name.localeCompare(b.name))
	const nameCounts = new Map<string, number>()
	for (const d of index.dependencies) nameCounts.set(d.name, (nameCounts.get(d.name) ?? 0) + 1)
	const duplicates = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([name]) => name)
	const hasLockfile = index.meta.hasLockfile
	const hasWarnings = duplicates.length > 0 || !hasLockfile

	return <div className='max-w-3xl'>
		<div className='text-xs text-void-fg-3 mb-3'>{index.dependencies.length} dependencies declared</div>

		{hasWarnings && <Card className='p-3.5 mb-4 border-amber-500/30'>
			<SectionHeading>
				<span className='inline-flex items-center gap-1.5 normal-case text-xs font-medium text-void-fg-1 tracking-normal'>
					<TriangleAlert className='size-3.5 text-amber-500' /> Potential issues
				</span>
			</SectionHeading>
			<ul className='space-y-1.5 text-xs'>
				{!hasLockfile && <li className='flex items-start gap-1.5 text-amber-600 dark:text-amber-400'><span className='mt-1 size-1 rounded-full bg-current shrink-0' />No lockfile found - versions aren't pinned.</li>}
				{duplicates.map(d => <li key={d} className='flex items-start gap-1.5 text-amber-600 dark:text-amber-400'><span className='mt-1 size-1 rounded-full bg-current shrink-0' />{d} is declared in both dependencies and devDependencies.</li>)}
			</ul>
			<p className='text-[11px] text-void-fg-4 italic mt-2.5'>Not available: outdated-version and vulnerability checks require a network/registry lookup, which this build doesn't perform.</p>
		</Card>}

		<Card className='divide-y divide-void-border-2'>
			<div className='hidden sm:flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wide text-void-fg-4'>
				<span className='flex-1'>Package</span>
				<span className='w-20 text-right'>Version</span>
				<span className='w-12 text-right'>Type</span>
				<span className='w-28 text-right'>Usage</span>
				<span className='w-14 text-right'>Existed</span>
			</div>
			{sorted.map(d => (
				<div key={`${d.name}-${d.dev}`} className='flex items-center gap-3 px-3 py-2 text-xs hover:bg-void-bg-2-hover transition-colors'>
					<span className='flex-1 truncate text-void-fg-1 font-mono'>{d.name}</span>
					<span className='w-20 text-right text-void-fg-4 tabular-nums truncate'>{d.version}</span>
					<span className='w-12 text-right'><Badge tone={d.dev ? 'neutral' : 'info'}>{d.dev ? 'dev' : 'prod'}</Badge></span>
					<span className='w-28 text-right text-void-fg-3 tabular-nums'>{d.usedByFileCount} use{d.usedByFileCount === 1 ? '' : 's'}</span>
					<span className='w-14 text-right'><Badge tone={d.installed ? 'success' : 'danger'}>{d.installed ? 'Yes' : 'No'}</Badge></span>
				</div>
			))}
		</Card>
	</div>
}
