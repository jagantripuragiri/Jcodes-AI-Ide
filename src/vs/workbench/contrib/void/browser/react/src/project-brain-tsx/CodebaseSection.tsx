import React, { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FolderTree } from 'lucide-react'
import { ProjectBrainIndex, ScannedFile } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Badge, Card, CategoryIcon, EmptyState, useOpenProjectFile } from './shared.js'

const directChildDirs = (parentPath: string, allDirs: string[]): string[] => {
	return allDirs.filter(d => {
		if (d === '') return false
		if (parentPath === '') return !d.includes('/')
		return d.startsWith(parentPath + '/') && !d.slice(parentPath.length + 1).includes('/')
	}).sort()
}

const directChildFiles = (parentPath: string, files: ScannedFile[]): ScannedFile[] => {
	return files.filter(f => {
		const dir = f.relPath.includes('/') ? f.relPath.slice(0, f.relPath.lastIndexOf('/')) : ''
		return dir === parentPath
	}).sort((a, b) => a.relPath.localeCompare(b.relPath))
}

const DirNode = ({ path, depth, directoryCounts, allDirs, files, expanded, toggle, openFile }: {
	path: string, depth: number, directoryCounts: { [k: string]: number }, allDirs: string[], files: ScannedFile[],
	expanded: Set<string>, toggle: (p: string) => void, openFile: (relPath: string) => void,
}) => {
	const isOpen = expanded.has(path)
	const name = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
	const childDirs = directChildDirs(path, allDirs)
	const childFiles = isOpen ? directChildFiles(path, files) : []

	return <div>
		<button onClick={() => toggle(path)} style={{ paddingLeft: depth * 14 + 8 }} className='w-full flex items-center gap-1.5 text-left text-xs py-1.5 rounded-md hover:bg-void-bg-2-hover transition-colors'>
			{isOpen ? <ChevronDown className='size-3 shrink-0 text-void-fg-4' /> : <ChevronRight className='size-3 shrink-0 text-void-fg-4' />}
			{isOpen ? <FolderOpen className='size-3.5 shrink-0 text-void-fg-3' /> : <Folder className='size-3.5 shrink-0 text-void-fg-3' />}
			<span className='text-void-fg-1 truncate'>{name}/</span>
			<span className='text-void-fg-4 ml-auto pr-2 tabular-nums shrink-0'>{directoryCounts[path] ?? 0}</span>
		</button>
		{isOpen && <div>
			{childDirs.map(d => (
				<DirNode key={d} path={d} depth={depth + 1} directoryCounts={directoryCounts} allDirs={allDirs} files={files} expanded={expanded} toggle={toggle} openFile={openFile} />
			))}
			{childFiles.map(f => (
				<button key={f.relPath} onClick={() => openFile(f.relPath)} style={{ paddingLeft: (depth + 1) * 14 + 26 }}
					className='w-full flex items-center gap-1.5 text-left text-xs py-1.5 rounded-md hover:bg-void-bg-2-hover truncate transition-colors'>
					<CategoryIcon category={f.category} className='size-3 shrink-0 text-void-fg-3' />
					<span className='truncate text-void-fg-2'>{f.relPath.slice(f.relPath.lastIndexOf('/') + 1)}</span>
				</button>
			))}
		</div>}
	</div>
}

export const CodebaseSection = ({ index }: { index: ProjectBrainIndex }) => {
	const openFile = useOpenProjectFile()
	const allDirs = useMemo(() => Object.keys(index.directoryCounts).filter(d => d !== ''), [index])
	const topLevel = useMemo(() => directChildDirs('', allDirs), [allDirs])
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

	const toggle = (path: string) => {
		setExpanded(prev => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}

	const rootFiles = useMemo(() => directChildFiles('', index.files), [index])

	if (topLevel.length === 0 && rootFiles.length === 0) {
		return <EmptyState icon={FolderTree} title='No files were indexed' description='Refresh Project Brain once your workspace has files to scan.' />
	}

	return <div className='max-w-2xl'>
		<div className='flex items-center gap-2 mb-3'>
			<span className='text-xs text-void-fg-3'>{index.meta.filesIndexed} files indexed</span>
			{index.meta.scanCapped && <Badge tone='warning'>Partial scan — large repo</Badge>}
		</div>
		<Card className='p-1.5'>
			{topLevel.map(d => (
				<DirNode key={d} path={d} depth={0} directoryCounts={index.directoryCounts} allDirs={allDirs} files={index.files} expanded={expanded} toggle={toggle} openFile={openFile} />
			))}
			{rootFiles.map(f => (
				<button key={f.relPath} onClick={() => openFile(f.relPath)} className='w-full flex items-center gap-1.5 text-left text-xs py-1.5 px-2 rounded-md hover:bg-void-bg-2-hover truncate transition-colors'>
					<CategoryIcon category={f.category} className='size-3 shrink-0 text-void-fg-3' />
					<span className='truncate text-void-fg-2'>{f.relPath}</span>
				</button>
			))}
		</Card>
	</div>
}
