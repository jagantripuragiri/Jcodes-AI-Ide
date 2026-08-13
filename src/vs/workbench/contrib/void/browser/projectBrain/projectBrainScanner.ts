// Project Brain — repository scanner.
// Pure(ish) functions that walk the workspace, classify files, detect the tech stack, and
// do a best-effort static import scan. No persistence or service-state concerns live here.

import { URI } from '../../../../../base/common/uri.js';
import { IFileService, IFileStat } from '../../../../../platform/files/common/files.js';
import { shouldExcludeDirectory, resolveChildren } from '../../common/directoryStrService.js';
import { FileCategory, TechStackEntry, ProjectIdentity, PackageManager } from '../../common/projectBrain/projectBrainTypes.js';

export const MAX_SCAN_FILES = 5000
export const MAX_TEXT_SCAN_FILES = 3000
export const MAX_TEXT_SCAN_BYTES = 300_000 // skip reading contents of anything bigger than this

// ---------- directory walk ----------

export interface WalkedFile {
	relPath: string // posix-style, relative to the scanned root
	ext: string
	uri: URI
}

export interface WalkResult {
	files: WalkedFile[]
	directoryCounts: { [dirRelPath: string]: number } // '' = total file count for the whole root
	capped: boolean
}

const extnameOf = (name: string): string => {
	const i = name.lastIndexOf('.')
	return i > 0 ? name.slice(i).toLowerCase() : ''
}

const bumpDirectoryCounts = (directoryCounts: { [key: string]: number }, fileRelPath: string) => {
	const parts = fileRelPath.split('/')
	parts.pop() // drop the filename
	directoryCounts[''] = (directoryCounts[''] ?? 0) + 1
	let dir = ''
	for (const part of parts) {
		dir = dir ? `${dir}/${part}` : part
		directoryCounts[dir] = (directoryCounts[dir] ?? 0) + 1
	}
}

export async function walkWorkspaceFiles(fileService: IFileService, rootURI: URI, maxFiles: number = MAX_SCAN_FILES): Promise<WalkResult> {
	const result: WalkResult = { files: [], directoryCounts: {}, capped: false }

	const visitAll = async (folderStat: IFileStat, relPrefix: string): Promise<boolean> => {
		if (result.files.length >= maxFiles) { result.capped = true; return false }
		if (!folderStat.isDirectory || !folderStat.children) return true
		try {
			const children = await resolveChildren(folderStat.children, fileService)

			for (const child of children) {
				if (child.isDirectory || child.isSymbolicLink) continue
				const relPath = relPrefix ? `${relPrefix}/${child.name}` : child.name
				result.files.push({ relPath, ext: extnameOf(child.name), uri: child.resource })
				bumpDirectoryCounts(result.directoryCounts, relPath)
				if (result.files.length >= maxFiles) { result.capped = true; return false }
			}

			for (const child of children) {
				if (!child.isDirectory || child.isSymbolicLink) continue
				if (shouldExcludeDirectory(child.name)) continue
				const relPath = relPrefix ? `${relPrefix}/${child.name}` : child.name
				const shouldContinue = await visitAll(child, relPath)
				if (!shouldContinue) return false
			}
			return true
		} catch (e) {
			console.error(`[Project Brain] Error scanning ${folderStat.resource.fsPath}:`, e)
			return true
		}
	}

	const rootStat = await fileService.resolve(rootURI)
	await visitAll(rootStat, '')
	return result
}

export const toUri = (rootURI: URI, relPath: string): URI => URI.joinPath(rootURI, ...relPath.split('/'))

// inverse of toUri: null if resource isn't actually under rootURI (different scheme, different root, etc)
export const toRelPath = (rootURI: URI, resource: URI): string | null => {
	if (resource.scheme !== rootURI.scheme) return null
	const rootPath = rootURI.path.endsWith('/') ? rootURI.path : rootURI.path + '/'
	if (!resource.path.startsWith(rootPath)) return null
	return resource.path.slice(rootPath.length)
}

// ---------- file classification ----------

