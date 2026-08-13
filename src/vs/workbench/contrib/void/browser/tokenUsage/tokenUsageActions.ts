// Token Usage — commands. Standalone from Project Brain (see tokenUsagePane.ts).

import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { VOID_VIEW_ID } from '../sidebarPane.js';

import { openTokenUsageTab } from './tokenUsagePane.js';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'tokenUsage.open',
			title: localize2('tokenUsageOpen', 'J Codes: Show Token Usage'),
			icon: Codicon.graphLine,
			f1: true,
			// toolbar button in the chat panel's title bar, next to History/Project Brain/GitHub/Settings
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', order: 3, when: ContextKeyExpr.equals('view', VOID_VIEW_ID) }],
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService)
		const editorService = accessor.get(IEditorService)
		const editorGroupService = accessor.get(IEditorGroupsService)
		await openTokenUsageTab(instantiationService, editorService, editorGroupService)
	}
})
