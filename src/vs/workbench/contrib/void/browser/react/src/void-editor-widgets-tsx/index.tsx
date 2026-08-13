import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { VoidCommandBarMain } from './VoidCommandBar.js'
import { VoidSelectionHelperMain } from './VoidSelectionHelper.js'

export const mountVoidCommandBar = mountFnGenerator(VoidCommandBarMain)

export const mountVoidSelectionHelper = mountFnGenerator(VoidSelectionHelperMain)

