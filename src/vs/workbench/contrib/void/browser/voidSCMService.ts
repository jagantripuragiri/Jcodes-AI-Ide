import { ThemeIcon } from '../../../../base/common/themables.js'
import { localize2 } from '../../../../nls.js'
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js'
import { ContextKeyExpr, IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js'
import { ISCMRepository, ISCMService, ISCMViewService } from '../../scm/common/scm.js'
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js'
import { IVoidSCMService } from '../common/voidSCMTypes.js'
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js'
import { IVoidSettingsService } from '../common/voidSettingsService.js'
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js'
import { ILLMMessageService } from '../common/sendLLMMessageService.js'
import { ModelSelection, OverridesOfModel, ModelSelectionOptions } from '../common/voidSettingsTypes.js'
import { gitCommitMessage_systemMessage, gitCommitMessage_userMessage } from '../common/prompt/prompts.js'
import { LLMChatMessage } from '../common/sendLLMMessageTypes.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { CancellationError, isCancellationError } from '../../../../base/common/errors.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js'
import { Disposable } from '../../../../base/common/lifecycle.js'
import { URI } from '../../../../base/common/uri.js'
import { INotificationService } from '../../../../platform/notification/common/notification.js'

interface ModelOptions {
	modelSelection: ModelSelection | null
	modelSelectionOptions?: ModelSelectionOptions
	overridesOfModel: OverridesOfModel
}

export interface IGenerateCommitMessageService {
	readonly _serviceBrand: undefined
	generateCommitMessage(rootUri?: URI): Promise<void>
	abort(rootUri?: URI): void
}

export const IGenerateCommitMessageService = createDecorator<IGenerateCommitMessageService>('voidGenerateCommitMessageService');

// List of repository root URIs (as strings) currently generating a commit message.
// Compared against the per-input-box 'scmProviderRootUri' context key so the loading state is per repository.
const loadingRootsContextKey = 'voidSCMGenerateCommitMessageLoadingRoots'

interface PendingRequest {
	requestId: string
	llmRequestId: string | null
}

class GenerateCommitMessageService extends Disposable implements IGenerateCommitMessageService {
	readonly _serviceBrand: undefined;
	private readonly pendingByRoot = new Map<string, PendingRequest>()
	private voidSCM: IVoidSCMService
	private loadingRootsKey: IContextKey<string[]>

	constructor(
		@ISCMService private readonly scmService: ISCMService,
		@ISCMViewService private readonly scmViewService: ISCMViewService,
		@IMainProcessService mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IConvertToLLMMessageService private readonly convertToLLMMessageService: IConvertToLLMMessageService,
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super()
		this.loadingRootsKey = this.contextKeyService.createKey<string[]>(loadingRootsContextKey, [])
		this.voidSCM = ProxyChannel.toService<IVoidSCMService>(mainProcessService.getChannel('void-channel-scm'))
	}

	override dispose() {
		for (const rootKey of [...this.pendingByRoot.keys()]) {
			this.abortRoot(rootKey)
		}
		super.dispose()
	}

	async generateCommitMessage(rootUri?: URI) {
		let repo: ISCMRepository
		try {
			repo = this.gitRepo(rootUri)
		} catch (error) {
			this.onError(error)
			return
		}

		const path = repo.provider.rootUri!.fsPath
		const rootKey = repo.provider.rootUri!.toString()

		// Replace any in-flight request for this same repository
		this.abortRoot(rootKey)

		const pending: PendingRequest = { requestId: generateUuid(), llmRequestId: null }
		this.pendingByRoot.set(rootKey, pending)
		this.updateLoadingKey()

		try {
			const [stat, sampledDiffs, branch, log] = await Promise.all([
				this.voidSCM.gitStat(path),
				this.voidSCM.gitSampledDiffs(path),
				this.voidSCM.gitBranch(path),
				this.voidSCM.gitLog(path)
			])

			if (!this.isCurrentRequest(rootKey, pending)) { throw new CancellationError() }

			const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['SCM'] ?? null
			const modelSelectionOptions = modelSelection ? this.voidSettingsService.state.optionsOfModelSelection['SCM'][modelSelection?.providerName]?.[modelSelection.modelName] : undefined
			const overridesOfModel = this.voidSettingsService.state.overridesOfModel

			const modelOptions: ModelOptions = { modelSelection, modelSelectionOptions, overridesOfModel }

			const prompt = gitCommitMessage_userMessage(stat, sampledDiffs, branch, log)

			const simpleMessages = [{ role: 'user', content: prompt } as const]
			const { messages, separateSystemMessage } = this.convertToLLMMessageService.prepareLLMSimpleMessages({
				simpleMessages,
				systemMessage: gitCommitMessage_systemMessage,
				modelSelection: modelOptions.modelSelection,
				featureName: 'SCM',
			})

			const commitMessage = await this.sendLLMMessage(messages, separateSystemMessage!, modelOptions, pending)

			if (!this.isCurrentRequest(rootKey, pending)) { throw new CancellationError() }

			repo.input.setValue(commitMessage, false)
		} catch (error) {
			this.onError(error)
		} finally {
			if (this.isCurrentRequest(rootKey, pending)) {
				this.pendingByRoot.delete(rootKey)
				this.updateLoadingKey()
			}
		}
	}

	abort(rootUri?: URI) {
		if (rootUri) {
			this.abortRoot(rootUri.toString())
			return
		}
		for (const rootKey of [...this.pendingByRoot.keys()]) {
			this.abortRoot(rootKey)
		}
	}

	private abortRoot(rootKey: string) {
		const pending = this.pendingByRoot.get(rootKey)
		if (!pending) { return }
		this.pendingByRoot.delete(rootKey)
		if (pending.llmRequestId) {
			this.llmMessageService.abort(pending.llmRequestId)
		}
		this.updateLoadingKey()
	}

	private updateLoadingKey() {
		this.loadingRootsKey.set([...this.pendingByRoot.keys()])
	}

	/**
	 * Resolves the git repository to generate for. When invoked from a repository's
	 * input box, `rootUri` identifies that repository. Otherwise (e.g. command palette)
	 * fall back to the active repository, then to the first git repository.
	 */
	private gitRepo(rootUri?: URI): ISCMRepository {
		const gitRepos = Array.from(this.scmService.repositories || []).filter(r => r.provider.contextValue === 'git')

		let repo: ISCMRepository | undefined
		if (URI.isUri(rootUri)) {
			repo = gitRepos.find(r => r.provider.rootUri?.toString() === rootUri.toString())
		} else {
			const active = this.scmViewService.activeRepository.get()
			repo = active && gitRepos.includes(active) ? active : gitRepos[0]
		}

		if (!repo) { throw new Error('No git repository found') }
		if (!repo.provider.rootUri?.fsPath) { throw new Error('No git repository root path found') }
		return repo
	}

	/** LLM Functions */

	private sendLLMMessage(messages: LLMChatMessage[], separateSystemMessage: string, modelOptions: ModelOptions, pending: PendingRequest): Promise<string> {
		return new Promise((resolve, reject) => {

			pending.llmRequestId = this.llmMessageService.sendLLMMessage({
				messagesType: 'chatMessages',
				messages,
				separateSystemMessage,
				chatMode: null,
				modelSelection: modelOptions.modelSelection,
				modelSelectionOptions: modelOptions.modelSelectionOptions,
				overridesOfModel: modelOptions.overridesOfModel,
				onText: () => { },
				onFinalMessage: (params: { fullText: string }) => {
					const match = params.fullText.match(/<output>([\s\S]*?)<\/output>/i)
					const commitMessage = (match ? match[1] : params.fullText).trim()
					if (!commitMessage) {
						reject(new Error('Model returned an empty commit message.'))
						return
					}
					resolve(commitMessage)
				},
				onError: (error) => {
					console.error(error)
					reject(error)
				},
				onAbort: () => {
					reject(new CancellationError())
				},
				logging: { loggingName: 'VoidSCM - Commit Message' },
			})
		})
	}


	/** Request Helpers */

	private isCurrentRequest(rootKey: string, pending: PendingRequest) {
		return this.pendingByRoot.get(rootKey)?.requestId === pending.requestId
	}


	/** UI Functions */

	private onError(error: any) {
		if (!isCancellationError(error)) {
			console.error(error)
			this.notificationService.error(localize2('voidFailedToGenerateCommitMessage', 'Failed to generate commit message.').value)
		}
	}
}

class GenerateCommitMessageAction extends Action2 {
	constructor() {
		super({
			id: 'void.generateCommitMessageAction',
			title: localize2('voidCommitMessagePrompt', 'Jcode: Generate Commit Message'),
			icon: ThemeIcon.fromId('sparkle'),
			tooltip: localize2('voidCommitMessagePromptTooltip', 'Jcode: Generate Commit Message'),
			f1: true,
			menu: [{
				id: MenuId.SCMInputBox,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('scmProvider', 'git'), ContextKeyExpr.in('scmProviderRootUri', loadingRootsContextKey).negate()),
				group: 'inline'
			}]
		})
	}

	async run(accessor: ServicesAccessor, rootUri?: URI): Promise<void> {
		// When run from a repository's input box, the SCM toolbar passes that repository's root URI
		const generateCommitMessageService = accessor.get(IGenerateCommitMessageService)
		generateCommitMessageService.generateCommitMessage(URI.isUri(rootUri) ? rootUri : undefined)
	}
}

class LoadingGenerateCommitMessageAction extends Action2 {
	constructor() {
		super({
			id: 'void.loadingGenerateCommitMessageAction',
			title: localize2('voidCommitMessagePromptCancel', 'Jcode: Cancel Commit Message Generation'),
			icon: ThemeIcon.fromId('stop-circle'),
			tooltip: localize2('voidCommitMessagePromptCancelTooltip', 'Jcode: Cancel Commit Message Generation'),
			f1: false, //Having a cancel command in the command palette is more confusing than useful.
			menu: [{
				id: MenuId.SCMInputBox,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('scmProvider', 'git'), ContextKeyExpr.in('scmProviderRootUri', loadingRootsContextKey)),
				group: 'inline'
			}]
		})
	}
	async run(accessor: ServicesAccessor, rootUri?: URI): Promise<void> {
		const generateCommitMessageService = accessor.get(IGenerateCommitMessageService)
		generateCommitMessageService.abort(URI.isUri(rootUri) ? rootUri : undefined)
	}
}

registerAction2(GenerateCommitMessageAction)
registerAction2(LoadingGenerateCommitMessageAction)
registerSingleton(IGenerateCommitMessageService, GenerateCommitMessageService, InstantiationType.Delayed)