const TEST_RE = /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[jt]sx?$|_test\.py$|test_.*\.py$/i
const DOC_RE = /\.(md|mdx)$/i
const DOC_NAME_RE = /^(readme|changelog|license|contributing|code_of_conduct)(\.|$)/i
const CONFIG_NAME_RE = /^(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig.*\.json|\.eslintrc.*|\.env.*|webpack\.config\..*|vite\.config\..*|next\.config\..*|tailwind\.config\..*|dockerfile|docker-compose.*\.ya?ml|requirements\.txt|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml|build\.gradle.*|\.gitignore|\.jcodesrules|\.voidrules)$/i
const CONFIG_EXT_RE = /\.(config)\.(js|ts|cjs|mjs)$/i
const ENTRY_NAME_RE = /^(index|main|app|server)\.(ts|tsx|js|jsx|mjs|py|go|rs)$/i
const AUTH_RE = /(^|[/_.-])auth(?!or)(entication|orization)?([/_.-]|$)|(^|[/_.-])(jwt|login|logout|session)([/_.-]|$)/i
const API_RE = /(^|\/)(routes?|controllers?|api)(\/|$)|\.(controller|route|routes)\.[jt]sx?$/i
const MODEL_RE = /(^|\/)(models?|schema|migrations?)(\/|$)|\.(model|entity)\.[jt]sx?$|schema\.(sql|prisma)$/i
const SERVICE_RE = /(^|\/)(services?)(\/|$)|\.service\.[jt]sx?$/i
const COMPONENT_RE = /(^|\/)(components?|pages?|views?)(\/|$)/i
const COMPONENT_EXT_RE = /\.(tsx|jsx|vue|svelte)$/i
const UTIL_RE = /(^|\/)(utils?|helpers?|lib)(\/|$)/i

export function classifyFile(relPath: string): FileCategory {
	const lower = relPath.toLowerCase()
	const name = lower.slice(lower.lastIndexOf('/') + 1)

	if (TEST_RE.test(lower)) return 'test'
	if (DOC_RE.test(name) || DOC_NAME_RE.test(name)) return 'doc'
	if (CONFIG_NAME_RE.test(name) || CONFIG_EXT_RE.test(name)) return 'config'
	// entry points only count near the top of a source tree, otherwise "index.ts" barrel files everywhere would all match
	if (ENTRY_NAME_RE.test(name) && lower.split('/').length <= 3) return 'entry'
	if (AUTH_RE.test(lower)) return 'auth'
	if (API_RE.test(lower)) return 'api'
	if (MODEL_RE.test(lower)) return 'model'
	if (SERVICE_RE.test(lower)) return 'service'
	if (COMPONENT_RE.test(lower) || COMPONENT_EXT_RE.test(name)) return 'component'
	if (UTIL_RE.test(lower)) return 'util'
	return 'other'
}

// ---------- tech stack / identity detection ----------

export interface PackageJsonShape {
	name?: string
	description?: string
	main?: string
	module?: string
	bin?: string | Record<string, string>
	scripts?: Record<string, string>
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
}

