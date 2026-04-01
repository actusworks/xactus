



// MARK: Diff State
// Compares two state objects and returns an array of changed paths
// ─────────────────────────────────────────────────
// Example:
// oldState = { a: 1, b: { c: 2 }, d: [1, 2] }
// newState = { a: 1, b: { c: 3 }, d: [1, 2, 3] }
// diffState(oldState, newState) => ['b:c', 'd:2']
// ─────────────────────────────────────────────────
export function diffState(oldState, newState, base = '') {
	let changes = [];

	// keys union
	const keys = new Set([
		...Object.keys(oldState || {}),
		...Object.keys(newState || {})
	]);

	for (const key of keys) {
		const oldVal = oldState?.[key];
		const newVal = newState?.[key];

		const path = base ? `${base}:${key}` : key;

		// array
		if (Array.isArray(oldVal) && Array.isArray(newVal)) {
			const max = Math.max(oldVal.length, newVal.length);

			for (let i = 0; i < max; i++) {
				const itemPath = `${path}:${i}`;
				const o = oldVal[i];
				const n = newVal[i];

				if (o == null || n == null || typeof o !== 'object' || typeof n !== 'object') {
					if (o !== n) changes.push(itemPath);
				} else {
					changes.push(...diffState(o, n, itemPath));
				}
			}
		}

		// object
		else if (isObject(oldVal) && isObject(newVal)) {
			changes.push(...diffState(oldVal, newVal, path));
		}

		// primitive change
		else if (oldVal !== newVal) {
			changes.push(path);
		}
	}

	return changes;
}






// MARK: State Update
// Applies a patch object to the state and returns an array of changed paths
// ─────────────────────────────────────────────────
// Example:
// state = { a: 1, b: { c: 2 } }
// setByPath(state, 'b:c', 5) => ['b:c']
// state is now { a: 1, b: { c: 5 } }
// ─────────────────────────────────────────────────
export function setByPath(obj, path, value, changes = []) {
	const parts = path.split(':');
	let target = obj;

	for (let i = 0; i < parts.length - 1; i++) {
		target = target[parts[i]];
		if (target == null) return changes;
	}

	const last = parts[parts.length - 1];
	if (target[last] !== value) {
		target[last] = value;
		changes.push(path);
	}

	return changes;
}




// MARK: State Get
// Retrieves a value from the state using a path string
// ─────────────────────────────────────────────────
// Example:
// state = { a: 1, b: { c: 5 } }
// getByPath(state, 'b:c') => 5
// getByPath(state, 'a') => 1
// getByPath(state, 'x') => undefined
// ─────────────────────────────────────────────────
export function getByPath(path, obj, fallback) {
	if (!path) return obj;

	const parts = path.split(':');
	let current = obj;

	for (const key of parts) {
		if (current == null) return fallback;
		current = current[key];
	}

	return current ?? fallback;
}





// MARK: DOM Update
// Updates all DOM elements with a given x-id attribute to reflect the current state value
// ─────────────────────────────────────────────────
// Example:
// state = { user: { name: 'Alice' } }
// <h1 x-id="user:name"></h1> => <h1 x-id="user:name">Alice</h1>
// ─────────────────────────────────────────────────
export function updateDOM(path, obj=currentState, mode='html', root=document) {
	let value
	if ( typeof obj === 'object' && obj !== null ) {
		value = getByPath(path, obj);
	} else {
		value = obj;
	}
	root.querySelectorAll(`[x-id="${path}"]`).forEach(el => {
		if (mode === 'html') {
            el.innerHTML = sanitize(value ?? '');
		} else if (mode === 'text') {
			el.textContent = sanitize(value ?? '');
		} else if (mode === 'add') {
			el.insertAdjacentHTML('beforeend', value ?? '');
		} else if (mode === 'delete') {
			el.remove();
		}
	});
}




