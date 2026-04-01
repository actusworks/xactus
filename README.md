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
  - [Conditionals `x-if`](#conditionals-x-if)
  - [Lists `x-map`](#lists-x-map)
  - [Class Bindings `x-class`](#class-bindings-x-class)
  - [Attribute Binding `x-bind`](#attribute-binding-x-bind)
  - [Two-Way Binding `x-model`](#two-way-binding-x-model)
  - [Actions `x-action` / `x-on`](#actions-x-action--x-on)
- [Computed Properties](#computed-properties)
- [Event Bus Integration](#event-bus-integration)
- [Lifecycle Hooks](#lifecycle-hooks)
- [API Reference](#api-reference)

---

## Installation

```bash
npm install xactus
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

Use `{{ expr }}` in text content or attribute values to bind state.

```html
<h2>{{ title }}</h2>
<img src="{{ user.avatar }}" alt="{{ user.name }}">
```

Inside a list (`x-map`), use `row` to reference the current item and `idx` for its index:

```html
<p>{{ row.name }} — item #{{ idx }}</p>
```

---

### Conditionals `x-if`

Show or hide elements based on a state expression. Supports `===`, `!==`, `>`, `<`, `>=`, `<=`, and `!` (negation).

```html
<p x-if="isLoggedIn">Welcome back!</p>
<p x-if="!isLoggedIn">Please sign in.</p>
<span x-if="score >= 90">A+</span>
<span x-if="status === 'active'">Active</span>
```

Multiple `x-if` blocks with the same state key react to updates automatically.

---

### Lists `x-map`

Repeat a template for every item in an array. The first child element of the `x-map` container is used as the row template.

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    products: [
      { id: 1, name: 'Widget A', price: 9.99, inStock: true },
      { id: 2, name: 'Widget B', price: 14.99, inStock: false },
    ],
  },
  html: `
    <ul x-map="products">
      <li data-id="{{ row.id }}">
        {{ row.name }} — ${{ row.price }}
      </li>
    </ul>
  `,
});
```

- `row` — the current item object
- `idx` — the zero-based index of the current item

---

### Class Bindings `x-class`

Conditionally apply CSS classes based on state. Provide a comma-separated list of `className: expression` pairs.

```html
<div class="product-card"
     x-class="featured: row.featured, out-of-stock: !row.inStock, sale: row.discount > 0">
  {{ row.name }}
</div>
```

---

### Attribute Binding `x-bind`

Dynamically set any HTML attribute from state using `x-bind:attributeName`.

```html
<!-- Boolean attribute — added/removed based on truthiness -->
<button x-bind:disabled="!form.isValid">Submit</button>

<!-- String attribute -->
<a x-bind:href="user.profileUrl">View Profile</a>
<input x-bind:placeholder="field.hint">
```

---

### Two-Way Binding `x-model`

Bind an input, textarea, or select element to a state path. Changes to the element automatically update state and re-render dependent bindings.

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

Use dot notation (`newItem.name`) for nested paths — Xactus converts it to its internal `:` path format automatically.

---

### Actions `x-action` / `x-on`

Handle user interactions with delegated event listeners. All handlers receive `(data, event, api)`:

- `data` — the element's `data-*` attributes as an object
- `event` — the native DOM event
- `api` — the component's API

**`x-action`** (click only):

```html
<button x-action="remove" data-idx="{{ idx }}">Remove</button>
```

**`x-on`** (any event):

```html
<form x-on="submit:save">
  <input x-model="item.name" type="text">
  <button type="submit">Save</button>
</form>
```

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    items: [{ id: 1, name: 'First item' }],
    newItem: { name: '' },
  },
  html: `
    <div x-map="items">
      <div data-id="{{ row.id }}">
        <span>{{ row.name }}</span>
        <button x-action="remove" data-idx="{{ idx }}">✕</button>
      </div>
    </div>

    <form x-on="submit:add">
      <input x-model="newItem.name" type="text" placeholder="New item…">
      <button type="submit">Add</button>
    </form>
  `,
  actions: {
    remove(data, e, api) {
      api.deleteItem('items', parseInt(data.idx));
    },

    add(data, e, api) {
      e.preventDefault();
      const name = api.state.newItem.name;
      if (!name.trim()) return;
      api.addItem({ items: { id: Date.now(), name } });
      api.setByPath('newItem:name', '');
    },
  },
});
```

---

## Computed Properties

Derive values from state without storing them. Computed getters are re-evaluated on every render and available in templates just like regular state.

```js
Xactus({
  el: document.querySelector('#app'),
  state: {
    items: [
      { name: 'Apple',  price: 1.50, qty: 3 },
      { name: 'Banana', price: 0.75, qty: 6 },
    ],
  },
  computed: {
    total(state) {
      return state.items.reduce((sum, i) => sum + i.price * i.qty, 0).toFixed(2);
    },
    itemCount(state) {
      return state.items.length;
    },
  },
  html: `
    <p>{{ itemCount }} items — Total: ${{ total }}</p>
  `,
});
```

---

## Event Bus Integration

Xactus integrates with an external event bus (e.g. `xenonjs`) to update component state from outside. Map event names to built-in update strategies in the `events` option.

| Strategy | Description |
|---|---|
| `{ updateState: 'key' }` | Sets `state[key]` to the emitted payload and re-renders |
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
    'unread:update'       : { updateState: 'unreadCount' },
  },
  html: `
    <span x-if="unreadCount > 0">{{ unreadCount }} unread</span>
    <ul x-map="notifications">
      <li>
        {{ row.message }}
        <button x-action="dismiss" data-idx="{{ idx }}">✕</button>
      </li>
    </ul>
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

    onUpdate(api, diff) {
      console.log('State updated:', diff);
    },

    onDestroy(api) {
      console.log('Component destroyed.');
    },
  },
});
```

Call `api.destroy()` to unmount a component, remove its DOM, and unsubscribe all event listeners.

---

## API Reference

The `Xactus()` factory returns an `api` object with the following methods:

| Method | Description |
|---|---|
| `api.state` | Read-only snapshot of current state |
| `api.setState(patch)` | Shallowly merge `patch` into state (does not re-render; use `updateState` for that) |
| `api.updateState(key, value)` | Set `state[key]` and re-render all dependent bindings |
| `api.setByPath(path, value)` | Set a nested value using `:` notation (e.g. `'user:address:city'`) |
| `api.getByPath(path)` | Get a nested value using `:` notation |
| `api.updateItem(key, patch)` | Patch a specific item in a list array (`patch` must include `idx`) |
| `api.addItem({ listKey: item })` | Append a new item to a list and render it |
| `api.deleteItem(key, idx)` | Remove an item from a list by index and re-index remaining items |
| `api.RENDER(html, state, target)` | Manually render an HTML string and append it to `target` |
| `api.destroy()` | Unmount the component, remove its DOM node, unsubscribe all bus events |

### Path Notation

Xactus uses `:` as a path separator for nested state access.

```js
// state = { user: { address: { city: 'Athens' } } }
api.getByPath('user:address:city')        // → 'Athens'
api.setByPath('user:address:city', 'Thessaloniki')
```

---

## Full Example

A complete task list with filtering, computed totals, and bus-driven updates:

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
          <button x-action="toggle" data-idx="{{ idx }}"
                  x-bind:title="row.done ? 'Mark undone' : 'Mark done'">
            ✓
          </button>
          <button x-action="remove" data-idx="{{ idx }}">✕</button>
        </div>
      </div>

      <p x-if="remaining === 0">All done! 🎉</p>
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
      api.updateState('newTask', '');
    },

    toggle(data, e, api) {
      const idx = parseInt(data.idx);
      const task = api.state.tasks[idx];
      api.updateItem('tasks', { idx, done: !task.done });
    },

    remove(data, e, api) {
      api.deleteItem('tasks', parseInt(data.idx));
    },
  },

  hooks: {
    onMount(api) {
      console.log('Todo app ready.', api.state.total, 'tasks loaded.');
    },
  },
});
```

---

## License

MIT © [Stelios Ignatiadis](https://github.com/actusworks)
