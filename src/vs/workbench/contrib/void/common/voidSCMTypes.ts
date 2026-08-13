import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface GitActivityCommit {
	hash: string
	subject: string
	date: string // ISO (git --date=iso-strict)
	filesChanged: string[] // paths relative to the repo root, capped per-commit
}

export interface IVoidSCMService {
	readonly _serviceBrand: undefined;
	/**
	 * Get git diff --stat
	 *
	 * @param path Path to the git repository
	 */
	gitStat(path: string): Promise<string>
	/**
	 * Get git diff --stat for the top 10 most significantly changed files according to lines added/removed
	 *
	 * @param path Path to the git repository
	 */
	gitSampledDiffs(path: string): Promise<string>
	/**
	 * Get the current git branch
	 *
	 * @param path Path to the git repository
	 */
	gitBranch(path: string): Promise<string>
	/**
	 * Get the last 5 commits excluding merges
	 *
	 * @param path Path to the git repository
	 */
	gitLog(path: string): Promise<string>
	/**
	 * Get recent commits with the files each one touched, structured (not raw text) - used by
	 * Project Brain's activity timeline and "what changed" impact heuristic.
	 *
	 * @param path Path to the git repository
	 * @param limit Max number of commits to return
	 */
	gitRecentActivity(path: string, limit?: number): Promise<GitActivityCommit[]>
}

export const IVoidSCMService = createDecorator<IVoidSCMService>('voidSCMService')
