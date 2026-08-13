import { _electron as electron } from 'playwright-core';
import path from 'node:path';

const APP_DIR = '/Users/jagantripuragiri/Desktop/Vs-code-Fork';
const electronBin = path.join(APP_DIR, ".build/electron/J code's.app/Contents/MacOS/Electron");

const app = await electron.launch({
	executablePath: electronBin,
	args: ['--no-sandbox', '.', '--disable-extension=vscode.vscode-api-tests'],
	cwd: APP_DIR,
	env: { ...process.env, NODE_ENV: 'development', VSCODE_DEV: '1', VSCODE_CLI: '1', ELECTRON_RUN_AS_NODE: '' },
	timeout: 60000,
});

await new Promise(r => setTimeout(r, 10000));
const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();

async function openCommand(cmd) {
	await page.keyboard.press('Meta+Shift+P');
	await page.waitForTimeout(500);
	await page.keyboard.type(cmd, { delay: 30 });
	await page.waitForTimeout(800);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(3000);
}

await openCommand('Project Brain');
await page.waitForTimeout(1000);
await openCommand('View: Close Panel');
await page.waitForTimeout(1000);

const clicked = await page.evaluate(() => {
	const btns = [...document.querySelectorAll('button')];
	const b = btns.find(x => x.textContent?.trim() === 'Architecture');
	if (!b) return false;
	b.click();
	return true;
});
console.log('clicked Architecture tab:', clicked);
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/shots/arch-full-tab.png' });

// also click each node to see the detail panel
const nodeClicked = await page.evaluate(() => {
	const btns = [...document.querySelectorAll('button')];
	const b = btns.find(x => x.textContent?.includes('Services'));
	if (!b) return false;
	b.click();
	return true;
});
console.log('clicked a node:', nodeClicked);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/shots/arch-full-tab-selected.png' });

await app.close();
