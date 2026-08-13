// past values:
// 'void.settingsServiceStorage'
// 'void.settingsServiceStorageI' // 1.0.2

// 1.0.3
export const VOID_SETTINGS_STORAGE_KEY = 'void.settingsServiceStorageII'

// if VOID_SETTINGS_STORAGE_KEY has no value (eg right after a key rename), fall back to these older keys in order
export const VOID_SETTINGS_STORAGE_KEY_FALLBACKS = [
	'void.settingsServiceStorageI',
	'void.settingsServiceStorage',
]

// redundant unencrypted (base64) copy of VOID_SETTINGS_STORAGE_KEY, written on every save.
// IEncryptionService can fail to decrypt across app restarts (eg OS keychain key rotation, unsigned/dev
// Electron builds) - this key lets us recover the user's real settings (API keys, isOnboardingComplete,
// etc) in that case instead of silently falling back to defaults and overwriting the encrypted blob.
export const VOID_SETTINGS_STORAGE_KEY_PLAINTEXT_BACKUP = 'void.settingsServiceStorageII.plaintextBackup'


// past values:
// 'void.chatThreadStorage'
// 'void.chatThreadStorageI' // 1.0.2

// 1.0.3
export const THREAD_STORAGE_KEY = 'void.chatThreadStorageII'

// if THREAD_STORAGE_KEY has no value (eg right after a key rename), fall back to these older keys in order
export const THREAD_STORAGE_KEY_FALLBACKS = [
	'void.chatThreadStorageI',
	'void.chatThreadStorage',
]



export const OPT_OUT_KEY = 'void.app.optOutAll'


// last-known GitHub account list/active login, cached so the GitHub Accounts UI has something to paint
// immediately on startup before the real `gh auth status` round-trip resolves - see voidGitHubService.ts.
// No tokens live here, only public login/name/avatar metadata; `gh` itself owns real credential storage.
export const GITHUB_ACCOUNTS_CACHE_STORAGE_KEY = 'void.githubAccountsCacheI'


// day-bucketed { [YYYY-MM-DD]: { inputTokens, outputTokens } } used to compute rolling weekly/monthly token usage totals
export const TOKEN_USAGE_STORAGE_KEY = 'void.tokenUsageStorageI'

// per-message usage log (model, thread, timestamp) used to power the Token Usage dashboard's chart/table - bounded, see tokenUsageService.ts
export const TOKEN_USAGE_RECORDS_STORAGE_KEY = 'void.tokenUsageRecordsI'

// lifetime totals that are never pruned, used for the "All Time" stat (day buckets above are pruned after DAYS_TO_KEEP)
export const TOKEN_USAGE_ALLTIME_STORAGE_KEY = 'void.tokenUsageAllTimeI'

// lifetime running total of real tokens-not-sent from applying targeted search/replace diffs instead of
// having the model rewrite the whole file (the app's other edit mechanism, still used for small files /
// when Fast Apply is off) - see editCodeService.ts's _instantlyApplySRBlocks
export const TOKEN_USAGE_EDIT_SAVINGS_STORAGE_KEY = 'void.tokenUsageEditSavingsI'
