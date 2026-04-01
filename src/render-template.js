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

	// Handle x-map (repeater) blocks
	for (const mapEl of root.querySelectorAll('[x-map]')) {
		const key = mapEl.getAttribute('x-map').trim();
		const items = resolve(scope, key);
		mapEl.setAttribute('x-id', join(path, key));
		const rowTemplate = mapEl.firstElementChild?.cloneNode(true);
		mapEl.innerHTML = '';

		if (!Array.isArray(items) || !rowTemplate) continue;

		items.forEach((row, idx) => {
			const rowNode = rowTemplate.cloneNode(true);
			const rowPath = join(join(path, key), String(idx));
			processConditionals(rowNode, row);
			bindAll(rowNode, { row, idx }, rowPath, true);
			rowNode.setAttribute('x-id', rowPath);
			mapEl.appendChild(rowNode);
		});
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
				el.innerHTML = raw.replace(/{{\s*([^}]+)\s*}}/g, (match, expr) => {
					const { value, xid } = evaluate(expr.trim(), scope, path, inRow, rowContext);
					return `<x-o x-id="${xid}">${value ?? ''}</x-o>`;
				});
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
			el.setAttribute('x-id', xid);
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
	for (const el of [...root.querySelectorAll('[x-if]')]) {
		const expr = el.getAttribute('x-if').trim();
		const show = evaluateCondition(expr, scope);

		if (!show) {
			const placeholder = document.createComment(`x-if:${expr}`);
			el.parentNode.replaceChild(placeholder, el);
		}
	}
}

const resolve = (obj, path) => path.split('.').reduce((acc, k) => acc?.[k], obj);
const join = (a, b) => (a && b ? `${a}:${b}` : a || b);