// MARK: Get Template Element
// Retrieves the inner HTML template for a given selector from a larger HTML string
// ─────────────────────────────────────────────────
// Example:
// HTML: <div x-map="items"><div>{{ row.name }}</div></div>
// getTemplateElement(htmlString, '[x-map="items"]') => '<div>{{ row.name }}</div>'
// ─────────────────────────────────────────────────
export function getTemplateElement(str, selector) {
	const tpl = document.createElement('template');
	tpl.innerHTML = str.trim();

	const mapEl = tpl.content.querySelector(`${selector}`);
	if (!mapEl) return null;

	const child = mapEl.firstElementChild;
	return child ? child.outerHTML : null;
}












// MARK: Reindex Element
// ─────────────────────────────────────────────────
// When an item is added or removed from a list,
// we need to update the x-id attributes
// of all subsequent items to reflect their new index
// This function takes the root element of the changed item,
// the list key, and the new index,
// and updates all x-id attributes accordingly
// ─────────────────────────────────────────────────
export function reindexElement(el, listKey, newIdx) {
    const prefix = `${listKey}:`;
    const allEls = [el, ...el.querySelectorAll('[x-id]')];

    allEls.forEach(node => {
        const xid = node.getAttribute('x-id');
        if (!xid || !xid.startsWith(prefix)) return;

        // Replace the old index with the new one
        // e.g. "items:3:name" → capture "3" and replace with newIdx
        const rest = xid.slice(prefix.length);
        const oldIdx = rest.split(':')[0];
        const tail = rest.slice(oldIdx.length); // ":name" or ""
        node.setAttribute('x-id', `${prefix}${newIdx}${tail}`);
    });
}









// MARK: Parse Tokens
// ─────────────────────────────────────────────────
/**
 * Finds all [[token]] patterns in a string.
 * @param {string} str - The input string to search.
 * @param {Object} [replacements] - Optional map of token names to replacement values.
 *   - Omit to get back an array of found token names.
 *   - Pass an object like { name: 'John', city: 'NY' } to get back the replaced string.
 *   - Tokens with no matching key are left as-is.
 * @returns {string[] | string}
 *
 * @example
 * parseTokens('Hello [[name]], welcome to [[city]]!')
 * // → ['name', 'city']
 *
 * parseTokens('Hello [[name]]!', { name: 'John' })
 * // → 'Hello John!'
 */
export function parseTokens(str, replacements, open='[[', close=']]') {
	const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`${esc(open)}\\s*(.*?)\\s*${esc(close)}`, 'g');

	if (replacements === undefined) {
		const names = [];
		let match;
		while ((match = pattern.exec(str)) !== null) {
			names.push(match[1]);
		}
		return names;
	}

	return str.replace(pattern, (full, name) =>
		Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : full
	);
}
























// MARK: HELPERS
// ════════════════════════════════════════════════════




// ─────────────────────────────────────────────────
function isObject(v) {
	return v && typeof v === 'object' && !Array.isArray(v);
}




function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}



