# Xactus

[![npm version](https://img.shields.io/npm/v/xactus.svg?style=flat-square)](https://www.npmjs.com/package/xactus)
[![npm downloads](https://img.shields.io/npm/dm/xactus.svg?style=flat-square)](https://www.npmjs.com/package/xactus)
[![bundle size](https://img.shields.io/bundlephobia/minzip/xactus?style=flat-square&label=minzipped)](https://bundlephobia.com/package/xactus)
[![license](https://img.shields.io/npm/l/xactus.svg?style=flat-square)](./LICENSE)
[![ESM only](https://img.shields.io/badge/ESM-only-brightgreen?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](./package.json)

A lightweight, declarative UI component library for vanilla JavaScript. Define your state and HTML template once — Xactus handles rendering, two-way binding, list management, and surgical DOM updates automatically.

No build step required. No virtual DOM. No framework lock-in.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Template Syntax](#template-syntax)
  - [Interpolation `{{ }}`](#interpolation--)
  - [Conditionals `x-if` / `x-else-if` / `x-else`](#conditionals-x-if--x-else-if--x-else)
  - [Visibility Toggle `x-show`](#visibility-toggle-x-show)
  - [Lists `x-map`](#lists-x-map)
  - [Empty Placeholder `x-empty`](#empty-placeholder-x-empty)
  - [Class Bindings `x-class`](#class-bindings-x-class)
  - [Attribute Binding `x-bind`](#attribute-binding-x-bind)
  - [Two-Way Binding `x-model`](#two-way-binding-x-model)
  - [Actions `x-action` / `x-on`](#actions-x-action--x-on)
- [Computed Properties](#computed-properties)
- [Event Bus Integration](#event-bus-integration)
- [Lifecycle Hooks](#lifecycle-hooks)
- [API Reference](#api-reference)
- [Full Example](#full-example)

---

## Installation

```bash
npm install xactus
```

### Usage with a bundler (Vite, Webpack, Rollup, etc.)

```js
import Xactus from 'xactus';
```

### Usage with `<script type="module">`

```html
<script type="module">
  import Xactus from 'https://unpkg.com/xactus/dist/xactus.esm.js';

  Xactus({ el: document.querySelector('#app'), state: { name: 'World' }, html: `<h1>{{ name }}</h1>` });
</script>
```

### Usage with a classic `<script>` tag (no modules)

```html
<script src="https://unpkg.com/xactus/dist/xactus.iife.js"></script>
<script>
  var app = Xactus.init({
    el: document.querySelector('#app'),
    state: { name: 'World' },
    html: '<h1>{{ name }}</h1>'
  });

  // Named utility exports are also available:
  // Xactus.diffState, Xactus.getByPath, Xactus.setByPath, etc.
</script>
```

---

## Quick Start

```js
import Xactus from 'xactus';

Xactus({
  el: document.querySelector('#app'),
  state: {
    greeting: 'Hello',
    name: 'World',
  },
  html: `
    <div>
      <h1>{{ greeting }}, {{ name }}!</h1>
      <input x-model="name" type="text" placeholder="Your name">
    </div>
  `,
});
```

That's it. Typing in the input updates `{{ name }}` live — no wiring needed.

---

## Template Syntax

### Interpolation `{{ }}`

Use `{{ expr }}` in text content or attribute values to bind state. Multiple bindings can coexist in the same text node.

```html
<!-- Single binding -->
<h2>{{ title }}</h2>

<!-- Multiple bindings in one node -->
<p>{{ firstName }} {{ lastName }} — joined {{ joinDate }}</p>

<!-- Attribute binding -->
<img src="{{ user.avatar }}" alt="{{ user.name }}">
<a href="/users/{{ user.id }}">{{ user.name }}</a>
```

Inside a list (`x-map`), use `row` to reference the current item and `idx` for its zero-based index:

```html
<p>{{ row.name }} — item #{{ idx }}</p>
```

---

### Conditionals `x-if` / `x-else-if` / `x-else`

Conditionally render elements based on state. Elements that don't match are **removed from the DOM entirely** — they do not exist as hidden nodes.

Supports `===`, `!==`, `>`, `<`, `>=`, `<=`, and `!` (negation).

**Simple conditional:**
```html
<p x-if="isLoggedIn">Welcome back!</p>
```

**Condition chains — `x-else-if` and `x-else` must immediately follow their `x-if` sibling:**
```html
<!-- Grade display -->
<span x-if="score >= 90">A</span>
<span x-else-if="score >= 80">B</span>
<span x-else-if="score >= 70">C</span>
<span x-else>F</span>

<!-- Status badge -->
<span x-if="status === 'active'">Active</span>
<span x-else-if="status === 'pending'">Pending review</span>
<span x-else>Inactive</span>

<!-- Role-based UI — non-admin branch never exists in the DOM -->
<div x-if="user.role === 'admin'">
  <button>Delete account</button>
</div>
<div x-else>
  <p>You don't have permission to do this.</p>
</div>
```

**When to use `x-if` vs `x-show`:**

| | `x-if` | `x-show` |
|---|---|---|
| DOM presence | removed / re-inserted | always in DOM |
| Preserves form state | no | yes |
| Use for | role gates, exclusive branches, intentional resets | modals, tabs, toggles |

---

### Visibility Toggle `x-show`

Keep an element in the DOM and toggle its visibility with `display: none`. Unlike `x-if`, the element is never destroyed so it **preserves form state, focus, scroll position, and input values**.

```html
<!-- Modal — toggled frequently, form state must survive -->
<div x-show="modal.isOpen" class="modal">
  <form>
    <input x-model="modal.email" type="email" placeholder="Email">
    <button type="submit">Submit</button>
  </form>
</div>

<!-- Sidebar / drawer -->
<nav x-show="sidebar.open" class="sidebar">...</nav>

<!-- Password reveal toggle -->
<input x-show="!showPassword" type="password" x-model="password">
<input x-show="showPassword"  type="text"     x-model="password">
<button x-action="togglePassword">Show / Hide</button>

<!-- Loading skeleton vs content -->
<div x-show="isLoading" class="skeleton">Loading…</div>
<div x-show="!isLoading" class="content">{{ content }}</div>
```

Use `x-show` any time you toggle something frequently or need inner state to survive hidden periods. Reserve `x-if` for branches that should **not** exist in the DOM at all.

---

### Lists `x-map`

Repeat a template for every item in an array. The **first child element** of the `x-map` container is used as the row template.

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    products: [
      { id: 1, name: 'Widget A', price: 9.99,  inStock: true  },
      { id: 2, name: 'Widget B', price: 14.99, inStock: false },
    ],
  },
  html: `
    <ul x-map="products">
      <li>
        <strong>{{ row.name }}</strong> — ${{ row.price }}
        <span x-if="!row.inStock">Out of stock</span>
      </li>
    </ul>
  `,
});
```

- `row` — the current item object
- `idx` — the zero-based index of the current item

**Nested lists** are supported — inner `x-map` blocks resolve against the row scope of their parent:

```html
<!-- categories → items (depth-first rendering) -->
<div x-map="categories">
  <div>
    <h3>{{ row.name }}</h3>
    <ul x-map="row.items">
      <li>{{ row.name }}</li>
    </ul>
  </div>
</div>
```

---

### Empty Placeholder `x-empty`

Show a fallback element when a list array is empty. The `x-empty` element is a sibling to the `x-map` container, not nested inside it — it is shown/hidden automatically as items are added or removed.

```html
<ul x-map="results">
  <li>{{ row.title }}</li>
</ul>
<p x-empty="results">No results found.</p>
```

```html
<!-- Search results -->
<div x-map="searchResults">
  <article>
    <h3>{{ row.title }}</h3>
    <p>{{ row.summary }}</p>
  </article>
</div>
<div x-empty="searchResults" class="empty-state">
  <p>No results match your search.</p>
</div>

<!-- Inbox -->
<ul x-map="messages">
  <li>{{ row.subject }} — {{ row.from }}</li>
</ul>
<p x-empty="messages">Your inbox is empty.</p>

<!-- Task list — show prompt when all tasks are done -->
<div x-map="tasks">
  <div>{{ row.text }}</div>
</div>
<p x-empty="tasks">Nothing left to do — enjoy your day!</p>
```

---

### Class Bindings `x-class`

Conditionally apply CSS classes based on state. Provide a comma-separated list of `className: expression` pairs.

```html
<div class="product-card"
     x-class="featured: row.featured, out-of-stock: !row.inStock, on-sale: row.discount > 0">
  {{ row.name }}
</div>
```

```html
<!-- Navigation active state -->
<nav>
  <a x-class="active: currentPage === 'home'"     href="/">Home</a>
  <a x-class="active: currentPage === 'about'"    href="/about">About</a>
  <a x-class="active: currentPage === 'contact'"  href="/contact">Contact</a>
</nav>

<!-- Form validation feedback -->
<input x-model="email"
       x-class="error: !form.emailValid, success: form.emailValid"
       type="email">

<!-- Button states -->
<button x-class="loading: isSubmitting, disabled: !form.isValid">
  Submit
</button>
```

---

### Attribute Binding `x-bind`

Dynamically set any HTML attribute from state using `x-bind:attributeName`. Boolean values add or remove the attribute entirely.

```html
<!-- Boolean attribute — added/removed based on truthiness -->
<button x-bind:disabled="!form.isValid">Submit</button>

<!-- String attributes -->
<a x-bind:href="user.profileUrl">View Profile</a>
<input x-bind:placeholder="field.hint">
<img x-bind:src="product.imageUrl" x-bind:alt="product.name">
```

```html
<!-- ARIA accessibility -->
<button x-bind:aria-expanded="menu.isOpen"
        x-bind:aria-controls="'main-menu'">
  Toggle menu
</button>
<div id="main-menu" x-bind:hidden="!menu.isOpen">...</div>

<!-- Download link — filename from state -->
<a x-bind:href="export.url" x-bind:download="export.filename">
  Download report
</a>

<!-- Media -->
<video x-bind:src="video.url" x-bind:poster="video.thumbnail"
       x-bind:autoplay="video.autoplay"></video>
```

---

### Two-Way Binding `x-model`

Bind an `input`, `textarea`, or `select` element to a state path. Changes to the element automatically update state and re-render all dependent bindings.

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    search: '',
    qty: 1,
    agreed: false,
    color: 'red',
  },
  html: `
    <input   x-model="search"  type="text"     placeholder="Search…">
    <input   x-model="qty"     type="number"   min="1">
    <input   x-model="agreed"  type="checkbox">
    <select  x-model="color">
      <option value="red">Red</option>
      <option value="blue">Blue</option>
    </select>

    <p>Search: {{ search }}</p>
    <p>Qty: {{ qty }}</p>
    <p>Agreed: {{ agreed }}</p>
    <p>Color: {{ color }}</p>
  `,
});
```

Use dot notation for nested state paths — Xactus converts it to its internal `:` separator automatically:

```html
<!-- Binds to state.newItem.name -->
<input x-model="newItem.name" type="text">
```

**Common use cases:**
```html
<!-- Live search filter -->
<input x-model="query" type="search" placeholder="Search…">

<!-- Settings form -->
<input x-model="settings.notifications" type="checkbox"> Email notifications
<input x-model="settings.theme" type="radio" value="light"> Light
<input x-model="settings.theme" type="radio" value="dark"> Dark

<!-- Quantity selector -->
<input x-model="cart.qty" type="number" min="1" max="99">
```

---

### Actions `x-action` / `x-on`

Handle user interactions with delegated event listeners. All handlers receive `(data, event, api)`:

- `data` — the element's `data-*` attributes as a plain object
- `event` — the native DOM event
- `api` — the component's API instance

**`x-action`** listens for **click** events:

```html
<button x-action="remove" data-idx="{{ idx }}">Remove</button>
<button x-action="edit"   data-id="{{ row.id }}" data-name="{{ row.name }}">Edit</button>
```

**`x-on`** listens for **any DOM event** using the format `eventType:handlerName`:

```html
<form x-on="submit:save">...</form>
<input x-on="blur:validate">
<div x-on="mouseover:highlight">...</div>
```

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    items: [{ id: 1, name: 'First item' }],
    newItem: { name: '' },
  },
  html: `
    <ul x-map="items">
      <li>
        {{ row.name }}
        <button x-action="remove" data-idx="{{ idx }}">✕</button>
        <button x-action="edit"   data-idx="{{ idx }}" data-name="{{ row.name }}">Edit</button>
      </li>
    </ul>

    <form x-on="submit:add">
      <input x-model="newItem.name" type="text" placeholder="New item…">
      <button type="submit">Add</button>
    </form>
  `,
  actions: {
    remove(data, e, api) {
      api.deleteItem('items', parseInt(data.idx));
    },

    edit(data, e, api) {
      api.setState('editing', { idx: parseInt(data.idx), name: data.name });
    },

    add(data, e, api) {
      e.preventDefault();
      const name = api.state.newItem.name.trim();
      if (!name) return;
      api.addItem({ items: { id: Date.now(), name } });
      api.setByPath('newItem:name', '');
    },
  },
});
```

---

## Computed Properties

Derive values from state without storing them. Computed getters are re-evaluated on every render and available in templates just like regular state keys.

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    items: [
      { name: 'Apple',  price: 1.50, qty: 3 },
      { name: 'Banana', price: 0.75, qty: 6 },
    ],
    discount: 0.1,
  },
  computed: {
    // Shopping cart totals
    subtotal(state) {
      return state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    },
    total(state) {
      return (this.subtotal * (1 - state.discount)).toFixed(2);
    },
    itemCount(state) {
      return state.items.length;
    },

    // Derived status
    hasItems(state) {
      return state.items.length > 0;
    },
    isEmpty(state) {
      return state.items.length === 0;
    },
  },
  html: `
    <p x-if="hasItems">{{ itemCount }} items — Total: ${{ total }}</p>
    <p x-if="isEmpty">Your cart is empty.</p>
  `,
});
```

---

## Event Bus Integration

Xactus accepts any event bus via the `bus` option — it only requires two methods:

- `bus.on(event, handler)` — subscribe to an event
- `bus.off(event, handler)` — unsubscribe (used on `destroy()`)

Buses that return an unsubscribe function from `.on()` (e.g. **xenonjs**, **nanoevents**) are also supported.

**Compatible with:** [xenonjs](https://github.com/actusworks/xenonjs), [mitt](https://github.com/developit/mitt), [nanoevents](https://github.com/ai/nanoevents), [EventEmitter3](https://github.com/primus/eventemitter3), Node.js `EventEmitter`, or any custom bus.

Map event names to built-in update strategies in the `events` option:

| Strategy | Description |
|---|---|
| `{ setState: 'key' }` | Sets `state[key]` to the emitted payload and re-renders |
| `{ update: 'listKey' }` | Patches a specific item in a list (`payload` must include `idx`) |
| `{ updateAll: 'listKey' }` | Merges a patch across all items in a list |
| `{ add: 'listKey' }` | Appends a new item to a list |
| `{ delete: 'listKey' }` | Removes an item from a list by index |
| `{ new: 'listKey' }` | Replaces the entire list with the payload |

```js
import X from 'xenonjs/all';
import Xactus from 'xactus';

Xactus({
  el: document.querySelector('#app'),
  bus: X.bus,
  state: {
    notifications: [],
    unreadCount: 0,
  },
  events: {
    'notification:add'    : { add: 'notifications' },
    'notification:remove' : { delete: 'notifications' },
    'notification:clear'  : { new: 'notifications' },
    'unread:update'       : { setState: 'unreadCount' },
  },
  html: `
    <span x-if="unreadCount > 0">{{ unreadCount }} unread</span>
    <ul x-map="notifications">
      <li>
        {{ row.message }}
        <button x-action="dismiss" data-idx="{{ idx }}">✕</button>
      </li>
    </ul>
    <p x-empty="notifications">No notifications.</p>
  `,
  actions: {
    dismiss(data, e, api) {
      api.deleteItem('notifications', parseInt(data.idx));
    },
  },
});

// Emit from anywhere in your app
X.bus.emit('notification:add', { id: 1, message: 'Build succeeded.' });
X.bus.emit('unread:update', 1);
```

---

## Lifecycle Hooks

Run code at key points in a component's life.

```js
Xactus({
  el: document.querySelector('#app'),
  state: { count: 0 },
  html: `<p>Count: {{ count }}</p>`,

  hooks: {
    onMount(api) {
      console.log('Component mounted. Initial state:', api.state);
    },

    onUpdate(api) {
      console.log('State updated.');
    },

    onDestroy(api) {
      console.log('Component destroyed.');
    },
  },
});
```

Call `api.destroy()` to unmount a component, remove its DOM, and unsubscribe all event listeners.

**Re-mounting on the same element** is safe — if `Xactus()` is called again on an element that already has a mounted instance, the previous instance is destroyed automatically before the new one initialises. No duplicate listeners, no orphaned DOM.

```js
// Safe to call multiple times — previous instance auto-destroyed
function mountComponent(data) {
  Xactus({
    el: document.querySelector('#widget'),
    state: data,
    html: `...`,
  });
}
```

---

## API Reference

The `Xactus()` factory returns an `api` object with the following methods:

| Method | Description |
|---|---|
| `api.state` | Read-only snapshot of current state |
| `api.patchState(patch)` | Shallowly merge `patch` into state without triggering a re-render |
| `api.setState(key, value)` | Set `state[key]` and surgically re-render all dependent bindings |
| `api.setByPath(path, value)` | Set a nested value using `:` notation (e.g. `'user:address:city'`) |
| `api.getByPath(path)` | Get a nested value using `:` notation |
| `api.updateItem(key, patch)` | Patch a specific item in a list (`patch` must include `idx`) |
| `api.addItem({ listKey: item })` | Append a new item to a list and render it |
| `api.deleteItem(key, idx)` | Remove an item from a list by index and re-index remaining items |
| `api.RENDER(html, state, target)` | Manually render an HTML string and append it to `target` |
| `api.destroy()` | Unmount the component, remove its DOM node, unsubscribe all bus events |

### `api.setState(key, value)`

Sets a top-level state key and triggers a full reactive update: DOM text/bindings, conditionals (`x-if`/`x-else-if`/`x-else`), visibility (`x-show`), class bindings (`x-class`), and empty placeholders (`x-empty`) are all re-evaluated.

```js
// Toggle a boolean flag — re-evaluates all x-if/x-show/x-class that reference it
api.setState('isLoggedIn', true);

// Update a string — re-renders all {{ key }} bindings
api.setState('status', 'active');

// Swap an object — re-renders the entire section bound to that key
api.setState('currentUser', { id: 2, name: 'Alice', role: 'admin' });
```

### `api.patchState(patch)`

Merges multiple keys into state **without** triggering a re-render. Use this to batch silent state changes before a manual render or before `setState` fires.

```js
// Pre-load data silently before the component is rendered
api.patchState({ userId: 42, theme: 'dark', lang: 'en' });

// Prepare form defaults without triggering reactive updates
api.patchState({ form: { email: '', password: '', remember: false } });
```

### `api.updateItem(key, patch)`

Patches a single item inside a list array. `patch` must include the `idx` of the item to update. Only the changed fields are re-rendered in the DOM.

```js
// Mark a task as done
api.updateItem('tasks', { idx: 2, done: true });

// Update a product's stock and price
api.updateItem('products', { idx: 0, inStock: false, price: 7.99 });

// Rename a list item
api.updateItem('contacts', { idx: idx, name: newName, updatedAt: Date.now() });
```

### `api.addItem({ listKey: item })`

Appends a new item to a list, renders only the new row, and re-evaluates `x-empty` placeholders.

```js
// Add a new task
api.addItem({ tasks: { id: Date.now(), text: 'New task', done: false } });

// Add a notification
api.addItem({ notifications: { id: uuid(), message: 'Upload complete', type: 'success' } });

// Add a new chat message
api.addItem({ messages: { id: uuid(), author: 'Alice', text: 'Hello!', ts: Date.now() } });
```

### `api.deleteItem(key, idx)`

Removes an item from a list by index, re-indexes remaining siblings, and re-evaluates `x-empty` placeholders.

```js
// Remove the third task (index 2)
api.deleteItem('tasks', 2);

// Remove by index from a data attribute
api.deleteItem('notifications', parseInt(data.idx));

// Clear expired sessions
expiredSessions.forEach(idx => api.deleteItem('sessions', idx));
```

### `api.setByPath(path, value)` / `api.getByPath(path)`

Read and write deeply nested state using `:` as a path separator.

```js
// Read
api.getByPath('user:address:city')          // → 'Athens'
api.getByPath('settings:notifications')     // → true

// Write
api.setByPath('user:address:city', 'Thessaloniki');
api.setByPath('cart:items:0:qty', 3);
api.setByPath('form:email', 'alice@example.com');
```

### `api.destroy()`

Unmounts the component: removes the DOM subtree, unsubscribes all bus event listeners, and fires `onDestroy`. The element is left clean and ready to be re-mounted.

```js
// Cleanup on navigation
router.onLeave(() => comp.destroy());

// Destroy after a timeout
setTimeout(() => toast.destroy(), 3000);

// Conditional teardown
if (!user.isLoggedIn) authWidget.destroy();
```

---

## Full Example

A complete task list with filtering, computed totals, empty state, and bus-driven updates:

```js
import X from 'xenonjs/all';
import Xactus from 'xactus';

const comp = Xactus({
  el: document.querySelector('#app'),
  bus: X.bus,

  state: {
    filter: 'all',
    newTask: '',
    tasks: [
      { id: 1, text: 'Buy groceries',  done: false },
      { id: 2, text: 'Walk the dog',   done: true  },
      { id: 3, text: 'Read a book',    done: false },
    ],
  },

  computed: {
    remaining(state) {
      return state.tasks.filter(t => !t.done).length;
    },
    total(state) {
      return state.tasks.length;
    },
  },

  html: `
    <div class="todo-app">
      <h1>Tasks ({{ remaining }} / {{ total }} left)</h1>

      <form x-on="submit:add">
        <input x-model="newTask" type="text" placeholder="New task…">
        <button type="submit">Add</button>
      </form>

      <div x-map="tasks">
        <div class="task" x-class="done: row.done" data-id="{{ row.id }}">
          <span>{{ row.text }}</span>
          <button x-action="toggle" data-idx="{{ idx }}">✓</button>
          <button x-action="remove" data-idx="{{ idx }}">✕</button>
        </div>
      </div>

      <p x-empty="tasks">No tasks yet — add one above.</p>

      <p x-if="remaining === 0" x-show="total > 0">All done! 🎉</p>
    </div>
  `,

  events: {
    'task:add'    : { add: 'tasks' },
    'task:delete' : { delete: 'tasks' },
  },

  actions: {
    add(data, e, api) {
      e.preventDefault();
      const text = api.state.newTask.trim();
      if (!text) return;
      api.addItem({ tasks: { id: Date.now(), text, done: false } });
      api.setState('newTask', '');
    },

    toggle(data, e, api) {
      const idx = parseInt(data.idx);
      api.updateItem('tasks', { idx, done: !api.state.tasks[idx].done });
    },

    remove(data, e, api) {
      api.deleteItem('tasks', parseInt(data.idx));
    },
  },

  hooks: {
    onMount(api) {
      console.log('Todo app ready.', api.state.tasks.length, 'tasks loaded.');
    },
    onDestroy(api) {
      console.log('Todo app unmounted.');
    },
  },
});
```

---

## License

MIT © [Stelios Ignatiadis](https://github.com/actusworks)
