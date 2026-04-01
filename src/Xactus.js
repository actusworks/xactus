
import * as UT 			from './utils.js';
import renderTemplate 	from './render-template.js';
// ════════════════════════════════════════════════════











// ════════════════════════════════════════════════════
let _instanceCount = 0;

export default function Xactus( args ) {
	const { el, bus, state, events, html, computed } = args;
	let currentState = structuredClone(state);

	// Scoped root wrapper — isolates DOM queries per instance
	const root = document.createElement('div');
	root.setAttribute('data-xactus', args.id ?? `xactus-${++_instanceCount}`);
	el.appendChild(root);
	const templateCache = {};
	const ifTemplates = {};
	const ifChains = {};


	// Cache x-if / x-else-if / x-else template snippets from original HTML
	(function cacheIfTemplates() {
		const tpl = document.createElement('template');
		tpl.innerHTML = html.trim();
		for (const ifEl of tpl.content.querySelectorAll('[x-if]')) {
			const expr = ifEl.getAttribute('x-if').trim();
			ifTemplates[expr] = ifEl.outerHTML;

			// Walk siblings to collect the full chain
			const chain = [{ type: 'if', expr, html: ifEl.outerHTML }];
			let sib = ifEl.nextElementSibling;
			while (sib) {
				if (sib.hasAttribute('x-else-if')) {
					const sibExpr = sib.getAttribute('x-else-if').trim();
					chain.push({ type: 'else-if', expr: sibExpr, html: sib.outerHTML });
					ifTemplates[`x-else-if:${sibExpr}`] = sib.outerHTML;
					sib = sib.nextElementSibling;
				} else if (sib.hasAttribute('x-else')) {
					chain.push({ type: 'else', expr: null, html: sib.outerHTML });
					ifTemplates[`x-else:${expr}`] = sib.outerHTML;
					break;
				} else {
					break;
				}
			}
			ifChains[expr] = chain;
		}
	})();


	// ─────────────────────────────────────────────────
	// Returns state + computed getters (always derived from latest currentState)
	function fullState() {
		if (!computed) return currentState;
		const resolved = { ...currentState };
		for (const [key, fn] of Object.entries(computed)) {
			Object.defineProperty(resolved, key, {
				get: () => fn(currentState),
				enumerable: true,
			});
		}
		return resolved;
	}


	// ─────────────────────────────────────────────────
	const api = {
		listEl : null,

		get state() {
			return currentState;
		},

		patchState(patch) {
			for (const [key, value] of Object.entries(patch)) {
				currentState[key] = value;
				//UT.updateDOM(key, currentState, 'text', el);
			}
		},

		getByPath( path, obj=currentState ) {
			return UT.getByPath( path, obj );
		},
		setByPath( path, value ) {
			UT.setByPath( currentState, path, value );
			UT.updateDOM(path, fullState(), 'text', root);
		},


		

		// MARK: RENDER
		// ─────────────────────────────────────────────────
		RENDER( HTML, state=fullState(), target=root ) {
			let html = renderTemplate( HTML, state );
			//target.innerHTML = html;
			target.insertAdjacentHTML('beforeend', html);
		},


		// MARK: set state
		// ─────────────────────────────────────────────────
		setState( key, value ) {
			currentState[key] = value;
			UT.updateDOM(key, fullState(), 'text', root);
			UT.updateConditionals(root, fullState(), ifTemplates, renderTemplate, ifChains);
			UT.updateShowBindings(root, fullState());
			UT.updateClassBindings(root, fullState());
			UT.updateEmptyPlaceholders(root, fullState());
		},

		// MARK: update all
		// ─────────────────────────────────────────────────
		updateAll( keys, patch ) {
			let keysArr = keys.split(',').map(k => k.trim());
			keysArr.forEach( key => {
				currentState[key] = { ...currentState[key], ...patch };
			});
			Object.keys(patch).forEach( key => {
				let diff = UT.diffState(api.state[key], patch[key], key);
				//console.log('diff for', key, ':', diff);
				diff.forEach( path => {
					let value = api.getByPath( path, patch );
					api.setByPath( path, value );
					UT.updateDOM(path, fullState(), 'html', root);
				});
			});
		},


		// MARK: update
		// ─────────────────────────────────────────────────
		updateItem( key, patch ) {
			currentState[key][ patch.idx ] = { ...currentState[key][ patch.idx ], ...patch };
			let pathBase = `${key}:${patch.idx}`;
			Object.keys(patch).forEach( prop => {
				if (prop === 'idx') return;
				let path = `${pathBase}:${prop}`;
				UT.updateDOM(path, fullState(), 'html', root);
			});
			UT.updateClassBindings(root, fullState());
		},


		// MARK: add
		// ─────────────────────────────────────────────────
		addItem( patch ) {
			Object.keys(patch).forEach( key => {
				let payload = patch[key];
				currentState[key].push( payload );

				let newIdx = currentState[key].length - 1;
				let template = api.getCachedTemplatePart( key );
				let rowHtml = renderTemplate( template, {row: payload, idx: newIdx}, {list: key, idx: newIdx} );

				// Set the correct row-level x-id (e.g. "notifications:0") on the root element.
				// renderTemplate only sets attribute-binding-derived x-ids on the root, not the
				// row-path x-id that the x-map loop normally assigns after processNode returns.
				const rowTpl = document.createElement('template');
				rowTpl.innerHTML = rowHtml;
				const rowRoot = rowTpl.content.firstElementChild;
				if (rowRoot) rowRoot.setAttribute('x-id', `${key}:${newIdx}`);

				UT.updateDOM(key, rowTpl.innerHTML, 'add', root);
			});
			UT.updateEmptyPlaceholders(root, fullState());
		},


		// MARK: delete
		// ─────────────────────────────────────────────────
		deleteItem( key, idx ) {
			currentState[key].splice( idx, 1 );
			UT.updateDOM(`${key}:${idx}`, currentState, 'delete', root);
			
			// Re-index remaining siblings
			const container = root.querySelector(`[x-id="${key}"]`);
			if (container) {
				[...container.children].forEach((child, newIdx) => {
					UT.reindexElement(child, key, newIdx);
				});
			}
			UT.updateEmptyPlaceholders(root, fullState());
		},



		// ─────────────────────────────────────────────────
		getCachedTemplatePart(key) {
			if (!templateCache[key]) {
				templateCache[key] = UT.getTemplateElement(html, `[x-map="${key}"]`);
			}
			return templateCache[key];
		}

	}


	// ─────────────────────────────────────────────────
	const unsubs = [];
	if ( events && bus ) {
		for ( const [ eventName, row ] of Object.entries( events ) ) {
			const handler = ( payload ) => {
				if ( row.setState ) {
					api.setState( row.setState, payload );
				}
				if ( row.updateAll ) {
					api.updateAll( row.updateAll, payload );
				}
				if ( row.update ) {
					api.updateItem( row.update, payload );
				}
				if ( row.add ) {
					api.addItem({ [row.add]: payload });
				}
				if ( row.delete ) {
					api.deleteItem( row.delete, payload );
				}
				if (row.new) {
					currentState[row.new] = payload;
					api.RENDER(html, fullState());
				}
				
    			if (args.hooks?.onUpdate) args.hooks.onUpdate(api);
			};
			const unsub = bus.on( eventName, handler );
			// Support buses that return an unsub function (xenonjs, nanoevents)
			// and buses that use .off() (mitt, EventEmitter3, Node EventEmitter)
			unsubs.push( typeof unsub === 'function' ? unsub : () => bus.off( eventName, handler ) );
		}
	}
	// ────────────────────────────
	api.destroy = function () {
    	if (args.hooks?.onDestroy) args.hooks.onDestroy(api);
		unsubs.forEach(fn => fn());
		unsubs.length = 0;
		root.remove();
	};


	// ─────────────────────────────────────────────────
	//if (setup) setup(api);

	//api.renderList( currentState );
	api.RENDER( html, fullState() );
	if (args.hooks?.onMount) args.hooks.onMount(api);
















	// ── Two-Way Model Binding (x-model) ────────────────
	function modelChanged(path, value) {
		UT.setByPath(currentState, path, value);
		UT.updateDOM(path, fullState(), 'text', root);
		UT.updateConditionals(root, fullState(), ifTemplates, renderTemplate);
		UT.updateClassBindings(root, fullState());
	}

	root.addEventListener('input', (e) => {
		const modelAttr = e.target.getAttribute('x-model');
		if (!modelAttr) return;

		const path = modelAttr.trim().replace(/\./g, ':');
		let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
		if (e.target.type === 'number' || e.target.type === 'range') {
			value = value === '' ? '' : Number(value);
		}
		modelChanged(path, value);
	});

	root.addEventListener('change', (e) => {
		const modelAttr = e.target.getAttribute('x-model');
		if (!modelAttr) return;
		if (e.target.tagName === 'SELECT' || e.target.type === 'radio') {
			const path = modelAttr.trim().replace(/\./g, ':');
			modelChanged(path, e.target.value);
		}
	});


	// ── Event Delegation (actions) ─────────────────────
	if (args.actions) {
		const actions = args.actions;

		// Detect event types from x-on attributes in template
		const eventTypes = new Set(['click']);
		const onMatches = html.matchAll(/x-on="(\w+)/g);
		for (const m of onMatches) eventTypes.add(m[1]);

		for (const eventType of eventTypes) {
			root.addEventListener(eventType, (e) => {
				// x-on="click:edit" or x-on="submit:addItem"
				const actionEl = e.target.closest('[x-action]')
					|| e.target.closest(`[x-on]`);

				if (!actionEl) return;

				let actionName;
				if (actionEl.hasAttribute('x-action')) {
					// Simple: x-action="edit" (defaults to click)
					if (eventType !== 'click') return;
					actionName = actionEl.getAttribute('x-action').trim();
				} else {
					// Explicit: x-on="submit:addItem"
					const raw = actionEl.getAttribute('x-on').trim();
					const [trigger, name] = raw.split(':');
					if (trigger !== eventType || !name) return;
					actionName = name.trim();
				}

				const handler = actions[actionName];
				if (handler) handler({ ...actionEl.dataset }, e, api);
			});
		}
	}


	return api;

}