const FRAMEWORK_DEP_MAP: { [dep: string]: string } = {
	'react': 'React', 'next': 'Next.js', 'vue': 'Vue', 'nuxt': 'Nuxt',
	'svelte': 'Svelte', '@sveltejs/kit': 'SvelteKit', '@angular/core': 'Angular',
	'express': 'Express', 'fastify': 'Fastify', '@nestjs/core': 'NestJS', 'koa': 'Koa',
	'hapi': 'Hapi', 'django': 'Django', 'flask': 'Flask',
}
const DATABASE_DEP_MAP: { [dep: string]: string } = {
	'pg': 'PostgreSQL', 'pg-promise': 'PostgreSQL', 'postgres': 'PostgreSQL',
	'mysql': 'MySQL', 'mysql2': 'MySQL', 'mongodb': 'MongoDB', 'mongoose': 'MongoDB',
	'redis': 'Redis', 'ioredis': 'Redis', 'sqlite3': 'SQLite', 'better-sqlite3': 'SQLite',
}
const ORM_DEP_MAP: { [dep: string]: string } = {
	'prisma': 'Prisma', '@prisma/client': 'Prisma', 'typeorm': 'TypeORM', 'sequelize': 'Sequelize', 'drizzle-orm': 'Drizzle',
}
const TOOL_DEP_MAP: { [dep: string]: string } = {
	'typescript': 'TypeScript', 'tailwindcss': 'Tailwind CSS', 'jest': 'Jest', 'vitest': 'Vitest',
	'mocha': 'Mocha', 'eslint': 'ESLint', 'webpack': 'Webpack', 'vite': 'Vite', 'graphql': 'GraphQL',
}
const AUTH_DEP_NAMES = new Set(['jsonwebtoken', 'jose', 'bcrypt', 'bcryptjs', 'argon2', 'passport', 'next-auth'])
const EXTERNAL_SERVICE_DEP_MAP: { [dep: string]: string } = {
	'stripe': 'Stripe', 'twilio': 'Twilio', '@sendgrid/mail': 'SendGrid', 'aws-sdk': 'AWS',
	'@aws-sdk/client-s3': 'AWS S3', 'openai': 'OpenAI', '@anthropic-ai/sdk': 'Anthropic',
	'firebase': 'Firebase', 'firebase-admin': 'Firebase', 'algoliasearch': 'Algolia', '@sentry/node': 'Sentry', '@sentry/react': 'Sentry',
}
const STATE_MGMT_DEP_MAP: { [dep: string]: string } = {
	'zustand': 'Zustand', 'redux': 'Redux', '@reduxjs/toolkit': 'Redux Toolkit', 'mobx': 'MobX',
	'recoil': 'Recoil', 'jotai': 'Jotai', 'pinia': 'Pinia', 'vuex': 'Vuex', 'xstate': 'XState',
}

export function detectTechStackFromPackageJson(pkg: PackageJsonShape): TechStackEntry[] {
	const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
	const entries: TechStackEntry[] = []
	const seen = new Set<string>()
	const add = (name: string, kind: TechStackEntry['kind'], source: TechStackEntry['source']) => {
		if (seen.has(name)) return
		seen.add(name)
		entries.push({ name, kind, source })
	}
	for (const dep of Object.keys(deps)) {
		if (FRAMEWORK_DEP_MAP[dep]) add(FRAMEWORK_DEP_MAP[dep], 'framework', 'manifest')
		if (DATABASE_DEP_MAP[dep]) add(DATABASE_DEP_MAP[dep], 'database', 'manifest')
		if (ORM_DEP_MAP[dep]) add(ORM_DEP_MAP[dep], 'tool', 'manifest')
		if (TOOL_DEP_MAP[dep]) add(TOOL_DEP_MAP[dep], 'tool', 'manifest')
	}
	return entries
}

export function hasAuthDependency(pkg: PackageJsonShape): string[] {
	const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
	return Object.keys(deps).filter(d => AUTH_DEP_NAMES.has(d))
}

export function detectExternalServices(pkg: PackageJsonShape): string[] {
	const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
	const found: string[] = []
	for (const dep of Object.keys(deps)) if (EXTERNAL_SERVICE_DEP_MAP[dep]) found.push(EXTERNAL_SERVICE_DEP_MAP[dep])
	return found
}

export function detectStateManagementLibs(pkg: PackageJsonShape): string[] {
	const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
	const found: string[] = []
	for (const dep of Object.keys(deps)) if (STATE_MGMT_DEP_MAP[dep]) found.push(STATE_MGMT_DEP_MAP[dep])
	return found
}

export function detectPackageManager(presentFiles: Set<string>): PackageManager {
	if (presentFiles.has('bun.lockb')) return 'bun'
	if (presentFiles.has('pnpm-lock.yaml')) return 'pnpm'
	if (presentFiles.has('yarn.lock')) return 'yarn'
	if (presentFiles.has('package-lock.json')) return 'npm'
	if (presentFiles.has('requirements.txt') || presentFiles.has('pyproject.toml')) return 'pip'
	if (presentFiles.has('cargo.toml')) return 'cargo'
	if (presentFiles.has('go.mod')) return 'go'
	return 'unknown'
}

