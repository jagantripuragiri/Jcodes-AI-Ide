import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { TOKEN_USAGE_STORAGE_KEY, TOKEN_USAGE_RECORDS_STORAGE_KEY, TOKEN_USAGE_ALLTIME_STORAGE_KEY, TOKEN_USAGE_EDIT_SAVINGS_STORAGE_KEY } from '../common/storageKeys.js';
import { LLMUsage, TokenUsageRecord, TokenUsageRecordMeta } from '../common/tokenUsageTypes.js';

// keep enough days to cover the widest rolling window we show (the dashboard's "monthly" chart view looks back ~12 months) plus slack
const DAYS_TO_KEEP = 400

// per-record log is only used for the dashboard's chart/table (recent history), so it doesn't need to grow forever
const MAX_RECORDS_TO_KEEP = 500

type UsageByDay = { [dayISOStr: string]: { inputTokens: number; outputTokens: number; systemTokens: number } | undefined }
type AllTimeUsage = { inputTokens: number; outputTokens: number; systemTokens: number; since: string /* ISO string */ }
type EditSavings = { editCount: number; fullFileTokens: number; diffTokens: number }

export type TokenUsageWindow = { inputTokens: number; outputTokens: number; systemTokens: number }
export type DailyUsagePoint = { day: string /* YYYY-MM-DD */; inputTokens: number; outputTokens: number; systemTokens: number }

const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD

export interface ITokenUsageService {
	readonly _serviceBrand: undefined;
	onDidChangeUsage: Event<void>;
	recordUsage(usage: LLMUsage, meta: TokenUsageRecordMeta): void;
	getUsageOverLastNDays(days: number): TokenUsageWindow;
	getAllTimeUsage(): AllTimeUsage;
	getDailySeries(days: number): DailyUsagePoint[];
	getRecentRecords(limit?: number): TokenUsageRecord[];
	// records tokens actually sent as a targeted search/replace diff vs. what a full-file rewrite of the same edit
	// would have cost - both real, measured figures for edits this app applied (see editCodeService.ts)
	recordEditSavings(fullFileTokens: number, diffTokens: number): void;
	getEditSavings(): EditSavings;
}

export const ITokenUsageService = createDecorator<ITokenUsageService>('voidTokenUsageService');

class TokenUsageService extends Disposable implements ITokenUsageService {
	_serviceBrand: undefined;

	private readonly _onDidChangeUsage = new Emitter<void>();
	readonly onDidChangeUsage: Event<void> = this._onDidChangeUsage.event;