// MARK: Evaluate Condition
// ─────────────────────────────────────────────────
// Evaluates an x-if expression against a scope object.
// Supports: truthy, negation (!), comparison (===, !==, >, <, >=, <=)
// ─────────────────────────────────────────────────
export function evaluateCondition(expr, scope) {
	const resolvePath = (obj, p) => p.split('.').reduce((acc, k) => acc?.[k], obj);

	if (expr.startsWith('!') && !/[=<>]/.test(expr)) {
		return !resolvePath(scope, expr.slice(1));
	}

	const match = expr.match(/^(.+?)\s*(===|!==|>=|<=|>|<)\s*(.+)$/);
	if (match) {
		const left = resolvePath(scope, match[1].trim());
		const op = match[2];
		const rawRight = match[3].trim();

		let right;
		if (rawRight === 'true')            right = true;
		else if (rawRight === 'false')      right = false;
		else if (rawRight === 'null')       right = null;
		else if (/^['"].*['"]$/.test(rawRight)) right = rawRight.slice(1, -1);
		else if (!isNaN(rawRight))          right = Number(rawRight);
		else                                right = resolvePath(scope, rawRight);

		switch (op) {
			case '===': return left === right;
			case '!==': return left !== right;
			case '>':   return left > right;
			case '<':   return left < right;
			case '>=':  return left >= right;
			case '<=':  return left <= right;
		}
	}

	return !!resolvePath(scope, expr);
}



// MARK: Update Conditionals
// ─────────────────────────────────────────────────
// Re-evaluates all x-if / x-else-if / x-else chains in the live DOM.
// ifTemplates : { expr → outerHTML, 'x-else-if:expr' → outerHTML, 'x-else:ifExpr' → outerHTML }
// ifChains    : { ifExpr → [ {type, expr, html}, ... ] }
// renderFn    : (templateStr, state) → rendered HTML string
// ─────────────────────────────────────────────────
export function updateConditionals(root, state, ifTemplates, renderFn, ifChains = {}) {
	// Collect all chain-head positions (visible x-if elements OR x-if: comments)
	// We'll process each chain exactly once.

	const processedExprs = new Set();

	// Helper: render a template string into a live DOM element
	function renderEl(templateHtml) {
		const rendered = renderFn(templateHtml, state);
		const tpl = document.createElement('template');
		tpl.innerHTML = rendered;
		return tpl.content.firstElementChild;
	}

	// Helper: resolve a slot in the DOM.
	// slotNode is either the current live element (x-if / x-else-if / x-else attr) or comment node.
	// Returns the actual node we should replace/keep, and its current type.
	function resolveSlot(node) {
		if (node.nodeType === Node.COMMENT_NODE) return node;
		return node;
	}

	// Walk the DOM and find all chain heads (x-if elements or x-if: comments)
	// We use a TreeWalker for comments + querySelectorAll for visible elements.
	const heads = [];

	// Visible x-if heads
	for (const el of root.querySelectorAll('[x-if]')) {
		const expr = el.getAttribute('x-if').trim();
		if (!processedExprs.has(expr)) heads.push({ node: el, expr, isComment: false });
	}

	// Comment x-if heads
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
	while (walker.nextNode()) {
		const data = walker.currentNode.data;
		if (!data.startsWith('x-if:')) continue;
		const expr = data.slice(5);
		if (!processedExprs.has(expr)) heads.push({ node: walker.currentNode, expr, isComment: true });
	}

	for (const { node: headNode, expr: ifExpr } of heads) {
		if (processedExprs.has(ifExpr)) continue;
		processedExprs.add(ifExpr);

		const chain = ifChains[ifExpr];

		// No chain info → fall back to simple if/comment toggle
		if (!chain) {
			if (headNode.nodeType === Node.COMMENT_NODE) {
				if (evaluateCondition(ifExpr, state) && ifTemplates[ifExpr]) {
					const newEl = renderEl(ifTemplates[ifExpr]);
					headNode.parentNode.replaceChild(newEl, headNode);
				}
			} else {
				if (!evaluateCondition(ifExpr, state)) {
					const comment = document.createComment(`x-if:${ifExpr}`);
					headNode.parentNode.replaceChild(comment, headNode);
				}
			}
			continue;
		}

		// Evaluate which chain entry wins
		let winnerIdx = -1;
		for (let i = 0; i < chain.length; i++) {
			const entry = chain[i];
			if (entry.type === 'if' || entry.type === 'else-if') {
				if (evaluateCondition(entry.expr, state)) { winnerIdx = i; break; }
			} else {
				// x-else always wins if we reach it
				winnerIdx = i; break;
			}
		}

		// Collect current DOM slots for each chain entry, starting from headNode
		// Slots are adjacent siblings; some may be elements (visible) or comments (hidden).
		const slots = [headNode];
		let cursor = headNode.nextSibling;
		for (let i = 1; i < chain.length; i++) {
			// Advance past text nodes (whitespace)
			while (cursor && cursor.nodeType === Node.TEXT_NODE) cursor = cursor.nextSibling;
			if (!cursor) break;

			const entry = chain[i];
			if (entry.type === 'else-if') {
				// Could be a live element with x-else-if or a comment x-else-if:expr
				const isMatch =
					(cursor.nodeType === Node.ELEMENT_NODE && cursor.hasAttribute('x-else-if') && cursor.getAttribute('x-else-if').trim() === entry.expr) ||
					(cursor.nodeType === Node.COMMENT_NODE && cursor.data === `x-else-if:${entry.expr}`);
				if (isMatch) { slots.push(cursor); cursor = cursor.nextSibling; }
				else break;
			} else if (entry.type === 'else') {
				const isMatch =
					(cursor.nodeType === Node.ELEMENT_NODE && cursor.hasAttribute('x-else')) ||
					(cursor.nodeType === Node.COMMENT_NODE && cursor.data === `x-else:${ifExpr}`);
				if (isMatch) { slots.push(cursor); cursor = cursor.nextSibling; }
				else break;
			}
		}

		// Now update each slot
		for (let i = 0; i < slots.length; i++) {
			const slot = slots[i];
			const entry = chain[i];
			const shouldShow = i === winnerIdx;

			if (shouldShow) {
				// Slot should be visible
				if (slot.nodeType === Node.COMMENT_NODE) {
					// Replace comment with rendered element
					const newEl = renderEl(entry.html);
					if (newEl) slot.parentNode.replaceChild(newEl, slot);
				}
				// If already a live element, nothing to do
			} else {
				// Slot should be hidden (comment)
				if (slot.nodeType !== Node.COMMENT_NODE) {
					const label = entry.type === 'if'
						? `x-if:${entry.expr}`
						: entry.type === 'else-if'
							? `x-else-if:${entry.expr}`
							: `x-else:${ifExpr}`;
					const comment = document.createComment(label);
					slot.parentNode.replaceChild(comment, slot);
				}
			}
		}
	}
}



// MARK: Update Empty Placeholders
// ─────────────────────────────────────────────────
// Re-evaluates all x-empty elements in the live DOM.
// Shows the element when its bound array is empty, hides it otherwise.
// ─────────────────────────────────────────────────
export function updateEmptyPlaceholders(root, state) {
	const resolvePath = (obj, p) => p.split('.').reduce((acc, k) => acc?.[k], obj);
	for (const el of root.querySelectorAll('[x-empty]')) {
		const key = el.getAttribute('x-empty').trim();
		const items = resolvePath(state, key);
		el.style.display = (Array.isArray(items) && items.length === 0) ? '' : 'none';
	}
}



// MARK: Update Show Bindings
// ─────────────────────────────────────────────────
// Re-evaluates all x-show conditions in the live DOM.
// Toggles display:none without touching the DOM structure.
// ─────────────────────────────────────────────────
export function updateShowBindings(root, state) {
	for (const el of root.querySelectorAll('[x-show]')) {
		const expr = el.getAttribute('x-show').trim();
		el.style.display = evaluateCondition(expr, state) ? '' : 'none';
	}
}



// MARK: Update Class Bindings
// ─────────────────────────────────────────────────
// Re-evaluates all x-class attributes in the live DOM
// ─────────────────────────────────────────────────
export function updateClassBindings(root, state) {
	const resolvePath = (obj, p) => p.split('.').reduce((acc, k) => acc?.[k], obj);
	for (const el of root.querySelectorAll('[x-class]')) {
		const rules = el.getAttribute('x-class').split(',');
		for (const rule of rules) {
			const sep = rule.indexOf(':');
			if (sep === -1) continue;
			const className = rule.slice(0, sep).trim();
			const expr = rule.slice(sep + 1).trim();
			const value = resolvePath(state, expr);
			if (value) el.classList.add(className);
			else       el.classList.remove(className);
		}
	}
}


