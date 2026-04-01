var Xactus = (function(exports) {
	Object.defineProperties(exports, {
		__esModule: { value: true },
		[Symbol.toStringTag]: { value: "Module" }
	});
	//#region src/utils.js
	function diffState(oldState, newState, base = "") {
		let changes = [];
		const keys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);
		for (const key of keys) {
			const oldVal = oldState?.[key];
			const newVal = newState?.[key];
			const path = base ? `${base}:${key}` : key;
			if (Array.isArray(oldVal) && Array.isArray(newVal)) {
				const max = Math.max(oldVal.length, newVal.length);
				for (let i = 0; i < max; i++) {
					const itemPath = `${path}:${i}`;
					const o = oldVal[i];
					const n = newVal[i];
					if (o == null || n == null || typeof o !== "object" || typeof n !== "object") {
						if (o !== n) changes.push(itemPath);
					} else changes.push(...diffState(o, n, itemPath));
				}
			} else if (isObject(oldVal) && isObject(newVal)) changes.push(...diffState(oldVal, newVal, path));
			else if (oldVal !== newVal) changes.push(path);
		}
		return changes;
	}
	function setByPath(obj, path, value, changes = []) {
		const parts = path.split(":");
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
	function getByPath(path, obj, fallback) {
		if (!path) return obj;
		const parts = path.split(":");
		let current = obj;
		for (const key of parts) {
			if (current == null) return fallback;
			current = current[key];
		}
		return current ?? fallback;
	}
	function updateDOM(path, obj = currentState, mode = "html", root = document) {
		let value;
		if (typeof obj === "object" && obj !== null) value = getByPath(path, obj);
		else value = obj;
		root.querySelectorAll(`[x-id="${path}"]`).forEach((el) => {
			if (mode === "html") el.innerHTML = sanitize(value ?? "");
			else if (mode === "text") el.textContent = sanitize(value ?? "");
			else if (mode === "add") el.insertAdjacentHTML("beforeend", value ?? "");
			else if (mode === "delete") el.remove();
		});
	}
	function getTemplateElement(str, selector) {
		const tpl = document.createElement("template");
		tpl.innerHTML = str.trim();
		const mapEl = tpl.content.querySelector(`${selector}`);
		if (!mapEl) return null;
		const child = mapEl.firstElementChild;
		return child ? child.outerHTML : null;
	}
	function reindexElement(el, listKey, newIdx) {
		const prefix = `${listKey}:`;
		[el, ...el.querySelectorAll("[x-id]")].forEach((node) => {
			const xid = node.getAttribute("x-id");
			if (!xid || !xid.startsWith(prefix)) return;
			const rest = xid.slice(prefix.length);
			const oldIdx = rest.split(":")[0];
			const tail = rest.slice(oldIdx.length);
			node.setAttribute("x-id", `${prefix}${newIdx}${tail}`);
		});
	}
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
	function parseTokens(str, replacements, open = "[[", close = "]]") {
		const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`${esc(open)}\\s*(.*?)\\s*${esc(close)}`, "g");
		if (replacements === void 0) {
			const names = [];
			let match;
			while ((match = pattern.exec(str)) !== null) names.push(match[1]);
			return names;
		}
		return str.replace(pattern, (full, name) => Object.prototype.hasOwnProperty.call(replacements, name) ? replacements[name] : full);
	}
	function isObject(v) {
		return v && typeof v === "object" && !Array.isArray(v);
	}
	function sanitize(str) {
		const div = document.createElement("div");
		div.textContent = str;
		return div.innerHTML;
	}
	function evaluateCondition(expr, scope) {
		const resolvePath = (obj, p) => p.split(".").reduce((acc, k) => acc?.[k], obj);
		if (expr.startsWith("!") && !/[=<>]/.test(expr)) return !resolvePath(scope, expr.slice(1));
		const match = expr.match(/^(.+?)\s*(===|!==|>=|<=|>|<)\s*(.+)$/);
		if (match) {
			const left = resolvePath(scope, match[1].trim());
			const op = match[2];
			const rawRight = match[3].trim();
			let right;
			if (rawRight === "true") right = true;
			else if (rawRight === "false") right = false;
			else if (rawRight === "null") right = null;
			else if (/^['"].*['"]$/.test(rawRight)) right = rawRight.slice(1, -1);
			else if (!isNaN(rawRight)) right = Number(rawRight);
			else right = resolvePath(scope, rawRight);
			switch (op) {
				case "===": return left === right;
				case "!==": return left !== right;
				case ">": return left > right;
				case "<": return left < right;
				case ">=": return left >= right;
				case "<=": return left <= right;
			}
		}
		return !!resolvePath(scope, expr);
	}
	function updateConditionals(root, state, ifTemplates, renderFn, ifChains = {}) {
		const processedExprs = /* @__PURE__ */ new Set();
		function renderEl(templateHtml) {
			const rendered = renderFn(templateHtml, state);
			const tpl = document.createElement("template");
			tpl.innerHTML = rendered;
			return tpl.content.firstElementChild;
		}
		const heads = [];
		for (const el of root.querySelectorAll("[x-if]")) {
			const expr = el.getAttribute("x-if").trim();
			if (!processedExprs.has(expr)) heads.push({
				node: el,
				expr,
				isComment: false
			});
		}
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
		while (walker.nextNode()) {
			const data = walker.currentNode.data;
			if (!data.startsWith("x-if:")) continue;
			const expr = data.slice(5);
			if (!processedExprs.has(expr)) heads.push({
				node: walker.currentNode,
				expr,
				isComment: true
			});
		}
		for (const { node: headNode, expr: ifExpr } of heads) {
			if (processedExprs.has(ifExpr)) continue;
			processedExprs.add(ifExpr);
			const chain = ifChains[ifExpr];
			if (!chain) {
				if (headNode.nodeType === Node.COMMENT_NODE) {
					if (evaluateCondition(ifExpr, state) && ifTemplates[ifExpr]) {
						const newEl = renderEl(ifTemplates[ifExpr]);
						headNode.parentNode.replaceChild(newEl, headNode);
					}
				} else if (!evaluateCondition(ifExpr, state)) {
					const comment = document.createComment(`x-if:${ifExpr}`);
					headNode.parentNode.replaceChild(comment, headNode);
				}
				continue;
			}
			let winnerIdx = -1;
			for (let i = 0; i < chain.length; i++) {
				const entry = chain[i];
				if (entry.type === "if" || entry.type === "else-if") {
					if (evaluateCondition(entry.expr, state)) {
						winnerIdx = i;
						break;
					}
				} else {
					winnerIdx = i;
					break;
				}
			}
			const slots = [headNode];
			let cursor = headNode.nextSibling;
			for (let i = 1; i < chain.length; i++) {
				while (cursor && cursor.nodeType === Node.TEXT_NODE) cursor = cursor.nextSibling;
				if (!cursor) break;
				const entry = chain[i];
				if (entry.type === "else-if") if (cursor.nodeType === Node.ELEMENT_NODE && cursor.hasAttribute("x-else-if") && cursor.getAttribute("x-else-if").trim() === entry.expr || cursor.nodeType === Node.COMMENT_NODE && cursor.data === `x-else-if:${entry.expr}`) {
					slots.push(cursor);
					cursor = cursor.nextSibling;
				} else break;
				else if (entry.type === "else") if (cursor.nodeType === Node.ELEMENT_NODE && cursor.hasAttribute("x-else") || cursor.nodeType === Node.COMMENT_NODE && cursor.data === `x-else:${ifExpr}`) {
					slots.push(cursor);
					cursor = cursor.nextSibling;
				} else break;
			}
			for (let i = 0; i < slots.length; i++) {
				const slot = slots[i];
				const entry = chain[i];
				if (i === winnerIdx) {
					if (slot.nodeType === Node.COMMENT_NODE) {
						const newEl = renderEl(entry.html);
						if (newEl) slot.parentNode.replaceChild(newEl, slot);
					}
				} else if (slot.nodeType !== Node.COMMENT_NODE) {
					const label = entry.type === "if" ? `x-if:${entry.expr}` : entry.type === "else-if" ? `x-else-if:${entry.expr}` : `x-else:${ifExpr}`;
					const comment = document.createComment(label);
					slot.parentNode.replaceChild(comment, slot);
				}
			}
		}
	}
	function updateEmptyPlaceholders(root, state) {
		const resolvePath = (obj, p) => p.split(".").reduce((acc, k) => acc?.[k], obj);
		for (const el of root.querySelectorAll("[x-empty]")) {
			const items = resolvePath(state, el.getAttribute("x-empty").trim());
			el.style.display = Array.isArray(items) && items.length === 0 ? "" : "none";
		}
	}
	function updateShowBindings(root, state) {
		for (const el of root.querySelectorAll("[x-show]")) {
			const expr = el.getAttribute("x-show").trim();
			el.style.display = evaluateCondition(expr, state) ? "" : "none";
		}
	}
	function updateClassBindings(root, state) {
		const resolvePath = (obj, p) => p.split(".").reduce((acc, k) => acc?.[k], obj);
		for (const el of root.querySelectorAll("[x-class]")) {
			const rules = el.getAttribute("x-class").split(",");
			for (const rule of rules) {
				const sep = rule.indexOf(":");
				if (sep === -1) continue;
				const className = rule.slice(0, sep).trim();
				if (resolvePath(state, rule.slice(sep + 1).trim())) el.classList.add(className);
				else el.classList.remove(className);
			}
		}
	}
	//#endregion
	//#region src/render-template.js
	function renderTemplate(template, state, rowContext = "") {
		const tpl = document.createElement("template");
		tpl.innerHTML = template.trim();
		processNode(tpl.content, state, "", rowContext);
		return tpl.innerHTML;
	}
	function processNode(root, scope, path, rowContext) {
		processConditionals(root, scope);
		const allMapEls = [...root.querySelectorAll("[x-map]")];
		allMapEls.sort((a, b) => b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_CONTAINS ? -1 : 1);
		for (const mapEl of allMapEls) {
			const key = mapEl.getAttribute("x-map").trim();
			const items = resolve(scope, key);
			mapEl.setAttribute("x-id", join(path, key));
			const rowTemplate = mapEl.firstElementChild?.cloneNode(true);
			mapEl.innerHTML = "";
			if (!Array.isArray(items) || !rowTemplate) continue;
			items.forEach((row, idx) => {
				const rowNode = rowTemplate.cloneNode(true);
				const rowPath = join(join(path, key), String(idx));
				processNode(rowNode, {
					row,
					idx
				}, rowPath, {
					list: key,
					idx
				});
				rowNode.setAttribute("x-id", rowPath);
				mapEl.appendChild(rowNode);
			});
		}
		for (const el of root.querySelectorAll("[x-empty]")) {
			const items = resolve(scope, el.getAttribute("x-empty").trim());
			el.style.display = Array.isArray(items) && items.length === 0 ? "" : "none";
		}
		bindAll(root, scope, path, rowContext !== null, rowContext);
	}
	function bindAll(root, scope, path, inRow, rowContext = null) {
		for (const el of [root, ...root.querySelectorAll("*")]) {
			if (!el.setAttribute) continue;
			if (!el.children.length) {
				const raw = el.textContent;
				const matches = [...raw.matchAll(/{{\s*([^}]+)\s*}}/g)];
				if (matches.length === 1 && raw.trim() === matches[0][0].trim()) {
					const { value, xid } = evaluate(matches[0][1].trim(), scope, path, inRow, rowContext);
					el.textContent = value ?? "";
					el.setAttribute("x-id", xid);
				} else if (matches.length > 0) el.innerHTML = raw.replace(/{{\s*([^}]+)\s*}}/g, (match, expr) => {
					const { value, xid } = evaluate(expr.trim(), scope, path, inRow, rowContext);
					return `<x-o x-id="${xid}">${escapeHtml(value)}</x-o>`;
				});
			}
			for (const attr of [...el.attributes ?? []]) {
				const match = attr.value.match(/^{{\s*([^}]+)\s*}}$/);
				if (!match) continue;
				const { value, xid } = evaluate(match[1].trim(), scope, path, inRow, rowContext);
				el.setAttribute(attr.name, value ?? "");
				if (!el.hasAttribute("x-id")) el.setAttribute("x-id", xid);
			}
			if (el.hasAttribute("x-class")) {
				const rules = el.getAttribute("x-class").split(",");
				for (const rule of rules) {
					const sep = rule.indexOf(":");
					if (sep === -1) continue;
					const className = rule.slice(0, sep).trim();
					const { value } = evaluate(rule.slice(sep + 1).trim(), scope, path, inRow, rowContext);
					if (value) el.classList.add(className);
					else el.classList.remove(className);
				}
			}
			for (const attr of [...el.attributes ?? []]) {
				if (!attr.name.startsWith("x-bind:")) continue;
				const targetAttr = attr.name.slice(7);
				const { value } = evaluate(attr.value.trim(), scope, path, inRow, rowContext);
				if (typeof value === "boolean" || value === null || value === void 0) value ? el.setAttribute(targetAttr, "") : el.removeAttribute(targetAttr);
				else el.setAttribute(targetAttr, value);
				el.removeAttribute(attr.name);
			}
			if (el.hasAttribute("x-model")) {
				const { value, xid } = evaluate(el.getAttribute("x-model").trim(), scope, path, inRow, rowContext);
				if (el.type === "checkbox") el.checked = !!value;
				else if (el.tagName === "SELECT") el.value = value ?? "";
				else el.value = value ?? "";
				el.setAttribute("x-id", xid);
			}
		}
	}
	function evaluate(expr, scope, path, inRow, rowContext = null) {
		if (inRow && expr.startsWith("row.")) {
			const key = expr.slice(4);
			const basePath = rowContext ? join(rowContext.list, String(rowContext.idx)) : path;
			return {
				value: resolve(scope.row ?? scope, key),
				xid: join(basePath, key)
			};
		}
		return {
			value: resolve(scope, expr),
			xid: join("", expr)
		};
	}
	function processConditionals(root, scope) {
		const processed = /* @__PURE__ */ new Set();
		for (const ifEl of [...root.querySelectorAll("[x-if]")]) {
			if (processed.has(ifEl)) continue;
			const expr = ifEl.getAttribute("x-if").trim();
			let won = evaluateCondition(expr, scope);
			const chain = [{
				el: ifEl,
				type: "if",
				expr
			}];
			let sibling = ifEl.nextElementSibling;
			while (sibling) if (sibling.hasAttribute("x-else-if")) {
				chain.push({
					el: sibling,
					type: "else-if",
					expr: sibling.getAttribute("x-else-if").trim()
				});
				sibling = sibling.nextElementSibling;
			} else if (sibling.hasAttribute("x-else")) {
				chain.push({
					el: sibling,
					type: "else",
					expr: null
				});
				break;
			} else break;
			let winnerFound = won;
			for (const entry of chain) {
				processed.add(entry.el);
				let show;
				if (entry.type === "if") show = won;
				else if (entry.type === "else-if") {
					show = !winnerFound && evaluateCondition(entry.expr, scope);
					if (show) winnerFound = true;
				} else show = !winnerFound;
				if (!show) {
					const label = entry.type === "if" ? `x-if:${entry.expr}` : entry.type === "else-if" ? `x-else-if:${entry.expr}` : "x-else";
					const placeholder = document.createComment(label);
					entry.el.parentNode.replaceChild(placeholder, entry.el);
				}
			}
		}
		for (const el of [...root.querySelectorAll("[x-show]")]) {
			const show = evaluateCondition(el.getAttribute("x-show").trim(), scope);
			el.style.display = show ? "" : "none";
		}
	}
	var resolve = (obj, path) => path.split(".").reduce((acc, k) => acc?.[k], obj);
	var join = (a, b) => a && b ? `${a}:${b}` : a || b;
	function escapeHtml(str) {
		return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}
	//#endregion
	//#region src/Xactus.js
	function Xactus(args) {
		const { el, bus, state, events, html, computed } = args;
		let currentState = structuredClone(state);
		const existingRoot = el.querySelector("[data-xactus-root]");
		if (existingRoot?._xactusDestroy) existingRoot._xactusDestroy();
		const root = document.createElement("div");
		root.setAttribute("data-xactus-root", "");
		el.appendChild(root);
		const templateCache = {};
		const ifTemplates = {};
		const ifChains = {};
		(function cacheIfTemplates() {
			const tpl = document.createElement("template");
			tpl.innerHTML = html.trim();
			for (const ifEl of tpl.content.querySelectorAll("[x-if]")) {
				const expr = ifEl.getAttribute("x-if").trim();
				ifTemplates[expr] = ifEl.outerHTML;
				const chain = [{
					type: "if",
					expr,
					html: ifEl.outerHTML
				}];
				let sib = ifEl.nextElementSibling;
				while (sib) if (sib.hasAttribute("x-else-if")) {
					const sibExpr = sib.getAttribute("x-else-if").trim();
					chain.push({
						type: "else-if",
						expr: sibExpr,
						html: sib.outerHTML
					});
					ifTemplates[`x-else-if:${sibExpr}`] = sib.outerHTML;
					sib = sib.nextElementSibling;
				} else if (sib.hasAttribute("x-else")) {
					chain.push({
						type: "else",
						expr: null,
						html: sib.outerHTML
					});
					ifTemplates[`x-else:${expr}`] = sib.outerHTML;
					break;
				} else break;
				ifChains[expr] = chain;
			}
		})();
		function fullState() {
			if (!computed) return currentState;
			const resolved = { ...currentState };
			for (const [key, fn] of Object.entries(computed)) Object.defineProperty(resolved, key, {
				get: () => fn(currentState),
				enumerable: true
			});
			return resolved;
		}
		const api = {
			listEl: null,
			get state() {
				return currentState;
			},
			patchState(patch) {
				for (const [key, value] of Object.entries(patch)) currentState[key] = value;
			},
			getByPath(path, obj = currentState) {
				return getByPath(path, obj);
			},
			setByPath(path, value) {
				setByPath(currentState, path, value);
			},
			RENDER(HTML, state = fullState(), target = root) {
				let html = renderTemplate(HTML, state);
				target.insertAdjacentHTML("beforeend", html);
			},
			setState(key, value) {
				currentState[key] = value;
				updateDOM(key, fullState(), "text", root);
				updateConditionals(root, fullState(), ifTemplates, renderTemplate, ifChains);
				updateShowBindings(root, fullState());
				updateClassBindings(root, fullState());
				updateEmptyPlaceholders(root, fullState());
			},
			updateAll(keys, patch) {
				keys.split(",").map((k) => k.trim()).forEach((key) => {
					currentState[key] = {
						...currentState[key],
						...patch
					};
				});
				Object.keys(patch).forEach((key) => {
					diffState(api.state[key], patch[key], key).forEach((path) => {
						let value = api.getByPath(path, patch);
						api.setByPath(path, value);
						updateDOM(path, fullState(), "html", root);
					});
				});
			},
			updateItem(key, patch) {
				currentState[key][patch.idx] = {
					...currentState[key][patch.idx],
					...patch
				};
				let pathBase = `${key}:${patch.idx}`;
				Object.keys(patch).forEach((prop) => {
					if (prop === "idx") return;
					updateDOM(`${pathBase}:${prop}`, fullState(), "html", root);
				});
				updateClassBindings(root, fullState());
			},
			addItem(patch) {
				Object.keys(patch).forEach((key) => {
					let payload = patch[key];
					currentState[key].push(payload);
					let newIdx = currentState[key].length - 1;
					updateDOM(key, renderTemplate(api.getCachedTemplatePart(key), {
						row: payload,
						idx: newIdx
					}, {
						list: key,
						idx: newIdx
					}), "add", root);
				});
				updateEmptyPlaceholders(root, fullState());
			},
			deleteItem(key, idx) {
				currentState[key].splice(idx, 1);
				updateDOM(`${key}:${idx}`, currentState, "delete", root);
				const container = root.querySelector(`[x-id="${key}"]`);
				if (container) [...container.children].forEach((child, newIdx) => {
					reindexElement(child, key, newIdx);
				});
				updateEmptyPlaceholders(root, fullState());
			},
			getCachedTemplatePart(key) {
				if (!templateCache[key]) templateCache[key] = getTemplateElement(html, `[x-map="${key}"]`);
				return templateCache[key];
			}
		};
		const unsubs = [];
		if (events && bus) for (const [eventName, row] of Object.entries(events)) {
			const handler = (payload) => {
				if (row.setState) api.setState(row.setState, payload);
				if (row.updateAll) api.updateAll(row.updateAll, payload);
				if (row.update) api.updateItem(row.update, payload);
				if (row.add) api.addItem({ [row.add]: payload });
				if (row.delete) api.deleteItem(row.delete, payload);
				if (row.new) {
					currentState[row.new] = payload;
					api.RENDER(html, fullState());
				}
				if (args.hooks?.onUpdate) args.hooks.onUpdate(api);
			};
			const unsub = bus.on(eventName, handler);
			unsubs.push(typeof unsub === "function" ? unsub : () => bus.off(eventName, handler));
		}
		api.destroy = function() {
			if (args.hooks?.onDestroy) args.hooks.onDestroy(api);
			unsubs.forEach((fn) => fn());
			unsubs.length = 0;
			root.remove();
		};
		root._xactusDestroy = () => api.destroy();
		api.RENDER(html, fullState());
		if (args.hooks?.onMount) args.hooks.onMount(api);
		function modelChanged(path, value) {
			setByPath(currentState, path, value);
			updateDOM(path, fullState(), "text", root);
			updateConditionals(root, fullState(), ifTemplates, renderTemplate);
			updateClassBindings(root, fullState());
		}
		root.addEventListener("input", (e) => {
			const modelAttr = e.target.getAttribute("x-model");
			if (!modelAttr) return;
			const path = modelAttr.trim().replace(/\./g, ":");
			let value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
			if (e.target.type === "number" || e.target.type === "range") value = value === "" ? "" : Number(value);
			modelChanged(path, value);
		});
		root.addEventListener("change", (e) => {
			const modelAttr = e.target.getAttribute("x-model");
			if (!modelAttr) return;
			if (e.target.tagName === "SELECT" || e.target.type === "radio") modelChanged(modelAttr.trim().replace(/\./g, ":"), e.target.value);
		});
		if (args.actions) {
			const actions = args.actions;
			const eventTypes = new Set(["click"]);
			const onMatches = html.matchAll(/x-on="(\w+)/g);
			for (const m of onMatches) eventTypes.add(m[1]);
			for (const eventType of eventTypes) root.addEventListener(eventType, (e) => {
				const actionEl = e.target.closest("[x-action]") || e.target.closest(`[x-on]`);
				if (!actionEl) return;
				let actionName;
				if (actionEl.hasAttribute("x-action")) {
					if (eventType !== "click") return;
					actionName = actionEl.getAttribute("x-action").trim();
				} else {
					const [trigger, name] = actionEl.getAttribute("x-on").trim().split(":");
					if (trigger !== eventType || !name) return;
					actionName = name.trim();
				}
				const handler = actions[actionName];
				if (handler) handler({ ...actionEl.dataset }, e, api);
			});
		}
		return api;
	}
	//#endregion
	exports.Xactus = Xactus;
	exports.default = Xactus;
	exports.diffState = diffState;
	exports.evaluateCondition = evaluateCondition;
	exports.getByPath = getByPath;
	exports.parseTokens = parseTokens;
	exports.setByPath = setByPath;
	exports.updateEmptyPlaceholders = updateEmptyPlaceholders;
	exports.updateShowBindings = updateShowBindings;
	return exports;
})({});
