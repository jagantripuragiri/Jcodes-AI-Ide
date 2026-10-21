// J Codes Updates — full-tab EditorPane. Mirrors tokenUsage/tokenUsagePane.ts exactly (a full editor-group tab, not a sidebar view).

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

import { mountUpdates } from '../react/out/updates-tsx/index.js'
import { Codicon } from '../../../../../base/common/codicons.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';

export class UpdatesInput extends EditorInput {

	static readonly ID: string = 'workbench.input.void.updates';

	static readonly RESOURCE = URI.from({
		scheme: 'void',
		path: 'updates'
	})
	readonly resource = UpdatesInput.RESOURCE;

	constructor() {
		super();
	}

	override get typeId(): string {
		return UpdatesInput.ID;
	}

	override getName(): string {
		return nls.localize('updatesInputName', 'Updates');
	}

	override getIcon() {
		return Codicon.cloudDownload
	}
}

class UpdatesPane extends EditorPane {
	static readonly ID = 'workbench.pane.void.updates';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(UpdatesPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%';
		parent.style.width = '100%';

		const rootElt = document.createElement('div');
		rootElt.style.height = '100%';
		rootElt.style.width = '100%';
		parent.appendChild(rootElt);

		this.instantiationService.invokeFunction(accessor => {
			const disposeFn = mountUpdates(rootElt, accessor)?.dispose;
			this._register(toDisposable(() => disposeFn?.()))
		});
	}

	layout(dimension: Dimension): void { }

	override get minimumWidth() { return 600 }
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(UpdatesPane, UpdatesPane.ID, nls.localize('UpdatesPane', 'Updates')),
	[new SyncDescriptor(UpdatesInput)]
);

// opens (or focuses, if already open) the single Updates tab
export async function openUpdatesTab(instantiationService: IInstantiationService, editorService: IEditorService, editorGroupService: IEditorGroupsService): Promise<void> {
	const openEditors = editorService.findEditors(UpdatesInput.RESOURCE);
	if (openEditors.length > 0) {
		await editorGroupService.activeGroup.openEditor(openEditors[0].editor);
		return;
	}
	const input = instantiationService.createInstance(UpdatesInput);
	await editorService.openEditor(input);
}
