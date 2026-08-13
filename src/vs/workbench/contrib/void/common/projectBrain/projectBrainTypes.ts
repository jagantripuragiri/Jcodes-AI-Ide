// Project Brain — shared data types.
// These describe the persisted index (.jcodes/brain/index.json) and are used by both
// the browser service that builds it and the React UI that renders it.

export type FileCategory =
	| 'entry'
	| 'config'
	| 'component'
	| 'service'
	| 'api'
	| 'model'
	| 'auth'
	| 'util'
	| 'test'
	| 'doc'
	| 'other'

export interface ScannedFile {
	relPath: string // posix-style, relative to the workspace root that owns it
	ext: string
	category: FileCategory
	// resolved repo-relative targets of this file's static imports/requires (best-effort regex scan, not a full AST)
	imports: string[]
}

export type TechStackKind = 'language' | 'framework' | 'database' | 'tool' | 'runtime'

export interface TechStackEntry {
	name: string
	kind: TechStackKind
	// 'manifest' = read directly from a config/manifest file, 'inferred' = guessed from dependency names/usage
	source: 'manifest' | 'inferred'
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'cargo' | 'go' | 'unknown'

export interface ProjectIdentity {
	name: string
	description: string | null
	primaryLanguage: string | null
	runtime: string | null
	packageManager: PackageManager
}

export const ARCHITECTURE_LAYER_IDS = ['frontend', 'api', 'services', 'database', 'auth', 'external'] as const
export type ArchitectureLayerId = typeof ARCHITECTURE_LAYER_IDS[number]

export interface ArchitectureLayer {
	id: ArchitectureLayerId
	label: string
	files: string[] // relPaths
	deps: string[] // dependency names backing this layer, if any
	dependsOn: ArchitectureLayerId[]
}

export interface DependencyInfo {
	name: string
	version: string
	dev: boolean
	declaredIn: string // relPath of the manifest that declared it
	usedByFileCount: number
	installed: boolean // whether the package folder exists under node_modules
}

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'todo'
export type IssueKind = 'TODO' | 'FIXME' | 'deprecated' | 'possible-secret' | 'no-tests'

export interface IssueEntry {
	id: string
	severity: IssueSeverity
	kind: IssueKind
	relPath: string
	line: number
	snippet: string
}

export type DecisionStatus = 'confirmed' | 'inferred' | 'unknown'

export interface DecisionEntry {
	id: string
	topic: string
	summary: string
	status: DecisionStatus
	evidence: string[] // relPaths or short manifest references
	userEdited: boolean
	note?: string
}

export interface GitActivityEntry {
	hash: string
	subject: string
	date: string // ISO
	filesChanged: string[] // relPaths
}

export type HealthCategoryScore = number | 'not-enough-data'

export interface HealthScore {
	overall: HealthCategoryScore
	categories: {
		architecture: HealthCategoryScore
		codeQuality: HealthCategoryScore
		security: HealthCategoryScore
		testing: HealthCategoryScore
		dependencies: HealthCategoryScore
		documentation: HealthCategoryScore
	}
}

export interface ProjectBrainMeta {
	filesIndexed: number
	relationshipsCount: number
	issuesCount: number
	lastFullScan: string | null // ISO
	lastIncrementalUpdate: string | null // ISO
	scanCapped: boolean // true if the file cap was hit and coverage is partial
	// cheap signals captured at full-scan time so incremental updates can recompute health
	// without re-reading manifests/README on every keystroke-triggered file change
	hasLintConfig: boolean
	hasTypeStrict: boolean
	hasManifest: boolean
	hasLockfile: boolean
	readmeLength: number
}

export interface ProjectBrainIndex {
	version: 1
	workspaceRootRelPath: string // fsPath of the workspace folder this index describes, for sanity-checking on load
	identity: ProjectIdentity
	techStack: TechStackEntry[]
	files: ScannedFile[]
	directoryCounts: { [dirRelPath: string]: number } // immediate-and-nested file counts, for the codebase map
	layers: ArchitectureLayer[]
	dependencies: DependencyInfo[]
	issues: IssueEntry[]
	decisions: DecisionEntry[]
	gitActivity: GitActivityEntry[]
	health: HealthScore
	meta: ProjectBrainMeta
}

export type ProjectBrainStatus = 'empty' | 'scanning' | 'ready' | 'error'

export type ScanPhaseId =
	| 'detect-project-type'
	| 'read-package-config'
	| 'map-directories'
	| 'classify-files'
	| 'find-entry-points'
	| 'map-dependencies'
	| 'detect-architecture'
	| 'build-relationships'
	| 'analyze-git-history'
	| 'generate-insights'

export interface ScanProgressStep {
	id: ScanPhaseId
	label: string
	status: 'pending' | 'active' | 'done'
}

export const FILE_CATEGORY_LABELS: { [c in FileCategory]: string } = {
	entry: 'Entry Points',
	config: 'Configuration',
	component: 'Components',
	service: 'Services',
	api: 'API',
	model: 'Data Models',
	auth: 'Authentication',
	util: 'Utilities',
	test: 'Tests',
	doc: 'Documentation',
	other: 'Other',
}

export const SCAN_PHASE_LABELS: { [id in ScanPhaseId]: string } = {
	'detect-project-type': 'Detecting project type',
	'read-package-config': 'Reading package configuration',
	'map-directories': 'Mapping directories',
	'classify-files': 'Classifying files',
	'find-entry-points': 'Finding entry points',
	'map-dependencies': 'Mapping dependencies',
	'detect-architecture': 'Detecting architecture',
	'build-relationships': 'Building relationships',
	'analyze-git-history': 'Analyzing Git history',
	'generate-insights': 'Generating insights',
}

export interface WhatChangedImpact {
	relPath: string
	level: 'critical' | 'high' | 'medium'
	category: FileCategory
}

export interface WhatChangedResult {
	summary: string
	impacted: WhatChangedImpact[]
	concern: string | null
}

export interface FileExplainResult {
	relPath: string
	category: FileCategory
	usedBy: string[] // relPaths of files that import this file
	dependsOn: string[] // relPaths this file imports
	relatedByName: string[] // same-basename siblings (eg authService.ts <-> authService.test.ts)
}

export interface AskBrainReference {
	relPath: string
	reason: string
}

export type ProjectBrainTab = 'overview' | 'architecture' | 'codebase' | 'files' | 'dependencies' | 'decisions' | 'issues' | 'activity' | 'ask'

export interface ProjectBrainNavigationRequest {
	tab: ProjectBrainTab
	focusRelPath?: string
	prefillQuestion?: string
}
