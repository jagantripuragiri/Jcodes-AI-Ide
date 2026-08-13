// Project Brain — analysis layer.
// Turns raw scan output (classified files, tech stack, package manifest) into the derived
// intelligence shown in the UI: issues, health scores, architecture layers, decisions.
// Every function here is a pure transform so scores can never silently drift from their inputs.

import {
	ArchitectureLayer, ArchitectureLayerId, ARCHITECTURE_LAYER_IDS, DecisionEntry, DependencyInfo,
	FileCategory, HealthCategoryScore, HealthScore, IssueEntry, IssueKind, ScannedFile, TechStackEntry,
} from '../../common/projectBrain/projectBrainTypes.js';
import { PackageJsonShape } from './projectBrainScanner.js';

// ---------- issue scanning ----------

const SECRET_RE = /\b(api[_-]?key|secret|password|token|access[_-]?key)\s*[:=]\s*['"]([A-Za-z0-9_\-/+]{8,})['"]/i
const ENV_REF_RE = /process\.env|os\.environ|import\.meta\.env|ENV\[|getenv\(/
const FIXME_RE = /\b(FIXME|XXX)\b[:\s]*(.*)/
const DEPRECATED_RE = /@deprecated|\bdeprecated\b/i
const TODO_RE = /\bTODO\b[:\s]*(.*)/

let _issueIdCounter = 0
const nextIssueId = () => `issue-${++_issueIdCounter}`

export function scanTextForIssues(relPath: string, content: string): IssueEntry[] {
	const issues: IssueEntry[] = []
	const lines = content.split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (line.length > 500) continue // skip minified/generated lines

		const secretMatch = SECRET_RE.exec(line)
		if (secretMatch && !ENV_REF_RE.test(line)) {
			issues.push({ id: nextIssueId(), severity: 'critical', kind: 'possible-secret', relPath, line: i + 1, snippet: line.trim().slice(0, 160) })
			continue
		}
		const fixmeMatch = FIXME_RE.exec(line)
		if (fixmeMatch) {
			issues.push({ id: nextIssueId(), severity: 'high', kind: 'FIXME', relPath, line: i + 1, snippet: line.trim().slice(0, 160) })
			continue
		}
		if (DEPRECATED_RE.test(line)) {
			issues.push({ id: nextIssueId(), severity: 'medium', kind: 'deprecated', relPath, line: i + 1, snippet: line.trim().slice(0, 160) })
			continue
		}
		const todoMatch = TODO_RE.exec(line)
		if (todoMatch) {
			issues.push({ id: nextIssueId(), severity: 'todo', kind: 'TODO', relPath, line: i + 1, snippet: line.trim().slice(0, 160) })
		}
	}
	return issues
}

const TEST_RELEVANT_CATEGORIES: FileCategory[] = ['service', 'api', 'auth', 'model']

// flags source files in test-relevant categories that have no sibling test file by naming convention
export function deriveMissingTestIssues(files: ScannedFile[]): IssueEntry[] {
	const testBasenames = new Set<string>()
	for (const f of files) {
		if (f.category !== 'test') continue
		const base = f.relPath.replace(/\.(test|spec)\.[jt]sx?$/i, '').replace(/^.*\//, '')
		testBasenames.add(base)
	}
	const issues: IssueEntry[] = []
	for (const f of files) {
		if (!TEST_RELEVANT_CATEGORIES.includes(f.category)) continue
		const name = f.relPath.slice(f.relPath.lastIndexOf('/') + 1)
		const base = name.replace(/\.[jt]sx?$|\.py$/i, '')
		if (!testBasenames.has(base)) {
			issues.push({ id: nextIssueId(), severity: 'medium', kind: 'no-tests', relPath: f.relPath, line: 1, snippet: `No test file found for ${name}` })
		}
	}
	return issues
}

// ---------- dependency info ----------

export function buildDependencyInfos(pkg: PackageJsonShape, declaredIn: string, usageCounts: Map<string, number>, installedNames: Set<string>): DependencyInfo[] {
	const result: DependencyInfo[] = []
	for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
		result.push({ name, version, dev: false, declaredIn, usedByFileCount: usageCounts.get(name) ?? 0, installed: installedNames.has(name) })
	}
	for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
		result.push({ name, version, dev: true, declaredIn, usedByFileCount: usageCounts.get(name) ?? 0, installed: installedNames.has(name) })
	}
	return result
}

// ---------- architecture layers ----------

const FRONTEND_FRAMEWORKS = new Set(['React', 'Vue', 'Svelte', 'Next.js', 'Angular', 'Nuxt', 'SvelteKit'])
const API_FRAMEWORKS = new Set(['Express', 'Fastify', 'NestJS', 'Koa', 'Hapi'])
const PREFERRED_LAYER_ORDER: ArchitectureLayerId[] = ['frontend', 'api', 'auth', 'services', 'database', 'external']

export function deriveArchitectureLayers(opts: {
	files: ScannedFile[]
	techStack: TechStackEntry[]
	authDeps: string[]
	externalServices: string[]
}): ArchitectureLayer[] {
	const byCategory = (cat: FileCategory) => opts.files.filter(f => f.category === cat).map(f => f.relPath)
	const layers: ArchitectureLayer[] = []

	const frontendFiles = byCategory('component')
	const frontendDeps = opts.techStack.filter(t => FRONTEND_FRAMEWORKS.has(t.name)).map(t => t.name)
	if (frontendFiles.length > 0 || frontendDeps.length > 0) {
		layers.push({ id: 'frontend', label: 'Frontend', files: frontendFiles.slice(0, 200), deps: frontendDeps, dependsOn: [] })
	}

	const apiFiles = byCategory('api')
	const apiDeps = opts.techStack.filter(t => API_FRAMEWORKS.has(t.name)).map(t => t.name)
	if (apiFiles.length > 0 || apiDeps.length > 0) {
		layers.push({ id: 'api', label: 'API', files: apiFiles.slice(0, 200), deps: apiDeps, dependsOn: [] })
	}

	const authFiles = byCategory('auth')
	if (authFiles.length > 0 || opts.authDeps.length > 0) {
		layers.push({ id: 'auth', label: 'Authentication', files: authFiles.slice(0, 200), deps: opts.authDeps, dependsOn: [] })
	}

	const serviceFiles = byCategory('service')
	if (serviceFiles.length > 0) {
		layers.push({ id: 'services', label: 'Services', files: serviceFiles.slice(0, 200), deps: [], dependsOn: [] })
	}

	const dbDeps = opts.techStack.filter(t => t.kind === 'database').map(t => t.name)
	const modelFiles = byCategory('model')
	if (dbDeps.length > 0 || modelFiles.length > 0) {
		layers.push({ id: 'database', label: 'Database', files: modelFiles.slice(0, 200), deps: dbDeps, dependsOn: [] })
	}

	if (opts.externalServices.length > 0) {
		layers.push({ id: 'external', label: 'External Integrations', files: [], deps: opts.externalServices, dependsOn: [] })
	}

	// chain each detected layer to the next detected layer downstream, in a fixed conceptual order —
	// this is what draws the arrows in the architecture map, and only ever connects layers with real evidence
	const present = new Set(layers.map(l => l.id))
	for (const layer of layers) {
		const idx = PREFERRED_LAYER_ORDER.indexOf(layer.id)
		for (let j = idx + 1; j < PREFERRED_LAYER_ORDER.length; j++) {
			if (present.has(PREFERRED_LAYER_ORDER[j])) { layer.dependsOn = [PREFERRED_LAYER_ORDER[j]]; break }
		}
	}

	return layers
}

// ---------- decisions ----------

let _decisionIdCounter = 0
const nextDecisionId = () => `decision-${++_decisionIdCounter}`

export function deriveDecisions(opts: {
	hasTsConfig: boolean
	tsStrict: boolean
	hasEslintConfig: boolean
	techStack: TechStackEntry[]
	authDeps: string[]
	stateMgmtLibs: string[]
	packageJsonRelPath: string | null
}): DecisionEntry[] {
	const decisions: DecisionEntry[] = []

	if (opts.hasTsConfig) {
		decisions.push({
			id: nextDecisionId(), topic: 'Language', status: 'confirmed', userEdited: false,
			summary: opts.tsStrict ? 'TypeScript with strict mode enabled' : 'TypeScript',
			evidence: ['tsconfig.json'],
		})
	}
	if (opts.hasEslintConfig) {
		decisions.push({
			id: nextDecisionId(), topic: 'Linting', status: 'confirmed', userEdited: false,
			summary: 'ESLint configured for this project', evidence: ['.eslintrc'],
		})
	}
	for (const t of opts.techStack.filter(t => t.kind === 'framework')) {
		decisions.push({
			id: nextDecisionId(), topic: 'Framework', status: 'inferred', userEdited: false,
			summary: `Built with ${t.name}`, evidence: opts.packageJsonRelPath ? [opts.packageJsonRelPath] : [],
		})
	}
	for (const t of opts.techStack.filter(t => t.kind === 'database')) {
		decisions.push({
			id: nextDecisionId(), topic: 'Database', status: 'inferred', userEdited: false,
			summary: `${t.name} as the primary data store`, evidence: opts.packageJsonRelPath ? [opts.packageJsonRelPath] : [],
		})
	}
	if (opts.authDeps.length > 0) {
		decisions.push({
			id: nextDecisionId(), topic: 'Authentication', status: 'inferred', userEdited: false,
			summary: `Token/session-based authentication (via ${opts.authDeps.join(', ')})`,
			evidence: opts.packageJsonRelPath ? [opts.packageJsonRelPath] : [],
		})
	}
	for (const lib of opts.stateMgmtLibs) {
		decisions.push({
			id: nextDecisionId(), topic: 'State management', status: 'inferred', userEdited: false,
			summary: `${lib} for client-side state`, evidence: opts.packageJsonRelPath ? [opts.packageJsonRelPath] : [],
		})
	}

	return decisions
}

// ---------- health scoring ----------
// each function documents its own formula since none of these weights are "obvious" — they're
// judgment calls made explicit so the score is at least explainable, never a black box.

export function computeArchitectureHealth(layers: ArchitectureLayer[], filesScanned: number): HealthCategoryScore {
	if (filesScanned === 0) return 'not-enough-data'
	return Math.round((layers.length / ARCHITECTURE_LAYER_IDS.length) * 100)
}

export function computeCodeQualityHealth(opts: { filesScanned: number, hasLintConfig: boolean, hasTypeStrict: boolean, issuesCount: number }): HealthCategoryScore {
	if (opts.filesScanned === 0) return 'not-enough-data'
	let score = 0
	score += opts.hasLintConfig ? 40 : 0
	score += opts.hasTypeStrict ? 30 : 0
	const issuesPer100Files = (opts.issuesCount / opts.filesScanned) * 100
	score += Math.max(0, 30 - issuesPer100Files) // full 30pts under ~1 issue/100 files, tapers to 0 by 30/100
	return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeSecurityHealth(opts: { filesScanned: number, criticalIssues: number, highIssues: number }): HealthCategoryScore {
	if (opts.filesScanned === 0) return 'not-enough-data'
	const score = 100 - opts.criticalIssues * 20 - opts.highIssues * 5
	return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeTestingHealth(opts: { sourceFilesCount: number, testFilesCount: number }): HealthCategoryScore {
	if (opts.sourceFilesCount === 0) return 'not-enough-data'
	// scaled so a ~40% test-to-source file ratio already reads as a full score; most healthy repos never reach 1:1
	const ratio = opts.testFilesCount / opts.sourceFilesCount
	return Math.max(0, Math.min(100, Math.round(ratio * 250)))
}

export function computeDependenciesHealth(opts: { hasManifest: boolean, hasLockfile: boolean, duplicateCount: number }): HealthCategoryScore {
	if (!opts.hasManifest) return 'not-enough-data'
	let score = 100
	score -= opts.hasLockfile ? 0 : 20
	score -= opts.duplicateCount * 10
	return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeDocumentationHealth(opts: { readmeLength: number, docFilesCount: number }): HealthCategoryScore {
	// always computable: a missing README is itself a real signal, not absent data
	const readmeScore = opts.readmeLength === 0 ? 0 : Math.min(60, 20 + Math.floor(opts.readmeLength / 200) * 5)
	const docScore = Math.min(40, opts.docFilesCount * 8)
	return Math.max(0, Math.min(100, Math.round(readmeScore + docScore)))
}

export function computeOverallHealth(categories: HealthScore['categories']): HealthCategoryScore {
	const nums = Object.values(categories).filter((v): v is number => typeof v === 'number')
	if (nums.length === 0) return 'not-enough-data'
	return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

export const issueKindKeywords: { [k in IssueKind]: string } = {
	'TODO': 'todo', 'FIXME': 'fixme', 'deprecated': 'deprecated', 'possible-secret': 'secret', 'no-tests': 'missing test',
}
