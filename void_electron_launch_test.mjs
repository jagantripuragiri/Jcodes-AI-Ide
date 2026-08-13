import { _electron as electron } from 'playwright-core';

const APP_DIR = '/Users/jagantripuragiri/Desktop/Vs-code-Fork';
const ELECTRON_BIN = `${APP_DIR}/.build/electron/J code's.app/Contents/MacOS/Electron`;
const USER_DATA_DIR = '/tmp/void-test-profile';

const app = await electron.launch({
	executablePath: ELECTRON_BIN,
	args: [APP_DIR, '--user-data-dir=' + USER_DATA_DIR, '--disable-extension=vscode.vscode-api-tests', '--skip-release-notes', '--skip-welcome'],
	env: { ...process.env, NODE_ENV: 'development', VSCODE_DEV: '1' },
	timeout: 60000,
});
console.log('launched. waiting for a window...');
await new Promise(r => setTimeout(r, 8000));
console.log('windows:', app.windows().map(w => w.url()));
const wcs = await app.evaluate(({ webContents }) => webContents.getAllWebContents().map(w => ({ id: w.id, type: w.getType(), url: w.getURL() })));
console.log('webContents:', JSON.stringify(wcs, null, 2));
await app.close();
