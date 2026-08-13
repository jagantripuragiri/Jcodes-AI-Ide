import '../styles.css'
import React, { useCallback, useState } from 'react'
import {
	LayoutDashboard, Network, FolderTree, Star, Package, GitCommitHorizontal, Bug, History,
	MessageCircleQuestion, LucideIcon, Files, GitBranch,
} from 'lucide-react'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { useIsDark, useProjectBrainNavigationListener, useProjectBrainState } from '../util/services.js'
import { ProjectBrainIndex, ProjectBrainTab } from '../../../../common/projectBrain/projectBrainTypes.js'
import { ProjectBrainEmptyState } from './EmptyState.js'
import { ProjectBrainHeader } from './Header.js'
import { relativeTime } from './shared.js'
import { OverviewSection } from './OverviewSection.js'
import { ArchitectureSection } from './ArchitectureSection.js'
import { CodebaseSection } from './CodebaseSection.js'
import { ImportantFilesSection } from './ImportantFilesSection.js'
import { DependenciesSection } from './DependenciesSection.js'
import { DecisionsSection } from './DecisionsSection.js'
import { IssuesSection } from './IssuesSection.js'
import { ActivitySection } from './ActivitySection.js'
import { AskSection } from './AskSection.js'

export type NavigateFn = (tab: ProjectBrainTab, focusRelPath?: string, prefillQuestion?: string) => void

type NavItem = { id: ProjectBrainTab, label: string, icon: LucideIcon }

const OVERVIEW_ITEM: NavItem = { id: 'overview', label: 'Overview', icon: LayoutDashboard }

const NAV_GROUPS: { label: string, items: NavItem[] }[] = [
	{
		label: 'Analyze', items: [
			{ id: 'architecture', label: 'Architecture', icon: Network },
			{ id: 'codebase', label: 'Codebase Map', icon: FolderTree },
			{ id: 'dependencies', label: 'Dependencies', icon: Package },
			{ id: 'files', label: 'Important Files', icon: Star },
		]
	},
	{
		label: 'Quality', items: [
			{ id: 'decisions', label: 'Decisions', icon: GitCommitHorizontal },
			{ id: 'issues', label: 'Issues', icon: Bug },
		]
	},
	{
		label: 'Activity', items: [
			{ id: 'activity', label: 'Recent Activity', icon: History },
		]
	},
	{
		label: 'AI Assistant', items: [
			{ id: 'ask', label: 'Ask Project Brain', icon: MessageCircleQuestion },
		]
	},
]

const NavButton = ({ item, isActive, badge, onClick }: { item: NavItem, isActive: boolean, badge?: number, onClick: () => void }) => {
	const Icon = item.icon
	return <button
		onClick={onClick}
		className={`w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md text-left transition-colors ${isActive ? 'text-void-fg-1 bg-void-bg-2 font-medium' : 'text-void-fg-3 hover:bg-void-bg-2-hover hover:text-void-fg-1'}`}
	>
		<Icon className={`size-3.5 shrink-0 ${isActive ? 'text-void-fg-1' : 'text-void-fg-4'}`} />
		<span className='flex-1 truncate'>{item.label}</span>
		{!!badge && <span className={`shrink-0 text-[10px] tabular-nums rounded-full px-1.5 py-0.5 ${isActive ? 'bg-void-bg-1 text-void-fg-2' : 'bg-void-bg-2 text-void-fg-3'}`}>{badge}</span>}
	</button>
}

