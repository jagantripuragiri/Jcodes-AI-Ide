import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import * as nls from '../../../../nls.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { $, append, Dimension } from '../../../../base/browser/dom.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { URI } from '../../../../base/common/uri.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { FileAccess } from '../../../../base/common/network.js';
import { asCSSUrl } from '../../../../base/browser/cssValue.js';

class VoidAboutInput extends EditorInput {

	static readonly ID: string = 'workbench.input.void.about';

	static readonly RESOURCE = URI.from({
		scheme: 'void',
		path: 'about'
	})
	readonly resource = VoidAboutInput.RESOURCE;

	constructor() {
		super();
	}

	override get typeId(): string {
		return VoidAboutInput.ID;
	}

	override getName(): string {
		return nls.localize('voidAboutInputsName', 'About');
	}

	override getIcon() {
		return Codicon.info
	}

}


function addLink(parent: HTMLElement, openerService: IOpenerService, text: string, href: string): HTMLElement {
	const a = append(parent, $('a')) as HTMLAnchorElement;
	a.textContent = text;
	a.href = href;
	a.style.cursor = 'pointer';
	a.style.color = 'var(--vscode-textLink-foreground)';
	a.addEventListener('click', (e) => {
		e.preventDefault();
		openerService.open(URI.parse(href));
	});
	return a;
}

class VoidAboutPane extends EditorPane {
	static readonly ID = 'workbench.void.aboutPane';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IProductService private readonly productService: IProductService,
	) {
		super(VoidAboutPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%';
		parent.style.width = '100%';
		parent.style.overflow = 'auto';

		const root = append(parent, $('div'));
		root.style.maxWidth = '720px';
		root.style.margin = '0 auto';
		root.style.padding = '48px 24px';
		root.style.lineHeight = '1.6';
		root.style.userSelect = 'text';

		const header = append(root, $('div'));
		header.style.display = 'flex';
		header.style.alignItems = 'center';
		header.style.gap = '16px';

		const logo = append(header, $('div'));
		logo.style.backgroundImage = asCSSUrl(FileAccess.asBrowserUri('vs/workbench/browser/media/void-icon-sm.png'));
		logo.style.backgroundSize = 'contain';
		logo.style.backgroundRepeat = 'no-repeat';
		logo.style.width = '64px';
		logo.style.height = '64px';
		logo.style.borderRadius = '12px';
		logo.style.flexShrink = '0';

		const headerText = append(header, $('div'));

		const h1 = append(headerText, $('h1'));
		h1.textContent = this.productService.nameLong;
		h1.style.margin = '0';

		const version = append(headerText, $('p'));
		version.style.opacity = '0.7';
		version.style.marginTop = '0';
		version.textContent = `Version ${this.productService.version ?? ''}`.trim();

		const appSection = append(root, $('section'));
		const appP1 = append(appSection, $('p'));
		appP1.textContent = `${this.productService.nameLong} is an AI-powered code editor built to make software development faster, smarter, and more intuitive.`;

		const appP2 = append(appSection, $('p'));
		appP2.textContent = `Built on the foundation of Visual Studio Code and inspired by the AI-first approach of modern coding tools, ${this.productService.nameLong} combines a powerful development environment with integrated AI assistance for coding, debugging, understanding code, and building applications.`;

		const h2License = append(root, $('h2'));
		h2License.textContent = nls.localize('voidAboutLicenseHeader', 'Open Source & Attribution');

		const licenseP1 = append(root, $('p'));
		append(licenseP1, $('span')).textContent = 'This application is built on ';
		addLink(licenseP1, this.openerService, 'Visual Studio Code', 'https://github.com/microsoft/vscode');
		append(licenseP1, $('span')).textContent = ' (Copyright © Microsoft Corporation, MIT License) and ';
		addLink(licenseP1, this.openerService, 'Void', 'https://github.com/voideditor/void');
		append(licenseP1, $('span')).textContent = ' (Copyright © Glass Devtools, Inc., Apache License 2.0).';

		const licenseP2 = append(root, $('p'));
		licenseP2.textContent = `${this.productService.nameLong} is an independent project and is not affiliated with, endorsed by, or sponsored by Microsoft or Glass Devtools, Inc. All trademarks belong to their respective owners.`;

		const licenseP3 = append(root, $('p'));
		append(licenseP3, $('span')).textContent = 'See ';
		addLink(licenseP3, this.openerService, 'LICENSE.txt', 'https://github.com/voideditor/void/blob/main/LICENSE.txt');
		append(licenseP3, $('span')).textContent = ' and ';
		addLink(licenseP3, this.openerService, 'ThirdPartyNotices.txt', 'https://github.com/microsoft/vscode/blob/main/ThirdPartyNotices.txt');
		append(licenseP3, $('span')).textContent = ' for applicable license and third-party notices.';

		const h2Dev = append(root, $('h2'));
		h2Dev.textContent = nls.localize('voidAboutDeveloperHeader', 'Developer');

		const devP1 = append(root, $('p'));
		devP1.textContent = `Jagan Tripuragiri is the creator and developer of ${this.productService.nameLong}, an AI-focused developer and software engineer from India`;

		const devP2 = append(root, $('p'));
		devP2.textContent = 'Jagan works on AI engineering, developer tools, automation, SaaS applications, and modern web technologies, with a focus on building practical tools that improve the software development experience.';

		const devP3 = append(root, $('p'));
		append(devP3, $('span')).textContent = 'GitHub: ';
		addLink(devP3, this.openerService, 'github.com/jagantripuragiri', 'https://github.com/jagantripuragiri');

		const devPLinkedin = append(root, $('p'));
		append(devPLinkedin, $('span')).textContent = 'LinkedIn: ';
		addLink(devPLinkedin, this.openerService, 'linkedin.com/in/jagantripuragir', 'https://www.linkedin.com/in/jagantripuragiri');

		const devP4 = append(root, $('p'));
		devP4.textContent = `${this.productService.nameLong} is an independent project created and maintained by Jagan Tripuragiri, built on top of VS Code by Microsoft and Void by Glass Devtools.`;
	}

	layout(dimension: Dimension): void {
		// no-op: content scrolls naturally
	}

	override get minimumWidth() { return 400 }

}

// register About pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(VoidAboutPane, VoidAboutPane.ID, nls.localize('VoidAboutPane', "About")),
	[new SyncDescriptor(VoidAboutInput)]
);

export const VOID_SHOW_ABOUT_ACTION_ID = 'workbench.action.showVoidAbout'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_SHOW_ABOUT_ACTION_ID,
			title: nls.localize2('voidShowAbout', "About"),
			f1: true,
			icon: Codicon.info,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const editorGroupService = accessor.get(IEditorGroupsService);
		const instantiationService = accessor.get(IInstantiationService);

		const openEditors = editorService.findEditors(VoidAboutInput.RESOURCE);
		if (openEditors.length !== 0) {
			const openEditor = openEditors[0].editor
			const isCurrentlyOpen = editorService.activeEditor?.resource?.fsPath === openEditor.resource?.fsPath
			if (isCurrentlyOpen)
				await editorService.closeEditors(openEditors)
			else
				await editorGroupService.activeGroup.openEditor(openEditor)
			return;
		}

		const input = instantiationService.createInstance(VoidAboutInput);
		await editorGroupService.activeGroup.openEditor(input);
	}
})
