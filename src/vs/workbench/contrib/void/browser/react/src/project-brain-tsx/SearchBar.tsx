import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAccessor } from '../util/services.js'
import { ProjectBrainIndex, ProjectBrainTab } from '../../../../common/projectBrain/projectBrainTypes.js'
import { CategoryIcon, Kbd } from './shared.js'

export const ProjectBrainSearchBar = ({ index, onNavigate, compact = false }: { index: ProjectBrainIndex, onNavigate: (tab: ProjectBrainTab, focusRelPath?: string) => void, compact?: boolean }) => {
	const accessor = useAccessor()
	const [query, setQuery] = useState('')
	const [focused, setFocused] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				inputRef.current?.focus()
			} else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
				setQuery('')
				inputRef.current?.blur()
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [])

	const results = useMemo(() => {
		if (!query.trim()) return null
		return accessor.get('IProjectBrainService').search(query)
	}, [query, accessor, index])

	const showResults = focused && results !== null
	const hasResults = results && (results.files.length > 0 || results.decisions.length > 0 || results.issues.length > 0 || results.dependencies.length > 0)

	const go = (tab: ProjectBrainTab, focusRelPath?: string) => {
		onNavigate(tab, focusRelPath)
		setQuery('')
		inputRef.current?.blur()
	}

	return <div className={compact ? 'relative shrink-0' : 'relative px-4 py-2.5 border-b border-void-border-2 shrink-0'}>
		<div className={`relative flex items-center rounded-md border bg-void-bg-1 transition-colors ${compact ? 'w-56' : 'max-w-md'} ${focused ? 'border-void-border-1 ring-1 ring-void-border-1' : 'border-void-border-2'}`}>
			<Search className='size-3.5 text-void-fg-4 absolute left-2.5 pointer-events-none' />
			<input
				ref={inputRef}
				value={query}
				onChange={e => setQuery(e.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => setTimeout(() => setFocused(false), 150)}
				placeholder='Search Project Brain…'
				aria-label='Search Project Brain'
				className='w-full text-xs bg-transparent pl-8 pr-14 py-1.5 text-void-fg-1 placeholder:text-void-fg-4 focus:outline-none'
			/>
			<div className='absolute right-2 flex items-center gap-1'>
				{query
					? <button onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label='Clear search' className='text-void-fg-4 hover:text-void-fg-1 p-0.5'>
						<X className='size-3.5' />
					</button>
					: <span className='hidden sm:inline-flex items-center gap-0.5' aria-hidden='true'><Kbd>⌘</Kbd><Kbd>K</Kbd></span>}
			</div>
		</div>

		{showResults && <div className={`absolute z-20 mt-1.5 max-h-96 overflow-y-auto bg-void-bg-1-alt border border-void-border-2 rounded-lg shadow-lg p-1.5 ${compact ? 'w-80 right-0' : 'w-full max-w-md'}`}>
			{!hasResults && <div className='text-xs text-void-fg-4 italic px-2 py-2'>No matches for "{query}"</div>}

			{results!.files.length > 0 && <div className='mb-1.5'>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 px-2 mb-0.5'>Files</div>
				{results!.files.slice(0, 8).map(f => (
					<button key={f.relPath} onClick={() => go('files', f.relPath)}
						className='w-full flex items-center gap-1.5 text-left text-xs px-2 py-1.5 rounded hover:bg-void-bg-2-hover truncate'>
						<CategoryIcon category={f.category} className='size-3 shrink-0 text-void-fg-3' />
						<span className='truncate'>{f.relPath}</span>
					</button>
				))}
			</div>}

			{results!.decisions.length > 0 && <div className='mb-1.5'>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 px-2 mb-0.5'>Decisions</div>
				{results!.decisions.slice(0, 5).map(d => (
					<button key={d.id} onClick={() => go('decisions')}
						className='w-full text-left text-xs px-2 py-1.5 rounded hover:bg-void-bg-2-hover truncate'>
						{d.topic}: {d.summary}
					</button>
				))}
			</div>}

			{results!.issues.length > 0 && <div className='mb-1.5'>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 px-2 mb-0.5'>Issues</div>
				{results!.issues.slice(0, 5).map(i => (
					<button key={i.id} onClick={() => go('issues')}
						className='w-full text-left text-xs px-2 py-1.5 rounded hover:bg-void-bg-2-hover truncate'>
						{i.kind} · {i.relPath}:{i.line}
					</button>
				))}
			</div>}

			{results!.dependencies.length > 0 && <div>
				<div className='text-[10px] uppercase tracking-wide text-void-fg-4 px-2 mb-0.5'>Dependencies</div>
				{results!.dependencies.slice(0, 5).map(d => (
					<button key={d.name} onClick={() => go('dependencies')}
						className='w-full text-left text-xs px-2 py-1.5 rounded hover:bg-void-bg-2-hover truncate'>
						{d.name} <span className='text-void-fg-4'>{d.version}</span>
					</button>
				))}
			</div>}
		</div>}
	</div>
}
