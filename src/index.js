// ─────────────────────────────────────────────────────────────────────────────
// Xactus — Lightweight declarative UI component library
// https://github.com/actusworks/xactus
// ─────────────────────────────────────────────────────────────────────────────

export { default } from './Xactus.js';
export { default as Xactus } from './Xactus.js';
export { default as init } from './Xactus.js';

// Utility exports for advanced use cases
let debug1 = () => { console.log('Debug function 1') }
export { debug1 }
export {
	diffState,
	getByPath,
	setByPath,
	parseTokens,
	evaluateCondition,
	updateShowBindings,
	updateEmptyPlaceholders,
} from './utils.js';
