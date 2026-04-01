import { evaluateCondition } 	from './utils.js';
// ════════════════════════════════════════════════════




export default function renderTemplate(template, state, rowContext ='') {
	const tpl = document.createElement('template');
	tpl.innerHTML = template.trim();
	processNode(tpl.content, state, '', rowContext);
	return tpl.innerHTML;
}





function processNode(root, scope, path, rowContext ) {
	// Handle conditionals first — remove hidden elements before binding
	processConditionals(root, scope);

	// Handle x-map (repeater) blocks — process innermost first (depth-first)
	const allMapEls = [...root.querySelectorAll('[x-map]')];
	// Sort deepest nodes first so nested maps render before their parent clears innerHTML
	allMapEls.sort((a, b) => (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_CONTAINS ? -1 : 1));

	for (const mapEl of allMapEls) {
		const key = mapEl.getAttribute('x-map').trim();
		const items = resolve(scope, key);
		mapEl.setAttribute('x-id', join(path, key));
		const rowTemplate = mapEl.firstElementChild?.cloneNode(true);
		mapEl.innerHTML = '';

		if (!Array.isArray(items) || !rowTemplate) continue;

		items.forEach((row, idx) => {
			const rowNode = rowTemplate.cloneNode(true);
			const rowPath = join(join(path, key), String(idx));
			const rowScope = { row, idx };
			// Recursively process the row node so nested x-map blocks resolve against the row scope
			processNode(rowNode, rowScope, rowPath, { list: key, idx });
			rowNode.setAttribute('x-id', rowPath);
			mapEl.appendChild(rowNode);
		});
	}

	// Handle x-empty placeholders — show when the bound array is empty
	for (const el of root.querySelectorAll('[x-empty]')) {
		const key = el.getAttribute('x-empty').trim();
		const items = resolve(scope, key);
		el.style.display = (Array.isArray(items) && items.length === 0) ? '' : 'none';
	}

	// Handle {{ }} bindings outside repeaters
  bindAll(root, scope, path, rowContext !== null, rowContext);
}





function bindAll(root, scope, path, inRow, rowContext = null) {
	for (const el of [root, ...root.querySelectorAll('*')]) {
		if (!el.setAttribute) continue; // skip DocumentFragment
		// Text binding: <tag>{{ expr }}</tag>
		if (!el.children.length) {
			const raw = el.textContent;
			const matches = [...raw.matchAll(/{{\s*([^}]+)\s*}}/g)];

			if (matches.length === 1 && raw.trim() === matches[0][0].trim()) {
				// Single binding — set x-id directly on element
				const { value, xid } = evaluate(matches[0][1].trim(), scope, path, inRow, rowContext);
				el.textContent = value ?? '';
				el.setAttribute('x-id', xid);
			}
			else if (matches.length > 0) {
				// Multiple bindings — wrap each in <x-o>
				// escapeHtml prevents XSS when user data is embedded in the HTML string
				el.innerHTML = raw.replace(/{{\s*([^}]+)\s*}}/g, (match, expr) => {
					const { value, xid } = evaluate(expr.trim(), scope, path, inRow, rowContext);
					return `<x-o x-id="${xid}">${escapeHtml(value)}</x-o>`;
				});
			}
		} else {
			// Mixed content: walk child text nodes for {{ }} bindings
			// (handles cases like: <li><strong>{{ a }}</strong> — {{ b }}</li>)
			for (const child of [...el.childNodes]) {
				if (child.nodeType !== Node.TEXT_NODE) continue;
				const raw = child.textContent;
				const matches = [...raw.matchAll(/{{\s*([^}]+)\s*}}/g)];
				if (!matches.length) continue;

				const frag = document.createDocumentFragment();
				let lastIndex = 0;
				for (const match of matches) {
					if (match.index > lastIndex) {
						frag.appendChild(document.createTextNode(raw.slice(lastIndex, match.index)));
					}
					const expr = match[1].trim();
					const { value, xid } = evaluate(expr, scope, path, inRow, rowContext);
					const xo = document.createElement('x-o');
					xo.setAttribute('x-id', xid);
					xo.textContent = value ?? '';
					frag.appendChild(xo);
					lastIndex = match.index + match[0].length;
				}
				if (lastIndex < raw.length) {
					frag.appendChild(document.createTextNode(raw.slice(lastIndex)));
				}
				el.replaceChild(frag, child);
			}
		}

		// Attribute bindings: attr="{{ expr }}"
		for (const attr of [...(el.attributes ?? [])]) {
			const match = attr.value.match(/^{{\s*([^}]+)\s*}}$/);
			if (!match) continue;
			const { value, xid } = evaluate(match[1].trim(), scope, path, inRow, rowContext);
			el.setAttribute(attr.name, value ?? '');
			if (!el.hasAttribute('x-id')) el.setAttribute('x-id', xid);
		}

		// x-class binding: x-class="active: expr, highlight: expr2"
		if (el.hasAttribute('x-class')) {
			const rules = el.getAttribute('x-class').split(',');
			for (const rule of rules) {
				const sep = rule.indexOf(':');
				if (sep === -1) continue;
				const className = rule.slice(0, sep).trim();
				const expr = rule.slice(sep + 1).trim();
				const { value } = evaluate(expr, scope, path, inRow, rowContext);
				if (value) el.classList.add(className);
				else       el.classList.remove(className);
			}
		}

		// x-bind:attr binding: x-bind:disabled="expr"
		for (const attr of [...(el.attributes ?? [])]) {
			if (!attr.name.startsWith('x-bind:')) continue;
			const targetAttr = attr.name.slice(7); // "x-bind:".length
			const expr = attr.value.trim();
			const { value } = evaluate(expr, scope, path, inRow, rowContext);

			if (typeof value === 'boolean' || value === null || value === undefined) {
				value ? el.setAttribute(targetAttr, '') : el.removeAttribute(targetAttr);
			} else {
				el.setAttribute(targetAttr, value);
			}
			el.removeAttribute(attr.name);
		}

		// x-model: set initial value from state
		if (el.hasAttribute('x-model')) {
			const expr = el.getAttribute('x-model').trim();
			const { value, xid } = evaluate(expr, scope, path, inRow, rowContext);
			if (el.type === 'checkbox') {
				el.checked = !!value;
			} else if (el.tagName === 'SELECT') {
				el.value = value ?? '';
			} else {
				el.value = value ?? '';
			}
			el.setAttribute('x-id', xid.replace(/\./g, ':'));
		}
	}
}





