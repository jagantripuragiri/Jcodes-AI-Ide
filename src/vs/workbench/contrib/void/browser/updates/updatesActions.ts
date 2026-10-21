// J Codes Updates — commands. Standalone, same shape as tokenUsage/tokenUsageActions.ts.

import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { VOID_VIEW_ID } from '../sidebarPane.js';

import { openUpdatesTab } from './updatesPane.js';

export const JCODES_UPDATES_OPEN_ACTION_ID = 'jcodes.updates.open'

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: JCODES_UPDATES_OPEN_ACTION_ID,
			title: localize2('jcodesUpdatesOpen', 'J Codes: Show Updates'),
			icon: Codicon.cloudDownload,
			f1: true,
			// toolbar button in the chat panel's title bar, between GitHub (5) and Settings (6)
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', order: 5.5, when: ContextKeyExpr.equals('view', VOID_VIEW_ID) }],
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService)
		const editorService = accessor.get(IEditorService)
		const editorGroupService = accessor.get(IEditorGroupsService)
		await openUpdatesTab(instantiationService, editorService, editorGroupService)
	}
})
