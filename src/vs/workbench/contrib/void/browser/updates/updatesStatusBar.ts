// J Codes Updates — shows an "Update available" item in the status bar (bottom right) while a newer release exists.
// Clicking it opens the Updates tab.

import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { IntervalTimer } from '../../../../../base/common/async.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../common/contributions.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../../services/statusbar/browser/statusbar.js';
import { IJCodesUpdatesService } from './jcodesUpdatesService.js';
import { JCODES_UPDATES_OPEN_ACTION_ID } from './updatesActions.js';

const RECHECK_EVERY_MS = 3 * 60 * 60 * 1000 // 3 hours

class JCodesUpdatesStatusBarContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.void.updatesStatusBar'

	private readonly _entry = this._register(new MutableDisposable<IStatusbarEntryAccessor>())

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IJCodesUpdatesService private readonly _updatesService: IJCodesUpdatesService,
	) {
		super()

		this._register(this._updatesService.onDidChangeState(() => this._sync()))

		this._updatesService.refresh()
		this._register(new IntervalTimer()).cancelAndSet(() => this._updatesService.refresh(), RECHECK_EVERY_MS)
	}

	private _sync() {
		const { updateAvailable, latest } = this._updatesService.state

		if (!updateAvailable || !latest) {
			this._entry.clear()
			return
		}

		const entry: IStatusbarEntry = {
			name: 'J Codes Updates',
			text: `$(cloud-download) Update available: ${latest.tag}`,
			ariaLabel: `A new version of J Codes is available: ${latest.tag}`,
			tooltip: 'Click to see what is new and download it',
			command: JCODES_UPDATES_OPEN_ACTION_ID,
			kind: 'prominent',
		}

		if (this._entry.value) {
			this._entry.value.update(entry)
		} else {
			this._entry.value = this._statusbarService.addEntry(entry, 'jcodes.updates', StatusbarAlignment.RIGHT, 100)
		}
	}
}

registerWorkbenchContribution2(JCodesUpdatesStatusBarContribution.ID, JCodesUpdatesStatusBarContribution, WorkbenchPhase.Eventually);