	private _usageByDay: UsageByDay;
	private _allTime: AllTimeUsage;
	private _records: TokenUsageRecord[];
	private _editSavings: EditSavings;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super()
		this._usageByDay = this._readJSON(TOKEN_USAGE_STORAGE_KEY, {})
		// backfill systemTokens on day-buckets written before that field existed, so old + new data can be summed safely
		for (const day in this._usageByDay) {
			const usage = this._usageByDay[day]
			if (usage && typeof usage.systemTokens !== 'number') usage.systemTokens = 0
		}
		this._allTime = this._readJSON(TOKEN_USAGE_ALLTIME_STORAGE_KEY, { inputTokens: 0, outputTokens: 0, systemTokens: 0, since: new Date().toISOString() })
		this._records = this._readJSON(TOKEN_USAGE_RECORDS_STORAGE_KEY, [])
		this._editSavings = this._readJSON(TOKEN_USAGE_EDIT_SAVINGS_STORAGE_KEY, { editCount: 0, fullFileTokens: 0, diffTokens: 0 })
	}

	private _readJSON<T>(key: string, fallback: T): T {
		const str = this._storageService.get(key, StorageScope.APPLICATION)
		if (!str) return fallback
		try {
			const parsed = JSON.parse(str)
			return parsed ?? fallback
		}
		catch (e) {
			console.error(`[Void] Failed to parse stored token usage (key: ${key}); starting fresh.`, e)
			return fallback
		}
	}

	private _storeJSON(key: string, value: unknown) {
		this._storageService.store(key, JSON.stringify(value), StorageScope.APPLICATION, StorageTarget.USER)
	}

	private _pruneAndStoreDays() {
		const cutoff = new Date()
		cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP)
		const cutoffKey = dayKeyOf(cutoff)

		for (const day in this._usageByDay) {
			if (day < cutoffKey) delete this._usageByDay[day]
		}
		this._storeJSON(TOKEN_USAGE_STORAGE_KEY, this._usageByDay)
	}

	recordUsage(usage: LLMUsage, meta: TokenUsageRecordMeta): void {
		const now = new Date()
		const day = dayKeyOf(now)
		const systemTokens = meta.systemTokens

		const existing = this._usageByDay[day] ?? { inputTokens: 0, outputTokens: 0, systemTokens: 0 }
		this._usageByDay[day] = {
			inputTokens: existing.inputTokens + usage.inputTokens,
			outputTokens: existing.outputTokens + usage.outputTokens,
			systemTokens: existing.systemTokens + systemTokens,
		}
		this._pruneAndStoreDays()

		this._allTime = {
			inputTokens: this._allTime.inputTokens + usage.inputTokens,
			outputTokens: this._allTime.outputTokens + usage.outputTokens,
			systemTokens: this._allTime.systemTokens + systemTokens,
			since: this._allTime.since,
		}
		this._storeJSON(TOKEN_USAGE_ALLTIME_STORAGE_KEY, this._allTime)

		const record: TokenUsageRecord = {
			id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
			timestamp: now.toISOString(),
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			...meta,
		}
		this._records = [record, ...this._records].slice(0, MAX_RECORDS_TO_KEEP)
		this._storeJSON(TOKEN_USAGE_RECORDS_STORAGE_KEY, this._records)

		this._onDidChangeUsage.fire()
	}

	getUsageOverLastNDays(days: number): TokenUsageWindow {
		const cutoff = new Date()
		cutoff.setDate(cutoff.getDate() - (days - 1)) // include today as day 1 of the window
		const cutoffKey = dayKeyOf(cutoff)

		let inputTokens = 0
		let outputTokens = 0
		let systemTokens = 0
		for (const day in this._usageByDay) {
			if (day < cutoffKey) continue
			const usage = this._usageByDay[day]
			if (!usage) continue
			inputTokens += usage.inputTokens
			outputTokens += usage.outputTokens
			systemTokens += usage.systemTokens ?? 0
		}
		return { inputTokens, outputTokens, systemTokens }
	}

	getAllTimeUsage(): AllTimeUsage {
		return this._allTime
	}

	getDailySeries(days: number): DailyUsagePoint[] {
		const points: DailyUsagePoint[] = []
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date()
			d.setDate(d.getDate() - i)
			const day = dayKeyOf(d)
			const usage = this._usageByDay[day]
			points.push({ day, inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0, systemTokens: usage?.systemTokens ?? 0 })
		}
		return points
	}

	getRecentRecords(limit?: number): TokenUsageRecord[] {
		return limit === undefined ? this._records : this._records.slice(0, limit)
	}

	recordEditSavings(fullFileTokens: number, diffTokens: number): void {
		this._editSavings = {
			editCount: this._editSavings.editCount + 1,
			fullFileTokens: this._editSavings.fullFileTokens + fullFileTokens,
			diffTokens: this._editSavings.diffTokens + diffTokens,
		}
		this._storeJSON(TOKEN_USAGE_EDIT_SAVINGS_STORAGE_KEY, this._editSavings)
		this._onDidChangeUsage.fire()
	}

	getEditSavings(): EditSavings {
		return this._editSavings
	}
}

registerSingleton(ITokenUsageService, TokenUsageService, InstantiationType.Eager);