export function detectRuntime(presentFiles: Set<string>, packageManager: PackageManager): string | null {
	if (packageManager === 'bun') return 'Bun'
	if (presentFiles.has('deno.json') || presentFiles.has('deno.jsonc')) return 'Deno'
	if (presentFiles.has('package.json')) return 'Node.js'
	if (presentFiles.has('go.mod')) return 'Go'
	if (presentFiles.has('cargo.toml')) return 'Rust'
	if (presentFiles.has('requirements.txt') || presentFiles.has('pyproject.toml')) return 'Python'
	return null
}

export function buildProjectIdentity(opts: {
	pkg: PackageJsonShape | null
	folderName: string
	readmeFirstParagraph: string | null
	presentFiles: Set<string>
	primaryExt: string | null
}): ProjectIdentity {
	const packageManager = detectPackageManager(opts.presentFiles)
	return {
		name: opts.pkg?.name || opts.folderName,
		description: opts.pkg?.description || opts.readmeFirstParagraph || null,
		primaryLanguage: opts.primaryExt,
		runtime: detectRuntime(opts.presentFiles, packageManager),
		packageManager,
	}
}

// language inference from the extension distribution of scanned files
const EXT_TO_LANGUAGE: { [ext: string]: string } = {
	'.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript',
	'.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP',
	'.c': 'C', '.cpp': 'C++', '.cs': 'C#', '.swift': 'Swift', '.kt': 'Kotlin',
}
export function inferPrimaryLanguage(files: WalkedFile[]): string | null {
	const counts: { [lang: string]: number } = {}
	for (const f of files) {
		const lang = EXT_TO_LANGUAGE[f.ext]
		if (lang) counts[lang] = (counts[lang] ?? 0) + 1
	}
	let best: string | null = null
	let bestCount = 0
	for (const lang in counts) {
		if (counts[lang] > bestCount) { best = lang; bestCount = counts[lang] }
	}
	return best
}

// ---------- static import scan (best-effort regex, not a full AST) ----------

const JS_IMPORT_RE = /\bimport\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
const PY_IMPORT_RE = /^\s*(?:from\s+([.\w]+)\s+import\s+\w|import\s+([.\w]+))/gm

export function extractImportSpecifiers(content: string, ext: string): string[] {
	const specifiers: string[] = []
	if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
		for (const m of content.matchAll(JS_IMPORT_RE)) {
			const spec = m[1] || m[2] || m[3]
			if (spec) specifiers.push(spec)
		}
	} else if (ext === '.py') {
		for (const m of content.matchAll(PY_IMPORT_RE)) {
			const spec = m[1] || m[2]
			if (spec) specifiers.push(spec)
		}
	}
	return specifiers
}

const RESOLVE_CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '.py']

// resolves a relative import specifier (./foo, ../bar) against the importing file's directory into one of the
// scanned repo-relative paths; returns null for bare/package specifiers or anything that can't be resolved
export function resolveRelativeImport(fromRelPath: string, specifier: string, allRelPaths: Set<string>): string | null {
	if (!specifier.startsWith('.')) return null
	const fromDir = fromRelPath.includes('/') ? fromRelPath.slice(0, fromRelPath.lastIndexOf('/')) : ''
	const parts = (fromDir ? fromDir.split('/') : []).concat(specifier.split('/'))
	const resolvedParts: string[] = []
	for (const part of parts) {
		if (part === '.' || part === '') continue
		if (part === '..') resolvedParts.pop()
		else resolvedParts.push(part)
	}
	const base = resolvedParts.join('/')
	for (const suffix of RESOLVE_CANDIDATE_SUFFIXES) {
		const candidate = base + suffix
		if (allRelPaths.has(candidate)) return candidate
	}
	return null
}
