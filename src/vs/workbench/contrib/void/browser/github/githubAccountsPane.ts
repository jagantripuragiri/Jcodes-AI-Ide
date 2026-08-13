// GitHub Accounts — full-tab dashboard EditorPane. Mirrors tokenUsage/tokenUsagePane.ts exactly:
// a full editor-group tab (not a sidebar view), so it reuses the same open/focus-single-tab pattern.

import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import * as nls from '../../../../../nls.js';
import { EditorExtensions } from '../../../../common/editor.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { IEditorGroup, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { Dimension } from '../../../../../base/browser/dom.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { URI } from '../../../../../base/common/uri.js';

import { mountGitHubAccounts } from '../react/out/github-accounts-tsx/index.js'
import { Codicon } from '../../../../../base/common/codicons.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';

export class GitHubAccountsInput extends EditorInput {

	static readonly ID: string = 'workbench.input.void.githubAccounts';

	static readonly RESOURCE = URI.from({
		scheme: 'void',
		path: 'githubAccounts'
	})
	readonly resource = GitHubAccountsInput.RESOURCE;

	constructor() {
		super();
	}

	override get typeId(): string {
		return GitHubAccountsInput.ID;
	}

	override getName(): string {
		return nls.localize('githubAccountsInputName', 'GitHub Accounts');
	}

	override getIcon() {
		return Codicon.account
	}
}

class GitHubAccountsPane extends EditorPane {
	static readonly ID = 'workbench.pane.void.githubAccounts';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(GitHubAccountsPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%';
		parent.style.width = '100%';

		const rootElt = document.createElement('div');
		rootElt.style.height = '100%';
		rootElt.style.width = '100%';
		parent.appendChild(rootElt);

		this.instantiationService.invokeFunction(accessor => {
			const disposeFn = mountGitHubAccounts(rootElt, accessor)?.dispose;
			this._register(toDisposable(() => disposeFn?.()))
		});
	}

	layout(dimension: Dimension): void { }

	override get minimumWidth() { return 700 }
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(GitHubAccountsPane, GitHubAccountsPane.ID, nls.localize('GitHubAccountsPane', 'GitHub Accounts')),
	[new SyncDescriptor(GitHubAccountsInput)]
);

// opens (or focuses, if already open) the single GitHub Accounts tab
export async function openGitHubAccountsTab(instantiationService: IInstantiationService, editorService: IEditorService, editorGroupService: IEditorGroupsService): Promise<void> {
	const openEditors = editorService.findEditors(GitHubAccountsInput.RESOURCE);
	if (openEditors.length > 0) {
		await editorGroupService.activeGroup.openEditor(openEditors[0].editor);
		return;
	}
	const input = instantiationService.createInstance(GitHubAccountsInput);
	await editorService.openEditor(input);
}
