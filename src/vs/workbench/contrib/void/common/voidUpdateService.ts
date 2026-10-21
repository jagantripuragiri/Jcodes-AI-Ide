import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { JCodesRelease, JCodesUpdateProgress, VoidCheckUpdateRespose } from './voidUpdateServiceTypes.js';



export interface IVoidUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<VoidCheckUpdateRespose>;
	getRecentReleases: () => Promise<JCodesRelease[] | null>;
	// "Update now": download + verify the release `tag` in the background (watch getUpdateProgress), then restartToInstall
	startUpdate: (tag: string) => Promise<void>;
	getUpdateProgress: () => Promise<JCodesUpdateProgress>;
	cancelUpdate: () => Promise<void>;
	restartToInstall: () => Promise<void>;
}


export const IVoidUpdateService = createDecorator<IVoidUpdateService>('VoidUpdateService');


// implemented by calling channel
export class VoidUpdateService implements IVoidUpdateService {

	readonly _serviceBrand: undefined;
	private readonly voidUpdateService: IVoidUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.voidUpdateService = ProxyChannel.toService<IVoidUpdateService>(mainProcessService.getChannel('void-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IVoidUpdateService['check'] = async (explicit) => {
		const res = await this.voidUpdateService.check(explicit)
		return res
	}

	getRecentReleases: IVoidUpdateService['getRecentReleases'] = async () => {
		const res = await this.voidUpdateService.getRecentReleases()
		return res
	}

	startUpdate: IVoidUpdateService['startUpdate'] = async (tag) => {
		await this.voidUpdateService.startUpdate(tag)
	}

	getUpdateProgress: IVoidUpdateService['getUpdateProgress'] = async () => {
		const res = await this.voidUpdateService.getUpdateProgress()
		return res
	}

	cancelUpdate: IVoidUpdateService['cancelUpdate'] = async () => {
		await this.voidUpdateService.cancelUpdate()
	}

	restartToInstall: IVoidUpdateService['restartToInstall'] = async () => {
		await this.voidUpdateService.restartToInstall()
	}
}

registerSingleton(IVoidUpdateService, VoidUpdateService, InstantiationType.Eager);


