// Project Brain — commands, editor context menu entries.
// No default keybinding is registered: Cmd/Ctrl+Shift+B collides with the built-in "Run Build
// Task", and the fallback combos we checked were also taken. Every other J Codes command in this
// area (Settings, History, Token Usage) ships palette/menu-only too, so this matches precedent.

import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';

import { IProjectBrainService } from './projectBrainService.js';
import { openProjectBrainTab } from './projectBrainPane.js';
import { toRelPath } from './projectBrainScanner.js';
import { ProjectBrainNavigationRequest } from '../../common/projectBrain/projectBrainTypes.js';
import { VOID_VIEW_ID } from '../sidebarPane.js';

const MAX_SELECTION_CHARS_IN_PREFILL = 4000

const openAndNavigate = async (accessor: ServicesAccessor, nav?: ProjectBrainNavigationRequest): Promise<void> => {
	const instantiationService = accessor.get(IInstantiationService)
	const editorService = accessor.get(IEditorService)
	const editorGroupService = accessor.get(IEditorGroupsService)
	const projectBrainService = accessor.get(IProjectBrainService)

	await openProjectBrainTab(instantiationService, editorService, editorGroupService)
	if (nav) projectBrainService.requestNavigate(nav)
}

const currentFileRelPath = (accessor: ServicesAccessor): string | null => {
	const editor = accessor.get(ICodeEditorService).getActiveCodeEditor()
	const model = editor?.getModel()
	if (!model) return null
	const folders = accessor.get(IWorkspaceContextService).getWorkspace().folders
	if (folders.length === 0) return null
	return toRelPath(folders[0].uri, model.uri)
}

const runExplainFile = async (accessor: ServicesAccessor, relPath: string | null): Promise<void> => {
	if (!relPath) {
		accessor.get(INotificationService).info(localize2('projectBrainNoActiveFile', 'Open a file to explain it with Project Brain.').value)
		return
	}
	await openAndNavigate(accessor, { tab: 'files', focusRelPath: relPath })
}

// ---------- command palette ----------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.open',
			title: localize2('projectBrainOpen', 'J Codes: Open Project Brain'),
			icon: Codicon.circuitBoard,
			f1: true,
			// also shown as a toolbar button in the chat panel's title bar, next to History/Token Usage/GitHub/Settings
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', order: 4, when: ContextKeyExpr.equals('view', VOID_VIEW_ID) }],
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await openAndNavigate(accessor)
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.build',
			title: localize2('projectBrainBuild', 'J Codes: Build Project Brain'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await openAndNavigate(accessor, { tab: 'overview' })
		accessor.get(IProjectBrainService).buildBrain()
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.refresh',
			title: localize2('projectBrainRefresh', 'J Codes: Refresh Project Brain'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await openAndNavigate(accessor, { tab: 'overview' })
		accessor.get(IProjectBrainService).refreshBrain()
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.ask',
			title: localize2('projectBrainAsk', 'J Codes: Ask Project Brain'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await openAndNavigate(accessor, { tab: 'ask' })
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.explainCurrentFile',
			title: localize2('projectBrainExplainCurrentFile', 'J Codes: Explain Current File'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await runExplainFile(accessor, currentFileRelPath(accessor))
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.showArchitecture',
			title: localize2('projectBrainShowArchitecture', 'J Codes: Show Architecture'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await openAndNavigate(accessor, { tab: 'architecture' })
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.showChanges',
			title: localize2('projectBrainShowChanges', 'J Codes: Show Project Changes'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await openAndNavigate(accessor, { tab: 'activity' })
	}
})

// ---------- editor context menu ----------

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.explainWithContextMenu',
			title: localize2('projectBrainExplainContextMenu', 'Explain with Project Brain'),
			f1: false,
			menu: [{ id: MenuId.EditorContext, group: '1_projectBrain', order: 1 }],
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await runExplainFile(accessor, currentFileRelPath(accessor))
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'projectBrain.askAboutSelection',
			title: localize2('projectBrainAskSelection', 'Ask Project Brain About Selection'),
			f1: false,
			menu: [{ id: MenuId.EditorContext, group: '1_projectBrain', order: 2, when: EditorContextKeys.hasNonEmptySelection }],
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const editor = accessor.get(ICodeEditorService).getActiveCodeEditor()
		const model = editor?.getModel()
		const selection = editor?.getSelection()
		if (!model || !selection || selection.isEmpty()) return

		const selectedText = model.getValueInRange(selection).slice(0, MAX_SELECTION_CHARS_IN_PREFILL)
		const relPath = currentFileRelPath(accessor)
		const prefillQuestion = `Explain this code${relPath ? ` from ${relPath}` : ''}:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\n`

		await openAndNavigate(accessor, { tab: 'ask', prefillQuestion })
	}
})