const BrainStatusCard = ({ index }: { index: ProjectBrainIndex }) => (
	<div className='border border-void-border-2 rounded-lg bg-void-bg-1-alt p-3 text-[11px]'>
		<div className='flex items-center gap-1.5 text-void-fg-2 font-medium mb-2'>
			<span className='inline-flex size-1.5 rounded-full bg-green-500' />
			Brain Status
		</div>
		<div className='space-y-1 text-void-fg-3'>
			<div className='flex items-center justify-between'><span className='inline-flex items-center gap-1.5'><Files className='size-3 text-void-fg-4' />Files indexed</span><span className='tabular-nums text-void-fg-2'>{index.meta.filesIndexed}</span></div>
			<div className='flex items-center justify-between'><span className='inline-flex items-center gap-1.5'><GitBranch className='size-3 text-void-fg-4' />Relationships</span><span className='tabular-nums text-void-fg-2'>{index.meta.relationshipsCount}</span></div>
			<div className='flex items-center justify-between'><span className='inline-flex items-center gap-1.5'><Bug className='size-3 text-void-fg-4' />Issues found</span><span className='tabular-nums text-void-fg-2'>{index.meta.issuesCount}</span></div>
		</div>
		<div className='mt-2 pt-2 border-t border-void-border-2 text-void-fg-4'>Last full scan {relativeTime(index.meta.lastFullScan)}</div>
	</div>
)

const DashboardInner = () => {
	const state = useProjectBrainState()
	const [tab, setTab] = useState<ProjectBrainTab>('overview')
	const [focusRelPath, setFocusRelPath] = useState<string | undefined>(undefined)
	const [prefillQuestion, setPrefillQuestion] = useState<string | undefined>(undefined)

	const navigate = useCallback<NavigateFn>((newTab, newFocusRelPath, newPrefillQuestion) => {
		setTab(newTab)
		setFocusRelPath(newFocusRelPath)
		if (newPrefillQuestion !== undefined) setPrefillQuestion(newPrefillQuestion)
	}, [])

	useProjectBrainNavigationListener(useCallback((nav) => {
		setTab(nav.tab)
		setFocusRelPath(nav.focusRelPath)
		if (nav.prefillQuestion) setPrefillQuestion(nav.prefillQuestion)
	}, []))

	const showEmptyState = state.status === 'empty' || ((state.status === 'scanning' || state.status === 'error') && !state.index)
	if (showEmptyState) return <ProjectBrainEmptyState />
	if (!state.index) return null
	const index = state.index

	return <div className='h-full w-full flex flex-col overflow-hidden bg-void-bg-1'>
		<ProjectBrainHeader index={index} onNavigate={navigate} />
		<div className='flex-1 flex overflow-hidden'>
			<nav className='w-52 shrink-0 border-r border-void-border-2 overflow-y-auto py-3 px-2.5 flex flex-col gap-4'>
				<div>
					<NavButton item={OVERVIEW_ITEM} isActive={tab === OVERVIEW_ITEM.id} onClick={() => navigate(OVERVIEW_ITEM.id)} />
				</div>
				{NAV_GROUPS.map(group => (
					<div key={group.label}>
						<div className='px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wide text-void-fg-4'>{group.label}</div>
						<div className='space-y-0.5'>
							{group.items.map(item => (
								<NavButton
									key={item.id}
									item={item}
									isActive={tab === item.id}
									badge={item.id === 'issues' ? index.issues.length : undefined}
									onClick={() => navigate(item.id)}
								/>
							))}
						</div>
					</div>
				))}
				<div className='mt-auto pt-2'>
					<BrainStatusCard index={index} />
				</div>
			</nav>
			<main role='tabpanel' className='flex-1 overflow-y-auto'>
				<div className='p-5 sm:p-6'>
					{tab === 'overview' && <OverviewSection index={index} onNavigate={navigate} />}
					{tab === 'architecture' && <ArchitectureSection index={index} />}
					{tab === 'codebase' && <CodebaseSection index={index} />}
					{tab === 'files' && <ImportantFilesSection index={index} focusRelPath={focusRelPath} onFocusFile={p => setFocusRelPath(p)} onClearFocus={() => setFocusRelPath(undefined)} />}
					{tab === 'dependencies' && <DependenciesSection index={index} />}
					{tab === 'decisions' && <DecisionsSection index={index} />}
					{tab === 'issues' && <IssuesSection index={index} />}
					{tab === 'activity' && <ActivitySection index={index} />}
					{tab === 'ask' && <AskSection prefillQuestion={prefillQuestion} />}
				</div>
			</main>
		</div>
	</div>
}

export const ProjectBrainDashboard = () => {
	const isDark = useIsDark()
	return <div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
		<ErrorBoundary>
			<DashboardInner />
		</ErrorBoundary>
	</div>
}
