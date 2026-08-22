import { useEffect, useRef, useState } from 'react';
import { useAccessor, useIsDark, useRefreshModelState, useSettingsState } from '../util/services.js';
import { Brain, Check, ChevronRight, Cloud, DollarSign, ExternalLink, Gift, Loader2, Lock, Monitor, Plus, X } from 'lucide-react';
import { displayInfoOfProviderName, ProviderName, providerNames, localProviderNames, featureNames, isFeatureNameDisabled, keyVerifiableProviderNames, RefreshableProviderName, apiKeyFormatOfProvider } from '../../../../common/voidSettingsTypes.js';
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js';
import { OllamaSetupInstructions, SettingsForProvider, ModelDump } from '../void-settings-tsx/Settings.js';
import { VoidCustomDropdownBox } from '../util/inputs.js';
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { isLinux } from '../../../../../../../base/common/platform.js';

const OVERRIDE_VALUE = false

export const VoidOnboarding = () => {

	const voidSettingsState = useSettingsState()
	const isOnboardingComplete = voidSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE

	const isDark = useIsDark()

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`}>
			<div
				className={`
					bg-void-bg-3 fixed top-0 right-0 bottom-0 left-0 width-full z-[99999]
					transition-all duration-1000 ${isOnboardingComplete ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
				`}
				style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
			>
				<ErrorBoundary>
					<VoidOnboardingContent />
				</ErrorBoundary>
			</div>
		</div>
	)
}

const VoidIcon = () => {
	const accessor = useAccessor()
	const themeService = accessor.get('IThemeService')

	const divRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		// void icon style
		const updateTheme = () => {
			const theme = themeService.getColorTheme().type
			const isDark = theme === ColorScheme.DARK || theme === ColorScheme.HIGH_CONTRAST_DARK
			if (divRef.current) {
				divRef.current.style.maxWidth = '220px'
				divRef.current.style.opacity = '100%'
				divRef.current.style.filter = isDark ? '' : 'invert(1)' //brightness(.5)
				divRef.current.style.borderRadius = '24px'
				divRef.current.style.overflow = 'hidden'
			}
		}
		updateTheme()
		const d = themeService.onDidColorThemeChange(updateTheme)
		return () => d.dispose()
	}, [])

	return <div ref={divRef} className='@@void-void-icon' />
}

const FADE_DURATION_MS = 2000

const FadeIn = ({ children, className, delayMs = 0, durationMs, ...props }: { children: React.ReactNode, delayMs?: number, durationMs?: number, className?: string } & React.HTMLAttributes<HTMLDivElement>) => {

	const [opacity, setOpacity] = useState(0)

	const effectiveDurationMs = durationMs ?? FADE_DURATION_MS

	useEffect(() => {

		const timeout = setTimeout(() => {
			setOpacity(1)
		}, delayMs)

		return () => clearTimeout(timeout)
	}, [setOpacity, delayMs])


	return (
		<div className={className} style={{ opacity, transition: `opacity ${effectiveDurationMs}ms ease-in-out` }} {...props}>
			{children}
		</div>
	)
}

// Builds the title word-by-word, each word fading/sliding/blurring into place in sequence
const AnimatedBuildTitle = ({ text, className = '', startDelayMs = 100, staggerMs = 130 }: { text: string, className?: string, startDelayMs?: number, staggerMs?: number }) => {
	const words = text.split(' ')

	return (
		<div className={className}>
			{words.map((word, i) => (
				<span
					key={i}
					className='inline-block'
					style={{
						opacity: 0,
						animation: 'void-word-in 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
						animationDelay: `${startDelayMs + i * staggerMs}ms`,
					}}
				>
					{word}
					{i < words.length - 1 ? ' ' : ''}
				</span>
			))}
		</div>
	)
}

// Onboarding

// =============================================
//  New AddProvidersPage Component and helpers
// =============================================

const tabNames = ['Free', 'Paid', 'Local'] as const;

type TabName = typeof tabNames[number] | 'Cloud/Other';

// Data for cloud providers tab
const cloudProviders: ProviderName[] = ['googleVertex', 'liteLLM', 'microsoftAzure', 'awsBedrock', 'openAICompatible'];

// Data structures for provider tabs
const providerNamesOfTab: Record<TabName, ProviderName[]> = {
	Free: ['gemini', 'openRouter'],
	Local: localProviderNames,
	Paid: providerNames.filter(pn => !(['gemini', 'openRouter', ...localProviderNames, ...cloudProviders] as string[]).includes(pn)) as ProviderName[],
	'Cloud/Other': cloudProviders,
};

const descriptionOfTab: Record<TabName, string> = {
	Free: `Providers with a 100% free tier. Add as many as you'd like!`,
	Paid: `Connect directly with any provider (bring your own key).`,
	Local: `Active providers should appear automatically. Add as many as you'd like! `,
	'Cloud/Other': `Add as many as you'd like! Reach out for custom configuration requests.`,
};


const tabIconOfTab: Record<TabName, React.FC<any>> = {
	Free: Gift,
	Paid: Plus,
	Local: Monitor,
	'Cloud/Other': Cloud,
};

// shows whether the entered API key was actually verified against the provider, for providers we can auto-verify
const ProviderStatusBadge = ({ providerName }: { providerName: ProviderName }) => {
	const refreshModelState = useRefreshModelState();
	const settingsState = useSettingsState();

	const apiKey = (settingsState.settingsOfProvider[providerName] as { apiKey?: string }).apiKey;
	const expectedFormat = apiKeyFormatOfProvider[providerName];
	if (apiKey && expectedFormat && !expectedFormat.test(apiKey)) {
		return <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400">Key doesn't look valid</span>;
	}

	const isVerifiable = (keyVerifiableProviderNames as string[]).includes(providerName);
	if (!isVerifiable) {
		return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-500">Active</span>;
	}

	const { state } = refreshModelState[providerName as RefreshableProviderName];
	if (state === 'refreshing') {
		return (
			<span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-void-bg-2 text-void-fg-3">
				<Loader2 className="w-3 h-3 animate-spin" /> Verifying key...
			</span>
		);
	}
	if (state === 'error') {
		return (
			<span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400">Key not valid</span>
		);
	}
	if (state === 'finished') {
		return (
			<span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-500">
				<Check className="w-3 h-3" /> Key verified
			</span>
		);
	}
	return null;
};

const AddProvidersPage = ({ pageIndex, setPageIndex }: { pageIndex: number, setPageIndex: (index: number) => void }) => {
	const [currentTab, setCurrentTab] = useState<TabName>('Free');
	const settingsState = useSettingsState();
	const refreshModelState = useRefreshModelState();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const [addProviderName, setAddProviderName] = useState<ProviderName>(providerNamesOfTab['Free'][0]);

	const configuredProvidersOfTab = providerNamesOfTab[currentTab].filter(
		(providerName) => settingsState.settingsOfProvider[providerName]._didFillInProviderSettings
	);

	// Clear error message after 5 seconds
	useEffect(() => {
		let timeoutId: NodeJS.Timeout | null = null;

		if (errorMessage) {
			timeoutId = setTimeout(() => {
				setErrorMessage(null);
			}, 5000);
		}

		// Cleanup function to clear the timeout if component unmounts or error changes
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [errorMessage]);

	useEffect(() => {
		setAddProviderName(providerNamesOfTab[currentTab][0]);
	}, [currentTab]);

	const providerNamesToShow = [...new Set([...configuredProvidersOfTab, addProviderName])];

	return (<div className="flex flex-col w-full h-[80vh] gap-4 max-w-[900px] mx-auto relative overflow-y-auto">
		{/* Header */}
		<div className="w-full">
			<div className="text-3xl font-semibold">Providers</div>
			<div className="text-sm opacity-70 text-void-fg-3">Manage all your AI providers, API keys, and models in one place.</div>
		</div>

		{/* Tab Selector */}
		<div className="flex flex-wrap gap-2">
			{[...tabNames, 'Cloud/Other'].map(tab => {
				const Icon = tabIconOfTab[tab as TabName];
				return (
					<button
						key={tab}
						className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full border text-sm transition-all duration-200 ${currentTab === tab
							? 'border-void-fg-1 text-void-fg-1'
							: 'border-void-border-2 text-void-fg-3 hover:border-void-fg-3'
							}`}
						onClick={() => {
							setCurrentTab(tab as TabName);
							setErrorMessage(null); // Reset error message when changing tabs
						}}
					>
						<Icon className="w-3.5 h-3.5" />
						{tab}
					</button>
				);
			})}
		</div>

		{/* Description + Add Provider */}
		<div className="flex items-center justify-between w-full">
			<div className="text-sm opacity-80 text-void-fg-3">{descriptionOfTab[currentTab]}</div>
			<div className="flex items-center gap-2">
				<VoidCustomDropdownBox
					options={providerNamesOfTab[currentTab]}
					selectedOption={addProviderName}
					onChangeOption={(providerName) => setAddProviderName(providerName)}
					getOptionDisplayName={(providerName) => displayInfoOfProviderName(providerName).title}
					getOptionDropdownName={(providerName) => displayInfoOfProviderName(providerName).title}
					getOptionsEqual={(a, b) => a === b}
					className="min-w-[160px] bg-void-bg-1 text-void-fg-1 border border-void-border-2 py-1 px-2 rounded text-sm"
					arrowTouchesText={false}
				/>
			</div>
		</div>

		{/* Provider cards */}
		<div className="flex flex-col gap-4 w-full">
			{providerNamesToShow.map((providerName) => (
				<div key={providerName} className="w-full border border-void-border-2 rounded-lg p-5 flex flex-col gap-4">
					<div>
						<div className="flex items-center gap-2 mb-3">
							<div className="text-lg font-medium">{displayInfoOfProviderName(providerName).title}</div>
							{settingsState.settingsOfProvider[providerName]._didFillInProviderSettings && (
								<ProviderStatusBadge providerName={providerName} />
							)}
							{providerName === 'gemini' && (
								<span
									data-tooltip-id="void-tooltip-provider-info"
									data-tooltip-content="Gemini 2.5 Pro offers 25 free messages a day, and Gemini 2.5 Flash offers 500. We recommend using models down the line as you run out of free credits."
									data-tooltip-place="right"
									className="text-xs align-top text-blue-400"
								>*</span>
							)}
							{providerName === 'openRouter' && (
								<span
									data-tooltip-id="void-tooltip-provider-info"
									data-tooltip-content="OpenRouter offers 50 free messages a day, and 1000 if you deposit $10. Only applies to models labeled ':free'."
									data-tooltip-place="right"
									className="text-xs align-top text-blue-400"
								>*</span>
							)}
						</div>
						<SettingsForProvider providerName={providerName} showProviderTitle={false} showProviderSuggestions={true} />
						{providerName === 'ollama' && <OllamaSetupInstructions />}
					</div>
					{settingsState.settingsOfProvider[providerName]._didFillInProviderSettings && (
						<div className="w-full bg-void-bg-2/50 rounded-lg p-4 border border-void-border-4">
							<div className="text-xs tracking-wide uppercase opacity-60 mb-2">Models</div>
							<ModelDump filteredProviders={[providerName]} />
						</div>
					)}
				</div>
			))}
		</div>

		{/* Navigation buttons */}
		<div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-void-border-2">
			<div className="text-xs opacity-60 text-void-fg-3">
				{errorMessage ? (
					<span className="text-amber-400">{errorMessage}</span>
				) : "Tip: changes are saved automatically."}
			</div>
			<div className="flex items-center gap-2">
				<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
				<NextButton
					onClick={() => {
						// block if ANY configured provider's key is obviously the wrong shape (e.g. "123", "xyz"), regardless of which provider is currently selected for Chat
						for (const pn of providerNames) {
							const providerSettings = settingsState.settingsOfProvider[pn]
							if (!providerSettings._didFillInProviderSettings) continue
							const apiKey = (providerSettings as { apiKey?: string }).apiKey
							if (!apiKey) continue
							const expectedFormat = apiKeyFormatOfProvider[pn]
							if (expectedFormat && !expectedFormat.test(apiKey)) {
								setErrorMessage(`${displayInfoOfProviderName(pn).title}'s API key doesn't look valid. Please check it and try again.`);
								return;
							}
						}

						const isDisabled = isFeatureNameDisabled('Chat', settingsState)

						if (isDisabled) {
							setErrorMessage("Please set up at least one Chat model before moving on.");
							return;
						}

						// block if the chat provider's key failed live verification (e.g. a garbage string that only passed the length check)
						const chatProviderName = settingsState.modelSelectionOfFeature['Chat']?.providerName
						if (chatProviderName && (keyVerifiableProviderNames as string[]).includes(chatProviderName)) {
							const { state } = refreshModelState[chatProviderName as RefreshableProviderName]
							if (state === 'error') {
								setErrorMessage(`${displayInfoOfProviderName(chatProviderName).title}'s API key could not be verified. Please check it and try again.`);
								return;
							}
							if (state === 'refreshing') {
								setErrorMessage(`Still verifying ${displayInfoOfProviderName(chatProviderName).title}'s API key...`);
								return;
							}
						}

						setPageIndex(pageIndex + 1);
						setErrorMessage(null);
					}}
				/>
			</div>
		</div>
	</div>);
};
// =============================================
// 	OnboardingPage
// 		title:
// 			div
// 				"Welcome to Void"
// 			image
// 		content:<></>
// 		title
// 		content
// 		prev/next

// 	OnboardingPage
// 		title:
// 			div
// 				"How would you like to use Void?"
// 		content:
// 			ModelQuestionContent
// 				|
// 					div
// 						"I want to:"
// 					div
// 						"Use the smartest models"
// 						"Keep my data fully private"
// 						"Save money"
// 						"I don't know"
// 				| div
// 					| div
// 						"We recommend using "
// 						"Set API"
// 					| div
// 						""
// 					| div
//
// 		title
// 		content
// 		prev/next
//
// 	OnboardingPage
// 		title
// 		content
// 		prev/next

const NextButton = ({ onClick, ...props }: { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {

	// Create a new props object without the disabled attribute
	const { disabled, ...buttonProps } = props;

	return (
		<button
			onClick={disabled ? undefined : onClick}
			onDoubleClick={onClick}
			className={`px-6 py-2 bg-zinc-100 ${disabled
				? 'bg-zinc-100/40 cursor-not-allowed'
				: 'hover:bg-zinc-100'
				} rounded text-black duration-600 transition-all
			`}
			{...disabled && {
				'data-tooltip-id': 'void-tooltip',
				"data-tooltip-content": 'Please enter all required fields or choose another provider', // (double-click to proceed anyway, can come back in Settings)
				"data-tooltip-place": 'top',
			}}
			{...buttonProps}
		>
			Next
		</button>
	)
}

const PreviousButton = ({ onClick, ...props }: { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
	return (
		<button
			onClick={onClick}
			className="px-6 py-2 rounded text-void-fg-3 opacity-80 hover:brightness-115 duration-600 transition-all"
			{...props}
		>
			Back
		</button>
	)
}



const OnboardingPageShell = ({ top, bottom, content, hasMaxWidth = true, className = '', }: {
	top?: React.ReactNode,
	bottom?: React.ReactNode,
	content?: React.ReactNode,
	hasMaxWidth?: boolean,
	className?: string,
}) => {
	return (
		<div className={`h-[80vh] text-lg flex flex-col gap-4 w-full mx-auto ${hasMaxWidth ? 'max-w-[600px]' : ''} ${className}`}>
			{top && <FadeIn className='w-full mb-auto pt-16'>{top}</FadeIn>}
			{content && <FadeIn className='w-full my-auto'>{content}</FadeIn>}
			{bottom && <div className='w-full pb-8'>{bottom}</div>}
		</div>
	)
}

const OllamaDownloadOrRemoveModelButton = ({ modelName, isModelInstalled, sizeGb }: { modelName: string, isModelInstalled: boolean, sizeGb: number | false | 'not-known' }) => {
	// for now just link to the ollama download page
	return <a
		href={`https://ollama.com/library/${modelName}`}
		target="_blank"
		rel="noopener noreferrer"
		className="flex items-center justify-center text-void-fg-2 hover:text-void-fg-1"
	>
		<ExternalLink className="w-3.5 h-3.5" />
	</a>

}


const YesNoText = ({ val }: { val: boolean | null }) => {

	return <div
		className={
			val === true ? "text text-emerald-500"
				: val === false ? 'text-rose-600'
					: "text text-amber-300"
		}
	>
		{
			val === true ? "Yes"
				: val === false ? 'No'
					: "Yes*"
		}
	</div>

}



const abbreviateNumber = (num: number): string => {
	if (num >= 1000000) {
		// For millions
		return Math.floor(num / 1000000) + 'M';
	} else if (num >= 1000) {
		// For thousands
		return Math.floor(num / 1000) + 'K';
	} else {
		// For numbers less than 1000
		return num.toString();
	}
}





const PrimaryActionButton = ({ children, className, ringSize, ...props }: { children: React.ReactNode, ringSize?: undefined | 'xl' | 'screen' } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {


	return (
		<button
			type='button'
			className={`
				flex items-center justify-center

				text-white dark:text-black
				bg-black/90 dark:bg-white/90

				${ringSize === 'xl' ? `
					gap-2 px-16 py-8
					transition-all duration-300 ease-in-out
					`
					: ringSize === 'screen' ? `
					gap-2 px-16 py-8
					transition-all duration-1000 ease-in-out
					`: ringSize === undefined ? `
					gap-1 px-4 py-2
					transition-all duration-300 ease-in-out
				`: ''}

				rounded-lg
				group
				${className}
			`}
			{...props}
		>
			{children}
			<ChevronRight
				className={`
					transition-all duration-300 ease-in-out

					transform
					group-hover:translate-x-1
					group-active:translate-x-1
				`}
			/>
		</button>
	)
}


type WantToUseOption = 'smart' | 'private' | 'cheap' | 'all'

const VoidOnboardingContent = () => {


	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const voidMetricsService = accessor.get('IMetricsService')

	const voidSettingsState = useSettingsState()
	const refreshModelState = useRefreshModelState()

	const [pageIndex, setPageIndex] = useState(0)


	// page 1 state
	const [wantToUseOption, setWantToUseOption] = useState<WantToUseOption>('smart')

	// Replace the single selectedProviderName with four separate states
	// page 2 state - each tab gets its own state
	const [selectedIntelligentProvider, setSelectedIntelligentProvider] = useState<ProviderName>('anthropic');
	const [selectedPrivateProvider, setSelectedPrivateProvider] = useState<ProviderName>('ollama');
	const [selectedAffordableProvider, setSelectedAffordableProvider] = useState<ProviderName>('gemini');
	const [selectedAllProvider, setSelectedAllProvider] = useState<ProviderName>('anthropic');

	// Helper function to get the current selected provider based on active tab
	const getSelectedProvider = (): ProviderName => {
		switch (wantToUseOption) {
			case 'smart': return selectedIntelligentProvider;
			case 'private': return selectedPrivateProvider;
			case 'cheap': return selectedAffordableProvider;
			case 'all': return selectedAllProvider;
		}
	}

	// Helper function to set the selected provider for the current tab
	const setSelectedProvider = (provider: ProviderName) => {
		switch (wantToUseOption) {
			case 'smart': setSelectedIntelligentProvider(provider); break;
			case 'private': setSelectedPrivateProvider(provider); break;
			case 'cheap': setSelectedAffordableProvider(provider); break;
			case 'all': setSelectedAllProvider(provider); break;
		}
	}

	const providerNamesOfWantToUseOption: { [wantToUseOption in WantToUseOption]: ProviderName[] } = {
		smart: ['anthropic', 'openAI', 'gemini', 'openRouter'],
		private: ['ollama', 'vLLM', 'openAICompatible', 'lmStudio'],
		cheap: ['gemini', 'deepseek', 'openRouter', 'ollama', 'vLLM'],
		all: providerNames,
	}


	const selectedProviderName = getSelectedProvider();
	const didFillInProviderSettings = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName]._didFillInProviderSettings
	const isApiKeyLongEnoughIfApiKeyExists = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].apiKey ? voidSettingsState.settingsOfProvider[selectedProviderName].apiKey.length > 15 : true
	const isAtLeastOneModel = selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].models.length >= 1

	// for providers we can actually test the key against (openAI, deepseek, groq, xAI, mistral, openRouter), require the live verification to succeed - a garbage string that merely passes the length check should not be accepted
	const isKeyVerifiable = selectedProviderName && (keyVerifiableProviderNames as string[]).includes(selectedProviderName)
	const keyVerifyState = selectedProviderName && isKeyVerifiable ? refreshModelState[selectedProviderName as RefreshableProviderName].state : null
	const isApiKeyVerifiedIfVerifiable = !isKeyVerifiable || keyVerifyState === 'finished'

	const didFillInSelectedProviderSettings = !!(didFillInProviderSettings && isApiKeyLongEnoughIfApiKeyExists && isAtLeastOneModel && isApiKeyVerifiedIfVerifiable)

	const prevAndNextButtons = <div className="max-w-[600px] w-full mx-auto flex flex-col items-end">
		<div className="flex items-center gap-2">
			<PreviousButton
				onClick={() => { setPageIndex(pageIndex - 1) }}
			/>
			<NextButton
				onClick={() => { setPageIndex(pageIndex + 1) }}
			/>
		</div>
	</div>


	const lastPagePrevAndNextButtons = <div className="max-w-[600px] w-full mx-auto flex flex-col items-end">
		<div className="flex items-center gap-2">
			<PreviousButton
				onClick={() => { setPageIndex(pageIndex - 1) }}
			/>
			<PrimaryActionButton
				onClick={() => {
					voidSettingsService.setGlobalSetting('isOnboardingComplete', true);
					voidMetricsService.capture('Completed Onboarding', { selectedProviderName, wantToUseOption })
				}}
				ringSize={voidSettingsState.globalSettings.isOnboardingComplete ? 'screen' : undefined}
			>Enter J code's</PrimaryActionButton>
		</div>
	</div>


	// cannot be md
	const basicDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Models with the best performance on benchmarks.",
		private: "Host on your computer or local network for full data privacy.",
		cheap: "Free and affordable options.",
		all: "",
	}

	// can be md
	const detailedDescOfWantToUseOption: { [wantToUseOption in WantToUseOption]: string } = {
		smart: "Most intelligent and best for agent mode.",
		private: "Private-hosted so your data never leaves your computer or network. [Email us](mailto:founders@voideditor.com) for help setting up at your company.",
		cheap: "Use great deals like Gemini 2.5 Pro, or self-host a model with Ollama or vLLM for free.",
		all: "",
	}

	// Modified: initialize separate provider states on initial render instead of watching wantToUseOption changes
	useEffect(() => {
		if (selectedIntelligentProvider === undefined) {
			setSelectedIntelligentProvider(providerNamesOfWantToUseOption['smart'][0]);
		}
		if (selectedPrivateProvider === undefined) {
			setSelectedPrivateProvider(providerNamesOfWantToUseOption['private'][0]);
		}
		if (selectedAffordableProvider === undefined) {
			setSelectedAffordableProvider(providerNamesOfWantToUseOption['cheap'][0]);
		}
		if (selectedAllProvider === undefined) {
			setSelectedAllProvider(providerNamesOfWantToUseOption['all'][0]);
		}
	}, []);

	// reset the page to page 0 if the user redos onboarding
	useEffect(() => {
		if (!voidSettingsState.globalSettings.isOnboardingComplete) {
			setPageIndex(0)
		}
	}, [setPageIndex, voidSettingsState.globalSettings.isOnboardingComplete])


	const contentOfIdx: { [pageIndex: number]: React.ReactNode } = {
		0: <OnboardingPageShell
			content={
				<div className='flex flex-col items-center gap-8'>
					<AnimatedBuildTitle text="Welcome to J code's" className="text-5xl font-light text-center" />

					{/* Slice of Void image */}
					<div
						className='max-w-md w-full h-[30vh] mx-auto flex items-center justify-center'
						style={{
							opacity: 0,
							animation: 'void-logo-in 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards 500ms, void-logo-glow 3s ease-in-out infinite 1400ms',
						}}
					>
						{!isLinux && <VoidIcon />}
					</div>


					<FadeIn
						delayMs={1000}
						className="flex items-center gap-4"
					>
						<PrimaryActionButton
							onClick={() => { setPageIndex(1) }}
						>
							Get Started
						</PrimaryActionButton>
						<button
							className="text-sm text-void-fg-3 opacity-80 hover:opacity-100 transition-all"
							onClick={() => { setPageIndex(2) }}
						>
							Skip to Summary
						</button>
					</FadeIn>

				</div>
			}
		/>,

		1: <OnboardingPageShell hasMaxWidth={false}
			content={
				<AddProvidersPage pageIndex={pageIndex} setPageIndex={setPageIndex} />
			}
		/>,
		2: <OnboardingPageShell

			content={
				<div className='flex flex-col items-center gap-4'>
					<AnimatedBuildTitle text="Your workspace is ready to go." className="text-3xl font-semibold text-center" />
					<div className="text-sm text-void-fg-3 text-center max-w-md">You can continue with the current setup now and fine-tune providers, models, and AI behavior later from settings.</div>

					{/* Slice of Void image */}
					<div
						className='max-w-md w-full h-[30vh] mx-auto flex items-center justify-center'
						style={{
							opacity: 0,
							animation: 'void-logo-in 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards 400ms, void-logo-glow 3s ease-in-out infinite 1300ms',
						}}
					>
						{!isLinux && <VoidIcon />}
					</div>

					{/* Settings transfer disabled - using our own onboarding instead
					<div className="mt-8 text-center flex flex-col items-center gap-4 w-full max-w-md mx-auto">
						<h4 className="text-void-fg-3 mb-4">Transfer your settings from an existing editor?</h4>
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="VS Code" />
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="Cursor" />
						<OneClickSwitchButton className='w-full px-4 py-2' fromEditor="Windsurf" />
					</div>
					*/}
				</div>
			}
			bottom={lastPagePrevAndNextButtons}
		/>,
	}


	return <div key={pageIndex} className="w-full h-[80vh] text-left mx-auto flex flex-col items-center justify-center">
		<ErrorBoundary>
			{contentOfIdx[pageIndex]}
		</ErrorBoundary>
	</div>

}
