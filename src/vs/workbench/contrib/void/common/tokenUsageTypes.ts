export type LLMUsage = {
	inputTokens: number;
	outputTokens: number;
}

// metadata attached to a single recorded LLM call, for the Token Usage dashboard's per-conversation table/chart
export type TokenUsageRecordMeta = {
	systemTokens: number;
	model: string;
	providerName: string;
	threadId: string;
	threadTitle: string;
}

export type TokenUsageRecord = LLMUsage & TokenUsageRecordMeta & {
	id: string;
	timestamp: string; // ISO string
}

// soft display targets only — J Codes has no hard token quota; these just give the Token Usage
// UI's progress bars a frame of reference. Shared so the sidebar card and the full dashboard agree.
export const TOKEN_USAGE_SOFT_TARGETS = {
	day: 10_000,
	week: 70_000,
	month: 200_000,
} as const

// rough fallback for providers/SDKs that don't report usage (eg some OpenAI-compatible local servers) -
// approximates the common "~4 chars per token" heuristic for English text so totals stay populated
export const estimateTokenCount = (text: string): number => {
	if (!text) return 0
	return Math.max(1, Math.ceil(text.length / 4))
}
