import React from 'react'
import { ArrowLeft, Star } from 'lucide-react'
import { FileCategory, FILE_CATEGORY_LABELS, ProjectBrainIndex } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Card, CategoryIcon, EmptyState, FILE_CATEGORY_DESCRIPTIONS, SectionHeading, useOpenProjectFile } from './shared.js'
import { useAccessor } from '../util/services.js'

const IMPORTANT_CATEGORIES: FileCategory[] = ['entry', 'auth', 'api', 'model', 'config']
const MAX_PER_GROUP = 12

const FileExplainView = ({ relPath, onBack }: { relPath: string, onBack: () => void }) => {
	const accessor = useAccessor()
	const openFile = useOpenProjectFile()
	const explain = accessor.get('IProjectBrainService').getFileExplain(relPath)

	return <div className='max-w-2xl'>
		<button onClick={onBack} className='flex items-center gap-1 text-xs text-void-fg-3 hover:text-void-fg-1 mb-3 transition-colors'>
			<ArrowLeft className='size-3.5' /> All important files
		</button>

		{!explain
			? <EmptyState icon={Star} title='File not in current index' description={`${relPath} isn't in the current index — try refreshing Project Brain.`} />
			: <Card className='p-4'>
				<button onClick={() => openFile(relPath)} className='flex items-center gap-2.5 text-left hover:underline group'>
					<span className='flex items-center justify-center size-8 rounded-md bg-void-bg-2 shrink-0'>
						<CategoryIcon category={explain.category} className='size-4 text-void-fg-2' />
					</span>
					<span>
						<span className='block text-sm font-medium text-void-fg-1 font-mono'>{relPath}</span>
						<span className='block text-[11px] text-void-fg-3 mt-0.5'>{FILE_CATEGORY_LABELS[explain.category]}</span>
					</span>
				</button>

				<div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-void-border-2'>
					<div>
						<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1'>Used by</div>
						{explain.usedBy.length === 0 ? <span className='text-[11px] text-void-fg-4 italic'>No indexed file imports this</span> : (
							<ul className='space-y-0.5'>{explain.usedBy.map(p => (
								<li key={p}><button onClick={() => openFile(p)} className='text-xs text-void-fg-2 hover:text-void-fg-1 hover:underline truncate block w-full text-left font-mono'>{p}</button></li>
							))}</ul>
						)}
					</div>
					<div>
						<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1'>Depends on</div>
						{explain.dependsOn.length === 0 ? <span className='text-[11px] text-void-fg-4 italic'>No resolved local imports</span> : (
							<ul className='space-y-0.5'>{explain.dependsOn.map(p => (
								<li key={p}><button onClick={() => openFile(p)} className='text-xs text-void-fg-2 hover:text-void-fg-1 hover:underline truncate block w-full text-left font-mono'>{p}</button></li>
							))}</ul>
						)}
					</div>
					<div>
						<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1'>Related</div>
						{explain.relatedByName.length === 0 ? <span className='text-[11px] text-void-fg-4 italic'>None found</span> : (
							<ul className='space-y-0.5'>{explain.relatedByName.map(p => (
								<li key={p}><button onClick={() => openFile(p)} className='text-xs text-void-fg-2 hover:text-void-fg-1 hover:underline truncate block w-full text-left font-mono'>{p}</button></li>
							))}</ul>
						)}
					</div>
				</div>
			</Card>}
	</div>
}

export const ImportantFilesSection = ({ index, focusRelPath, onFocusFile, onClearFocus }: {
	index: ProjectBrainIndex, focusRelPath?: string, onFocusFile: (relPath: string) => void, onClearFocus: () => void,
}) => {
	const openFile = useOpenProjectFile()

	if (focusRelPath) return <FileExplainView relPath={focusRelPath} onBack={onClearFocus} />

	const groups = IMPORTANT_CATEGORIES.map(cat => ({ cat, files: index.files.filter(f => f.category === cat) })).filter(g => g.files.length > 0)

	if (groups.length === 0) {
		return <EmptyState
			icon={Star}
			title='No important entry points detected'
			description="Brain hasn't identified any key application entry points, authentication, API, data model, or config files in this project yet."
		/>
	}

	return <div className='max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4'>
		{groups.map(({ cat, files }) => (
			<ImportantFilesGroupCard key={cat} cat={cat} files={files} openFile={openFile} onFocusFile={onFocusFile} />
		))}
	</div>
}

const ImportantFilesGroupCard = ({ cat, files, openFile, onFocusFile }: {
	cat: FileCategory, files: ProjectBrainIndex['files'], openFile: (relPath: string) => void, onFocusFile: (relPath: string) => void,
}) => {
	const [expanded, setExpanded] = React.useState(false)
	const visibleFiles = expanded ? files : files.slice(0, MAX_PER_GROUP)
	const remaining = files.length - MAX_PER_GROUP

	return <Card className='p-3.5'>
		<SectionHeading subtitle={FILE_CATEGORY_DESCRIPTIONS[cat]}>
			<span className='inline-flex items-center gap-1.5 normal-case text-xs font-medium text-void-fg-1 tracking-normal'>
				<CategoryIcon category={cat} className='size-3.5' />{FILE_CATEGORY_LABELS[cat]}
				<span className='text-void-fg-4 font-normal'>· {files.length}</span>
			</span>
		</SectionHeading>
		<div className={`-mx-1 ${expanded ? 'max-h-72 overflow-y-auto' : ''}`}>
			{visibleFiles.map(f => (
				<div key={f.relPath} className='group flex items-center gap-1 rounded-md hover:bg-void-bg-2-hover transition-colors'>
					<button onClick={() => openFile(f.relPath)} className='flex-1 min-w-0 text-left text-xs font-mono text-void-fg-2 group-hover:text-void-fg-1 truncate px-2.5 py-1.5'>
						{f.relPath}
					</button>
					<button
						onClick={() => onFocusFile(f.relPath)}
						className='shrink-0 text-[10px] text-void-fg-4 hover:text-void-fg-1 px-2 py-1 mr-1 rounded hover:bg-void-bg-2 opacity-0 group-hover:opacity-100 transition-opacity'
					>
						Explain
					</button>
				</div>
			))}
		</div>
		{remaining > 0 && (
			expanded
				? <button onClick={() => setExpanded(false)} className='text-[11px] text-void-fg-4 hover:text-void-fg-1 mt-1 px-2.5 py-1 transition-colors'>Show less</button>
				: <button onClick={() => setExpanded(true)} className='text-[11px] text-void-fg-4 hover:text-void-fg-1 mt-1 px-2.5 py-1 transition-colors'>+{remaining} more</button>
		)}
	</Card>
}
