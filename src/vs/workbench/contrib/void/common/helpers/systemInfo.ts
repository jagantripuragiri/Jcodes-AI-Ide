import { isLinux, isMacintosh, isWindows } from '../../../../../base/common/platform.js';

// import { OS, OperatingSystem } from '../../../../../base/common/platform.js';
// alternatively could use ^ and OS === OperatingSystem.Windows ? ...



export const os = isWindows ? 'windows' : isMacintosh ? 'mac' : isLinux ? 'linux' : null

