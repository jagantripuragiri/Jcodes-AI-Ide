// Project Brain — persistence.
// The index is one JSON document per workspace root, written to .jcodes/brain/index.json via
// IFileService. Deliberately NOT IStorageService: that pattern (used for chat threads/settings)
// stores one giant blob per key which doesn't scale to a whole-repo index, and a real on-disk
// file lets the brain survive being deleted/rebuilt without touching unrelated app state.

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ProjectBrainIndex } from '../../common/projectBrain/projectBrainTypes.js';

const BRAIN_DIR_NAME = '.jcodes'
const BRAIN_SUBDIR_NAME = 'brain'
const BRAIN_FILE_NAME = 'index.json'
const INDEX_VERSION = 1

export const getBrainDirUri = (workspaceRootURI: URI): URI => URI.joinPath(workspaceRootURI, BRAIN_DIR_NAME, BRAIN_SUBDIR_NAME)
export const getBrainIndexUri = (workspaceRootURI: URI): URI => URI.joinPath(getBrainDirUri(workspaceRootURI), BRAIN_FILE_NAME)

export async function readProjectBrainIndex(fileService: IFileService, workspaceRootURI: URI): Promise<ProjectBrainIndex | null> {
	const uri = getBrainIndexUri(workspaceRootURI)
	try {
		const exists = await fileService.exists(uri)
		if (!exists) return null
		const content = await fileService.readFile(uri)
		const parsed = JSON.parse(content.value.toString())
		if (!parsed || typeof parsed !== 'object' || parsed.version !== INDEX_VERSION) return null
		return parsed as ProjectBrainIndex
	} catch (e) {
		// corrupt JSON, permission error, etc — treat as "no brain yet" rather than crashing the workbench;
		// the UI will offer to rebuild, same recovery shape as the settings plaintext-backup fallback
		console.error('[Project Brain] Failed to read persisted index; will offer a rebuild.', e)
		return null
	}
}

export async function writeProjectBrainIndex(fileService: IFileService, workspaceRootURI: URI, index: ProjectBrainIndex): Promise<void> {
	const dirUri = getBrainDirUri(workspaceRootURI)
	const fileUri = getBrainIndexUri(workspaceRootURI)
	try {
		await fileService.createFolder(dirUri)
	} catch {
		// already exists, or the provider auto-creates parent folders on writeFile - either way not fatal
	}
	await fileService.writeFile(fileUri, VSBuffer.fromString(JSON.stringify(index)))
}