function evaluate(expr, scope, path, inRow, rowContext = null) {
  if (inRow && expr.startsWith('row.')) {
    const key = expr.slice(4);
    // Use explicit rowContext path if provided, otherwise fall back to runtime path
    const basePath = rowContext ? join(rowContext.list, String(rowContext.idx)) : path;
    return {
      value: resolve(scope.row ?? scope, key),
      xid: join(basePath, key)
    };
  }
  return {
    value: resolve(scope, expr),
    xid: join('', expr)
  };
}




function processConditionals(root, scope) {
	// Process x-if chains (x-if → x-else-if* → x-else?)
	// Collect top-level x-if elements; skip any that are already part of an else chain.
	const processed = new Set();

	for (const ifEl of [...root.querySelectorAll('[x-if]')]) {
		if (processed.has(ifEl)) continue;

		const expr = ifEl.getAttribute('x-if').trim();
		let won = evaluateCondition(expr, scope);

		// Build the chain: [ { el, type, expr } ]
		const chain = [{ el: ifEl, type: 'if', expr }];

		// Walk immediately following element siblings for else-if / else
		let sibling = ifEl.nextElementSibling;
		while (sibling) {
			if (sibling.hasAttribute('x-else-if')) {
				chain.push({ el: sibling, type: 'else-if', expr: sibling.getAttribute('x-else-if').trim() });
				sibling = sibling.nextElementSibling;
			} else if (sibling.hasAttribute('x-else')) {
				chain.push({ el: sibling, type: 'else', expr: null });
				break;
			} else {
				break;
			}
		}

		// Decide winner and replace losers with comments
		let winnerFound = won;
		for (const entry of chain) {
			processed.add(entry.el);

			let show;
			if (entry.type === 'if') {
				show = won;
			} else if (entry.type === 'else-if') {
				show = !winnerFound && evaluateCondition(entry.expr, scope);
				if (show) winnerFound = true;
			} else {
				// x-else
				show = !winnerFound;
			}

			if (!show) {
				const label = entry.type === 'if'
					? `x-if:${entry.expr}`
					: entry.type === 'else-if'
						? `x-else-if:${entry.expr}`
						: 'x-else';
				const placeholder = document.createComment(label);
				entry.el.parentNode.replaceChild(placeholder, entry.el);
			}
		}
	}

	// x-show: keep element in DOM, only toggle visibility
	for (const el of [...root.querySelectorAll('[x-show]')]) {
		const expr = el.getAttribute('x-show').trim();
		const show = evaluateCondition(expr, scope);
		el.style.display = show ? '' : 'none';
	}
}

const resolve = (obj, path) => path.split('.').reduce((acc, k) => acc?.[k], obj);
const join = (a, b) => (a && b ? `${a}:${b}` : a || b);

function escapeHtml(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}