// GitHub Accounts — commands. Mirrors tokenUsage/tokenUsageActions.ts for the tab-opener, and adds the
// command-palette entry points from the GitHub Account Manager spec (Add/Switch/Refresh). All of them
// go through IGitHubAccountService - the palette and the dashboard UI are two front-ends on one service,
// never two copies of the switching logic.

import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { VOID_VIEW_ID } from '../sidebarPane.js';

import { openGitHubAccountsTab } from './githubAccountsPane.js';
import { IGitHubAccountService } from '../voidGitHubService.js';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'github.accounts.open',
			title: localize2('githubAccountsOpen', 'GitHub: Manage Accounts'),
			icon: Codicon.github,
			f1: true,
			// toolbar button in the chat panel's title bar, next to History/Token Usage/Project Brain/Settings
			menu: [{ id: MenuId.ViewTitle, group: 'navigation', order: 5, when: ContextKeyExpr.equals('view', VOID_VIEW_ID) }],
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService)
		const editorService = accessor.get(IEditorService)
		const editorGroupService = accessor.get(IEditorGroupsService)
		await openGitHubAccountsTab(instantiationService, editorService, editorGroupService)
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'github.accounts.add',
			title: localize2('githubAccountsAdd', 'GitHub: Add Account'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService)
		const editorService = accessor.get(IEditorService)
		const editorGroupService = accessor.get(IEditorGroupsService)
		const githubAccountService = accessor.get(IGitHubAccountService)
		await openGitHubAccountsTab(instantiationService, editorService, editorGroupService)
		githubAccountService.startLogin()
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'github.accounts.switch',
			title: localize2('githubAccountsSwitch', 'GitHub: Switch Account'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService)
		const githubAccountService = accessor.get(IGitHubAccountService)
		const notificationService = accessor.get(INotificationService)

		await githubAccountService.refresh()
		const { accounts } = githubAccountService.state

		if (accounts.length === 0) {
			notificationService.info(localize2('githubAccountsNoneToSwitch', 'No GitHub accounts are connected yet. Use "GitHub: Add Account" first.').value)
			return
		}

		const picked = await quickInputService.pick<IQuickPickItem & { login: string }>(
			accounts.map(a => ({
				label: a.isActive ? `$(check) @${a.login}` : `@${a.login}`,
				description: a.isActive ? localize2('githubAccountsActiveLabel', 'Active').value : (a.name ?? undefined),
				login: a.login,
			})),
			{ placeHolder: localize2('githubAccountsSwitchPlaceholder', 'Select a GitHub account to make active').value }
		)
		if (!picked || picked.login === accounts.find(a => a.isActive)?.login) return
		await githubAccountService.switchAccount(picked.login)
	}
})

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'github.accounts.refresh',
			title: localize2('githubAccountsRefresh', 'GitHub: Refresh Accounts'),
			f1: true,
		})
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const githubAccountService = accessor.get(IGitHubAccountService)
		await githubAccountService.refresh()
	}
})
