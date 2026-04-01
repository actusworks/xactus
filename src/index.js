// ─────────────────────────────────────────────────────────────────────────────
// Xactus — Lightweight declarative UI component library
// https://github.com/actusworks/xactus
// ─────────────────────────────────────────────────────────────────────────────

export { default } from './Xactus.js';
export { default as Xactus } from './Xactus.js';

// Utility exports for advanced use cases
export {
	diffState,
	getByPath,
	setByPath,
	parseTokens,
	evaluateCondition,
	updateShowBindings,
	updateEmptyPlaceholders,
} from './utils.js';
