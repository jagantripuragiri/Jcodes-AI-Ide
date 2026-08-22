// Project Brain — orchestration service.
// Owns the persisted index, drives full/incremental scans, and answers the queries the
// dashboard UI and the chat context hook need. Follows the same registerSingleton +
// Emitter/Event pattern as chatThreadService.ts / tokenUsageService.ts.

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { Delayer } from '../../../../../base/common/async.js';
import { ProxyChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';

import { IVoidSCMService } from '../../common/voidSCMTypes.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { ILLMMessageService } from '../../common/sendLLMMessageService.js';
import { FeatureName } from '../../common/voidSettingsTypes.js';
import { shouldExcludeDirectory } from '../../common/directoryStrService.js';

import {
	ProjectBrainIndex, ScanPhaseId, SCAN_PHASE_LABELS, ScannedFile, FileCategory, DecisionEntry,
	DecisionStatus, IssueEntry, WhatChangedResult, WhatChangedImpact, FileExplainResult,
	AskBrainReference, FILE_CATEGORY_LABELS, ProjectBrainStatus, ScanProgressStep, ProjectBrainNavigationRequest,
} from '../../common/projectBrain/projectBrainTypes.js';

import {
	walkWorkspaceFiles, classifyFile, detectTechStackFromPackageJson, hasAuthDependency,
	detectExternalServices, detectStateManagementLibs, buildProjectIdentity, inferPrimaryLanguage,
	extractImportSpecifiers, resolveRelativeImport, toUri, toRelPath, PackageJsonShape,
	MAX_SCAN_FILES, MAX_TEXT_SCAN_FILES, MAX_TEXT_SCAN_BYTES,
} from './projectBrainScanner.js';

import {
	scanTextForIssues, deriveMissingTestIssues, buildDependencyInfos, deriveArchitectureLayers,
	deriveDecisions, computeArchitectureHealth, computeCodeQualityHealth, computeSecurityHealth,
	computeTestingHealth, computeDependenciesHealth, computeDocumentationHealth, computeOverallHealth,
} from './projectBrainAnalyzer.js';

import { readProjectBrainIndex, writeProjectBrainIndex } from './projectBrainPersistence.js';

const INCREMENTAL_UPDATE_DEBOUNCE_MS = 1500
// disk writes are batched separately from in-memory updates so a burst of saves (e.g. a
// find-and-replace across many files) doesn't serialize+write the whole index once per file
const INDEX_WRITE_DEBOUNCE_MS = 5000
const SCAN_PHASE_ORDER: ScanPhaseId[] = [
	'detect-project-type', 'read-package-config', 'map-directories', 'classify-files', 'find-entry-points',
	'map-dependencies', 'detect-architecture', 'build-relationships', 'analyze-git-history', 'generate-insights',
]
const SOURCE_CATEGORIES: FileCategory[] = ['entry', 'component', 'service', 'api', 'model', 'auth', 'util']
const LOCKFILE_NAMES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb']

export interface ProjectBrainState {
	status: ProjectBrainStatus
	index: ProjectBrainIndex | null
	scanProgress: ScanProgressStep[]
	errorMessage: string | null
}

export interface AskBrainHandlers {
	onText: (fullTextSoFar: string) => void
	onFinalMessage: (fullText: string, references: AskBrainReference[]) => void
	onError: (message: string) => void
}

export interface ProjectBrainSearchResults {
	files: ScannedFile[]
	decisions: DecisionEntry[]
	issues: IssueEntry[]
	dependencies: ProjectBrainIndex['dependencies']
}

export interface IProjectBrainService {
	readonly _serviceBrand: undefined
	readonly onDidChangeState: Event<void>
	readonly state: ProjectBrainState
	buildBrain(): Promise<void>
	refreshBrain(): Promise<void>
	setDecisionStatus(id: string, status: DecisionStatus, note?: string): void
	getFileExplain(relPath: string): FileExplainResult | null
	getWhatChanged(): WhatChangedResult | null
	getContextSummary(userQuery: string): string | null
	search(query: string): ProjectBrainSearchResults
	askBrain(question: string, handlers: AskBrainHandlers): string | null
	abortAsk(requestId: string): void
	// cross-command -> React signal used by commands like "Show Architecture" to tell an
	// already-mounted (or about-to-mount) dashboard which tab to land on
	readonly onDidRequestNavigate: Event<ProjectBrainNavigationRequest>
	requestNavigate(nav: ProjectBrainNavigationRequest): void
}

export const IProjectBrainService = createDecorator<IProjectBrainService>('projectBrainService')

class ProjectBrainService extends Disposable implements IProjectBrainService {
	readonly _serviceBrand: undefined

	private readonly _onDidChangeState = new Emitter<void>()
	readonly onDidChangeState: Event<void> = this._onDidChangeState.event

	private readonly _onDidRequestNavigate = new Emitter<ProjectBrainNavigationRequest>()
	readonly onDidRequestNavigate: Event<ProjectBrainNavigationRequest> = this._onDidRequestNavigate.event

	private _state: ProjectBrainState = { status: 'empty', index: null, scanProgress: [], errorMessage: null }
	get state(): ProjectBrainState { return this._state }

	private readonly _scmProxy: IVoidSCMService
	private _scanPromise: Promise<void> | null = null
	private _writeDelayer: Delayer<void> | null = null

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IMainProcessService mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
	) {
		super()
		this._scmProxy = ProxyChannel.toService<IVoidSCMService>(mainProcessService.getChannel('void-channel-scm'))
		this._tryLoadPersistedIndex()
		this._registerFileWatcher()
	}

	// ---------- public API ----------

	async buildBrain(): Promise<void> {
		if (this._state.index) return
		return this._startScan()
	}

	async refreshBrain(): Promise<void> {
		return this._startScan()
	}

	setDecisionStatus(id: string, status: DecisionStatus, note?: string): void {
		const index = this._state.index
		if (!index) return
		const decision = index.decisions.find(d => d.id === id)
		if (!decision) return
		decision.status = status
		decision.userEdited = true
		if (note !== undefined) decision.note = note
		this._setState({ index: { ...index } })
		const rootURI = this._workspaceRootURI()
		if (rootURI) writeProjectBrainIndex(this.fileService, rootURI, index)
	}

	getFileExplain(relPath: string): FileExplainResult | null {
		const index = this._state.index
		if (!index) return null
		const file = index.files.find(f => f.relPath === relPath)
		if (!file) return null
		const usedBy = index.files.filter(f => f.imports.includes(relPath)).map(f => f.relPath)
		const key = this._basenameKey(relPath)
		const relatedByName = index.files.filter(f => f.relPath !== relPath && this._basenameKey(f.relPath) === key).map(f => f.relPath)
		return { relPath, category: file.category, usedBy, dependsOn: file.imports, relatedByName }
	}

	getWhatChanged(): WhatChangedResult | null {
		const index = this._state.index
		if (!index || index.gitActivity.length === 0) return null

		const changeCounts = new Map<string, number>()
		for (const commit of index.gitActivity) {
			for (const relPath of commit.filesChanged) changeCounts.set(relPath, (changeCounts.get(relPath) ?? 0) + 1)
		}

		const impacted: WhatChangedImpact[] = []
		for (const [relPath, count] of changeCounts) {
			const file = index.files.find(f => f.relPath === relPath)
			const category = file?.category ?? 'other'
			let level: WhatChangedImpact['level'] = 'medium'
			if (category === 'auth' || category === 'model') level = count > 1 ? 'critical' : 'high'
			else if (category === 'api' || category === 'service') level = 'high'
			impacted.push({ relPath, level, category })
		}
		const levelOrder = { critical: 0, high: 1, medium: 2 }
		impacted.sort((a, b) => levelOrder[a.level] - levelOrder[b.level])
		const top = impacted.slice(0, 8)

		const categoryCounts = new Map<FileCategory, number>()
		for (const i of top) categoryCounts.set(i.category, (categoryCounts.get(i.category) ?? 0) + 1)
		const dominant = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
		const summary = dominant
			? `${FILE_CATEGORY_LABELS[dominant]} changed significantly recently (${top.length} related file${top.length === 1 ? '' : 's'}).`
			: top.length > 0 ? `${top.length} file(s) changed recently.` : 'No significant recent changes detected.'

		let concern: string | null = null
		const changedRelPaths = new Set(changeCounts.keys())
		for (const impact of impacted.filter(i => i.level !== 'medium').slice(0, 5)) {
			const key = this._basenameKey(impact.relPath)
			const testFile = index.files.find(f => f.category === 'test' && this._basenameKey(f.relPath) === key)
			if (testFile && !changedRelPaths.has(testFile.relPath)) {
				concern = `${impact.relPath} changed recently but its test file (${testFile.relPath}) wasn't updated alongside it.`
				break
			}
			if (!testFile) {
				concern = `${impact.relPath} changed recently and has no corresponding test file.`
				break
			}
		}

		return { summary, impacted: top, concern }
	}

	getContextSummary(userQuery: string): string | null {
		const index = this._state.index
		if (!index) return null

		const lines: string[] = []
		lines.push(`Project: ${index.identity.name}${index.identity.description ? ' — ' + index.identity.description : ''}`)
		const stackNames = index.techStack.map(t => t.name)
		if (stackNames.length) lines.push(`Stack: ${stackNames.join(', ')}`)

		const namedDecisions = index.decisions.filter(d => d.status !== 'unknown').slice(0, 6)
		if (namedDecisions.length) {
			lines.push('Known project decisions:')
			for (const d of namedDecisions) lines.push(`- ${d.topic}: ${d.summary}${d.status === 'inferred' ? ' (inferred)' : ''}`)
		}

		const relevantFiles = this._matchRelevantFiles(userQuery, 8)
		if (relevantFiles.length) {
			lines.push('Potentially relevant files:')
			for (const f of relevantFiles) lines.push(`- ${f.relPath} (${f.category})`)
		}

		return lines.join('\n')
	}

	search(query: string): ProjectBrainSearchResults {
		const index = this._state.index
		const q = query.trim().toLowerCase()
		if (!index || !q) return { files: [], decisions: [], issues: [], dependencies: [] }
		return {
			files: index.files.filter(f => f.relPath.toLowerCase().includes(q) || f.category.includes(q)).slice(0, 50),
			decisions: index.decisions.filter(d => d.topic.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q)),
			issues: index.issues.filter(i => i.snippet.toLowerCase().includes(q) || i.relPath.toLowerCase().includes(q)).slice(0, 50),
			dependencies: index.dependencies.filter(d => d.name.toLowerCase().includes(q)),
		}
	}

	askBrain(question: string, handlers: AskBrainHandlers): string | null {
		const index = this._state.index
		if (!index) { handlers.onError('Project Brain has not been built yet.'); return null }

		const relevantFiles = this._matchRelevantFiles(question, 10)
		const references: AskBrainReference[] = relevantFiles.map(f => ({ relPath: f.relPath, reason: `classified as ${FILE_CATEGORY_LABELS[f.category]}` }))
		const contextBlock = this.getContextSummary(question) ?? ''
		const systemMessage = `You are Project Brain, J code's built-in project-understanding assistant. Answer the developer's question about THIS project using only the indexed context below - do not invent files or facts that aren't listed. Be concise and concrete. When you reference a file, use its exact relative path.\n\n${contextBlock}`

		const featureName: FeatureName = 'Chat'
		const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature[featureName]
		const modelSelectionOptions = modelSelection
			? this.voidSettingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]
			: undefined
		const { overridesOfModel } = this.voidSettingsService.state

		const requestId = this.llmMessageService.sendLLMMessage({
			messagesType: 'chatMessages',
			chatMode: 'normal',
			messages: [{ role: 'user', content: question } as const],
			modelSelection,
			modelSelectionOptions,
			overridesOfModel,
			separateSystemMessage: systemMessage,
			logging: { loggingName: 'Project Brain - Ask' },
			onText: ({ fullText }) => handlers.onText(fullText),
			onFinalMessage: ({ fullText }) => handlers.onFinalMessage(fullText, references),
			onError: ({ message }) => handlers.onError(message),
			onAbort: () => { },
		})
		return requestId
	}

	abortAsk(requestId: string): void {
		this.llmMessageService.abort(requestId)
	}

	requestNavigate(nav: ProjectBrainNavigationRequest): void {
		this._onDidRequestNavigate.fire(nav)
	}

	// ---------- scan orchestration ----------

	private _workspaceRootURI(): URI | null {
		const folders = this.workspaceContextService.getWorkspace().folders
		return folders.length > 0 ? folders[0].uri : null
	}

	private async _tryLoadPersistedIndex(): Promise<void> {
		const rootURI = this._workspaceRootURI()
		if (!rootURI) return
		const index = await readProjectBrainIndex(this.fileService, rootURI)
		if (index) this._setState({ status: 'ready', index })
	}

	private _setState(partial: Partial<ProjectBrainState>): void {
		this._state = { ...this._state, ...partial }
		this._onDidChangeState.fire()
	}

	// coalesces disk writes so a burst of index mutations (many incremental updates, or an
	// incremental update following close behind a full scan) results in one write, not one per mutation
	private _scheduleIndexWrite(rootURI: URI, index: ProjectBrainIndex): void {
		if (!this._writeDelayer) this._writeDelayer = this._register(new Delayer<void>(INDEX_WRITE_DEBOUNCE_MS))
		this._writeDelayer.trigger(async () => {
			try {
				await writeProjectBrainIndex(this.fileService, rootURI, index)
			} catch (e) {
				console.error('[Project Brain] Failed to persist index:', e)
			}
		})
	}

	private _markActive(id: ScanPhaseId): void {
		this._setState({ scanProgress: this._state.scanProgress.map(s => s.id === id ? { ...s, status: 'active' } : s) })
	}
	private _markDone(id: ScanPhaseId): void {
		this._setState({ scanProgress: this._state.scanProgress.map(s => s.id === id ? { ...s, status: 'done' } : s) })
	}

	private _startScan(): Promise<void> {
		if (this._scanPromise) return this._scanPromise
		const rootURI = this._workspaceRootURI()
		if (!rootURI) {
			this._setState({ status: 'error', errorMessage: 'No workspace folder is open.' })
			return Promise.resolve()
		}

		this._setState({
			status: 'scanning', errorMessage: null,
			scanProgress: SCAN_PHASE_ORDER.map(id => ({ id, label: SCAN_PHASE_LABELS[id], status: 'pending' })),
		})

		this._scanPromise = (async () => {
			try {
				const previousIndex = this._state.index
				const index = await this._runFullScan(rootURI, previousIndex)
				await writeProjectBrainIndex(this.fileService, rootURI, index)
				this._setState({ status: 'ready', index, errorMessage: null })
			} catch (e) {
				console.error('[Project Brain] Full scan failed:', e)
				this._setState({ status: 'error', errorMessage: e instanceof Error ? e.message : String(e) })
			} finally {
				this._scanPromise = null
			}
		})()
		return this._scanPromise
	}

	private async _runFullScan(rootURI: URI, previousIndex: ProjectBrainIndex | null): Promise<ProjectBrainIndex> {
		this._markActive('detect-project-type')
		const presentFilesLower = await this._listRootFilenames(rootURI)
		this._markDone('detect-project-type')

		this._markActive('read-package-config')
		const pkg = await this._readPackageJson(rootURI)
		const readme = await this._readReadme(rootURI, presentFilesLower)
		this._markDone('read-package-config')

		this._markActive('map-directories')
		const walk = await walkWorkspaceFiles(this.fileService, rootURI, MAX_SCAN_FILES)
		this._markDone('map-directories')

		this._markActive('classify-files')
		const files: ScannedFile[] = walk.files.map(f => ({ relPath: f.relPath, ext: f.ext, category: classifyFile(f.relPath), imports: [] }))
		this._markDone('classify-files')

		this._markActive('find-entry-points')
		this._promoteDeclaredEntryPoints(files, pkg)
		this._markDone('find-entry-points')

		// this phase also opportunistically scans file text for TODO/FIXME/secret issues (single read pass,
		// reused by the "generate-insights" phase below) to avoid reading every file from disk twice
		this._markActive('map-dependencies')
		const dependencyNames = new Set([...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})])
		const { usageCounts, issues: contentIssues } = await this._scanFileContents(rootURI, files, dependencyNames)
		const installedNames = await this._getInstalledDependencyNames(rootURI, dependencyNames)
		const dependencies = pkg ? buildDependencyInfos(pkg, 'package.json', usageCounts, installedNames) : []
		this._markDone('map-dependencies')

		this._markActive('detect-architecture')
		const techStack = pkg ? detectTechStackFromPackageJson(pkg) : []
		const authDeps = pkg ? hasAuthDependency(pkg) : []
		const externalServices = pkg ? detectExternalServices(pkg) : []
		const stateMgmtLibs = pkg ? detectStateManagementLibs(pkg) : []
		const layers = deriveArchitectureLayers({ files, techStack, authDeps, externalServices })
		this._markDone('detect-architecture')

		// relationship edges were resolved as part of the content scan above; this phase is kept
		// visible/distinct since "which files import which" is conceptually separate work the
		// scanner UI is reporting progress on
		this._markActive('build-relationships')
		const relationshipsCount = files.reduce((sum, f) => sum + f.imports.length, 0)
		this._markDone('build-relationships')

		this._markActive('analyze-git-history')
		const gitActivity = await this._tryGetGitActivity(rootURI)
		this._markDone('analyze-git-history')

		this._markActive('generate-insights')
		const issues = [...contentIssues, ...deriveMissingTestIssues(files)]
		const identity = buildProjectIdentity({
			pkg, folderName: this._folderName(rootURI), readmeFirstParagraph: readme.firstParagraph,
			presentFiles: presentFilesLower, primaryExt: inferPrimaryLanguage(walk.files),
		})
		const hasTsConfig = presentFilesLower.has('tsconfig.json')
		const hasTypeStrict = await this._checkTsStrict(rootURI, hasTsConfig)
		const hasEslintConfig = [...presentFilesLower].some(f => f.startsWith('.eslintrc') || f.startsWith('eslint.config'))
		const hasLockfile = LOCKFILE_NAMES.some(f => presentFilesLower.has(f))
		const decisions = this._mergeDecisions(previousIndex?.decisions, deriveDecisions({
			hasTsConfig, tsStrict: hasTypeStrict, hasEslintConfig, techStack, authDeps, stateMgmtLibs,
			packageJsonRelPath: pkg ? 'package.json' : null,
		}))

		const health = this._computeHealth({
			layers, files, issues, dependencies,
			hasLintConfig: hasEslintConfig, hasTypeStrict, hasManifest: !!pkg, hasLockfile,
			readmeLength: readme.content.length,
		})
		this._markDone('generate-insights')

		return {
			version: 1,
			workspaceRootRelPath: rootURI.fsPath,
			identity, techStack, files,
			directoryCounts: walk.directoryCounts,
			layers, dependencies, issues, decisions, gitActivity, health,
			meta: {
				filesIndexed: files.length,
				relationshipsCount,
				issuesCount: issues.length,
				lastFullScan: new Date().toISOString(),
				lastIncrementalUpdate: null,
				scanCapped: walk.capped,
				hasLintConfig: hasEslintConfig, hasTypeStrict, hasManifest: !!pkg, hasLockfile,
				readmeLength: readme.content.length,
			},
		}
	}

	// ---------- scan helpers ----------

	private async _listRootFilenames(rootURI: URI): Promise<Set<string>> {
		try {
			const stat = await this.fileService.resolve(rootURI, { resolveMetadata: false })
			return new Set((stat.children ?? []).map(c => c.name.toLowerCase()))
		} catch {
			return new Set()
		}
	}

	private _folderName(rootURI: URI): string {
		const path = rootURI.path.replace(/\/+$/, '')
		return path.slice(path.lastIndexOf('/') + 1) || rootURI.fsPath
	}

	private async _readPackageJson(rootURI: URI): Promise<PackageJsonShape | null> {
		try {
			const uri = URI.joinPath(rootURI, 'package.json')
			if (!(await this.fileService.exists(uri))) return null
			const content = await this.fileService.readFile(uri)
			const parsed = JSON.parse(content.value.toString())
			return parsed && typeof parsed === 'object' ? parsed as PackageJsonShape : null
		} catch {
			return null
		}
	}

	private async _getInstalledDependencyNames(rootURI: URI, dependencyNames: Set<string>): Promise<Set<string>> {
		const nodeModulesURI = URI.joinPath(rootURI, 'node_modules')
		const entries = await Promise.all(
			[...dependencyNames].map(async name => [name, await this.fileService.exists(URI.joinPath(nodeModulesURI, ...name.split('/')))] as const)
		)
		return new Set(entries.filter(([, exists]) => exists).map(([name]) => name))
	}

	private async _readReadme(rootURI: URI, presentFilesLower: Set<string>): Promise<{ content: string, firstParagraph: string | null }> {
		const candidates = ['README.md', 'Readme.md', 'readme.md', 'README', 'README.rst', 'README.txt']
		for (const name of candidates) {
			if (!presentFilesLower.has(name.toLowerCase())) continue
			try {
				const content = await this.fileService.readFile(URI.joinPath(rootURI, name))
				const text = content.value.toString()
				return { content: text, firstParagraph: this._extractFirstParagraph(text) }
			} catch { /* try next candidate casing */ }
		}
		return { content: '', firstParagraph: null }
	}

	private _extractFirstParagraph(markdown: string): string | null {
		const lines = markdown.split(/\r?\n/)
		const contentLines: string[] = []
		let started = false
		for (const line of lines) {
			const trimmed = line.trim()
			if (!started) {
				if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('![') || trimmed.startsWith('[![') || trimmed.startsWith('<')) continue
				started = true
			}
			if (trimmed === '') break
			contentLines.push(trimmed)
		}
		const paragraph = contentLines.join(' ').trim()
		if (!paragraph) return null
		return paragraph.length > 300 ? paragraph.slice(0, 297) + '...' : paragraph
	}

	private _promoteDeclaredEntryPoints(files: ScannedFile[], pkg: PackageJsonShape | null): void {
		if (!pkg) return
		const candidates: string[] = []
		if (typeof pkg.main === 'string') candidates.push(pkg.main)
		if (typeof pkg.module === 'string') candidates.push(pkg.module)
		if (typeof pkg.bin === 'string') candidates.push(pkg.bin)
		else if (pkg.bin && typeof pkg.bin === 'object') candidates.push(...Object.values(pkg.bin))

		for (const raw of candidates) {
			const normalized = raw.replace(/^\.\//, '')
			const file = files.find(f => f.relPath === normalized)
			if (file) file.category = 'entry'
		}
	}

	// single content-read pass: resolves static imports (for "used by"/dependency usage) and scans for
	// TODO/FIXME/deprecated/secret issues at the same time, so large repos aren't read from disk twice
	private async _scanFileContents(rootURI: URI, files: ScannedFile[], dependencyNames: Set<string>): Promise<{ usageCounts: Map<string, number>, issues: IssueEntry[] }> {
		const usageCounts = new Map<string, number>()
		const issues: IssueEntry[] = []
		const allRelPaths = new Set(files.map(f => f.relPath))
		const eligibleExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'])

		const priorityOf = (f: ScannedFile) => ['entry', 'api', 'auth', 'service', 'model', 'component'].includes(f.category) ? 0 : 1
		const candidates = files
			.filter(f => f.category !== 'doc' && f.category !== 'config')
			.sort((a, b) => priorityOf(a) - priorityOf(b))
			.slice(0, MAX_TEXT_SCAN_FILES)

		const CHUNK_SIZE = 25
		for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
			const chunk = candidates.slice(i, i + CHUNK_SIZE)
			await Promise.all(chunk.map(async (file) => {
				try {
					const content = await this.fileService.readFile(toUri(rootURI, file.relPath))
					if (content.value.byteLength > MAX_TEXT_SCAN_BYTES) return
					const text = content.value.toString()

					if (eligibleExts.has(file.ext)) {
						const specifiers = extractImportSpecifiers(text, file.ext)
						const seenImports = new Set<string>()
						for (const spec of specifiers) {
							if (spec.startsWith('.')) {
								const resolved = resolveRelativeImport(file.relPath, spec, allRelPaths)
								if (resolved && !seenImports.has(resolved)) { file.imports.push(resolved); seenImports.add(resolved) }
							} else {
								const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
								if (dependencyNames.has(pkgName)) usageCounts.set(pkgName, (usageCounts.get(pkgName) ?? 0) + 1)
							}
						}
					}

					issues.push(...scanTextForIssues(file.relPath, text))
				} catch {
					// unreadable (binary, race with deletion, permissions) - skip, not fatal
				}
			}))
		}

		return { usageCounts, issues }
	}

	private async _checkTsStrict(rootURI: URI, hasTsConfig: boolean): Promise<boolean> {
		if (!hasTsConfig) return false
		try {
			const content = await this.fileService.readFile(URI.joinPath(rootURI, 'tsconfig.json'))
			// tsconfig commonly has comments/trailing commas, so a strict JSON.parse can throw; a substring
			// check is good enough here since we only need a yes/no signal, not the full parsed config
			return /"strict"\s*:\s*true/.test(content.value.toString())
		} catch {
			return false
		}
	}

	private async _tryGetGitActivity(rootURI: URI) {
		try {
			const gitExists = await this.fileService.exists(URI.joinPath(rootURI, '.git'))
			if (!gitExists) return []
			return await this._scmProxy.gitRecentActivity(rootURI.fsPath, 20)
		} catch (e) {
			console.error('[Project Brain] git activity unavailable:', e)
			return []
		}
	}

	private _mergeDecisions(previous: DecisionEntry[] | undefined, fresh: DecisionEntry[]): DecisionEntry[] {
		if (!previous || previous.length === 0) return fresh
		return fresh.map(f => {
			const match = previous.find(p => p.topic === f.topic && p.userEdited)
			return match ? { ...f, status: match.status, userEdited: true, note: match.note } : f
		})
	}

	private _computeHealth(opts: {
		layers: ProjectBrainIndex['layers']
		files: ScannedFile[]
		issues: IssueEntry[]
		dependencies: ProjectBrainIndex['dependencies']
		hasLintConfig: boolean
		hasTypeStrict: boolean
		hasManifest: boolean
		hasLockfile: boolean
		readmeLength: number
	}): ProjectBrainIndex['health'] {
		const filesScanned = opts.files.length
		const sourceFilesCount = opts.files.filter(f => SOURCE_CATEGORIES.includes(f.category)).length
		const testFilesCount = opts.files.filter(f => f.category === 'test').length
		const docFilesCount = opts.files.filter(f => f.category === 'doc').length
		const critical = opts.issues.filter(i => i.severity === 'critical').length
		const high = opts.issues.filter(i => i.severity === 'high').length

		const depOccurrences = new Map<string, number>()
		for (const d of opts.dependencies) depOccurrences.set(d.name, (depOccurrences.get(d.name) ?? 0) + 1)
		const duplicateCount = [...depOccurrences.values()].filter(n => n > 1).length

		const categories = {
			architecture: computeArchitectureHealth(opts.layers, filesScanned),
			codeQuality: computeCodeQualityHealth({ filesScanned, hasLintConfig: opts.hasLintConfig, hasTypeStrict: opts.hasTypeStrict, issuesCount: opts.issues.length }),
			security: computeSecurityHealth({ filesScanned, criticalIssues: critical, highIssues: high }),
			testing: computeTestingHealth({ sourceFilesCount, testFilesCount }),
			dependencies: computeDependenciesHealth({ hasManifest: opts.hasManifest, hasLockfile: opts.hasLockfile, duplicateCount }),
			documentation: computeDocumentationHealth({ readmeLength: opts.readmeLength, docFilesCount }),
		}
		return { overall: computeOverallHealth(categories), categories }
	}

	private _basenameKey(relPath: string): string {
		const name = relPath.slice(relPath.lastIndexOf('/') + 1)
		return name.replace(/\.(test|spec)\.[jt]sx?$/i, '').replace(/\.[^.]+$/, '')
	}

	private _matchRelevantFiles(query: string, limit: number): ScannedFile[] {
		const index = this._state.index
		if (!index) return []
		const keywords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2)
		if (keywords.length === 0) return []
		const scored = index.files.map(f => {
			const lower = f.relPath.toLowerCase()
			let score = 0
			for (const kw of keywords) {
				if (lower.includes(kw)) score += 2
				if (f.category === kw) score += 1
			}
			return { f, score }
		}).filter(x => x.score > 0)
		scored.sort((a, b) => b.score - a.score)
		return scored.slice(0, limit).map(x => x.f)
	}

	// ---------- incremental updates ----------

	private _registerFileWatcher(): void {
		const delayer = this._register(new Delayer<void>(INCREMENTAL_UPDATE_DEBOUNCE_MS))
		const pending = new Set<string>()

		this._register(this.fileService.onDidFilesChange(e => {
			const rootURI = this._workspaceRootURI()
			if (!rootURI || !this._state.index) return

			const resources = [...e.rawAdded, ...e.rawUpdated, ...e.rawDeleted]
			for (const resource of resources) {
				const relPath = toRelPath(rootURI, resource)
				if (!relPath || this._isPathExcluded(relPath)) continue
				pending.add(relPath)
			}
			if (pending.size === 0) return

			delayer.trigger(async () => {
				const changed = Array.from(pending)
				pending.clear()
				try {
					await this._runIncrementalUpdate(rootURI, changed)
				} catch (err) {
					console.error('[Project Brain] Incremental update failed:', err)
				}
			})
		}))
	}

	private _isPathExcluded(relPath: string): boolean {
		return relPath.split('/').some(part => shouldExcludeDirectory(part))
	}

	private async _runIncrementalUpdate(rootURI: URI, changedRelPaths: string[]): Promise<void> {
		const index = this._state.index
		if (!index) return

		type FileUpdate =
			| { kind: 'removed', relPath: string }
			| { kind: 'skip' }
			| { kind: 'upserted', relPath: string, ext: string, category: FileCategory, imports: string[], issues: IssueEntry[] }

		// resolve/read all changed files concurrently (same chunking as the full scan) instead of
		// one-at-a-time, then apply results to the index sequentially so mutation stays race-free
		const CHUNK_SIZE = 25
		const updates: FileUpdate[] = []
		for (let i = 0; i < changedRelPaths.length; i += CHUNK_SIZE) {
			const chunk = changedRelPaths.slice(i, i + CHUNK_SIZE)
			const chunkResults = await Promise.all(chunk.map(async (relPath): Promise<FileUpdate> => {
				const uri = toUri(rootURI, relPath)
				const exists = await this.fileService.exists(uri)
				if (!exists) return { kind: 'removed', relPath }

				const stat = await this.fileService.resolve(uri, { resolveMetadata: false }).catch(() => null)
				if (!stat || stat.isDirectory) return { kind: 'skip' } // directory-level changes need a real rescan (Refresh Project Brain)

				const ext = relPath.includes('.') ? relPath.slice(relPath.lastIndexOf('.')) : ''
				const category = classifyFile(relPath)
				let issues: IssueEntry[] = []
				try {
					const content = await this.fileService.readFile(uri)
					if (content.value.byteLength <= MAX_TEXT_SCAN_BYTES) {
						issues = scanTextForIssues(relPath, content.value.toString())
					}
				} catch { /* unreadable - leave without issues */ }
				return { kind: 'upserted', relPath, ext, category, imports: [], issues }
			}))
			updates.push(...chunkResults)
		}

		for (const update of updates) {
			if (update.kind === 'skip') continue
			if (update.kind === 'removed') {
				index.files = index.files.filter(f => f.relPath !== update.relPath)
				index.issues = index.issues.filter(i => i.relPath !== update.relPath)
				continue
			}
			let file = index.files.find(f => f.relPath === update.relPath)
			if (!file) { file = { relPath: update.relPath, ext: update.ext, category: update.category, imports: update.imports }; index.files.push(file) }
			else { file.category = update.category }
			index.issues = index.issues.filter(i => i.relPath !== update.relPath)
			index.issues.push(...update.issues)
		}

		index.meta.filesIndexed = index.files.length
		index.meta.issuesCount = index.issues.length
		index.meta.lastIncrementalUpdate = new Date().toISOString()
		index.health = this._computeHealth({
			layers: index.layers, files: index.files, issues: index.issues, dependencies: index.dependencies,
			hasLintConfig: index.meta.hasLintConfig, hasTypeStrict: index.meta.hasTypeStrict,
			hasManifest: index.meta.hasManifest, hasLockfile: index.meta.hasLockfile, readmeLength: index.meta.readmeLength,
		})

		this._setState({ index: { ...index } })
		this._scheduleIndexWrite(rootURI, index)
	}
}

registerSingleton(IProjectBrainService, ProjectBrainService, InstantiationType.Delayed)
