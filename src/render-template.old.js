



export default function renderTemplate(template, state) {
	const tpl = document.createElement('template');
	tpl.innerHTML = template.trim();

	processNode(tpl.content, state, '');

	return tpl.innerHTML;
}



function processNode(root, scope, path) {
	// first handle all x-map blocks
	const mapEls = [...root.querySelectorAll('[x-map]')];

	for (const mapEl of mapEls) {
		const listName = mapEl.getAttribute('x-map').trim();
		const items = getValue(scope, listName);

		mapEl.setAttribute('x-id', joinPath(path, listName));

		if (!Array.isArray(items) || items.length === 0) {
			mapEl.innerHTML = '';
			continue;
		}

		// use first child as row template
		const rowTemplate = mapEl.firstElementChild?.cloneNode(true);
		if (!rowTemplate) continue;

		mapEl.innerHTML = '';

		items.forEach((row, idx) => {
			const rowNode = rowTemplate.cloneNode(true);
			const rowPath = joinPath(joinPath(path, listName), String(idx));

			// process this repeated row with row as scope
			processRepeaterRow(rowNode, row, rowPath);

			// add x-id to repeated root item too
			rowNode.setAttribute('x-id', rowPath);
			//rowNode.setAttribute('data-idx', idx);

			mapEl.appendChild(rowNode);
		});
	}

	// then handle normal {{ ... }} placeholders outside repeaters
	processBindings(root, scope, path, false);
}

function processRepeaterRow(root, rowScope, rowPath) {
	processBindings(root, rowScope, rowPath, true);
}

function processBindings(root, scope, path, isRowScope) {
	const all = [root, ...root.querySelectorAll('*')];
	for (const el of all) {
		// text content like <h2>{{ title }}</h2>
		if (el.children.length === 0) {
			const txt = el.textContent.trim();
			const match = txt.match(/^{{\s*([^}]+)\s*}}$/);

			if (match) {
				const expr = match[1].trim();
				const { value, idxPath } = resolveExpression(expr, scope, path, isRowScope);

				el.textContent = value ?? '';
				el.setAttribute('x-id', idxPath);
			}
		}

		// attributes like data-id="{{row.id}}"
		if ( el.attributes ) {
		for (const attr of [...el.attributes]) {
			const match = attr.value.match(/^{{\s*([^}]+)\s*}}$/);
			if (!match) continue;

			const expr = match[1].trim();
			const { value, idxPath } = resolveExpression(expr, scope, path, isRowScope);

			el.setAttribute(attr.name, value ?? '');

			// only set x-id if not already present from text binding
			if (!el.hasAttribute('x-id')) {
				el.setAttribute('x-id', idxPath);
			}
		}
		}
	}
}

function resolveExpression(expr, scope, path, isRowScope) {
	// row.name / row.email / row.id inside a repeater
	if (isRowScope && expr.startsWith('row.')) {
		const key = expr.slice(4);
		return {
			value: getValue(scope, key),
			idxPath: joinPath(path, key)
		};
	}

	// plain title / items
	return {
		value: getValue(scope, expr),
		idxPath: joinPath('', expr)
	};
}

function getValue(obj, path) {
	return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function joinPath(a, b) {
	if (!a) return b;
	if (!b) return a;
	return `${a}:${b}`;
}