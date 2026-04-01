

import { createComponent, bindBus } from './base.js';

export function MyComponent({ el, var1 = null, var2 = null, bus }) {
	return createComponent({
		el,
		state: { var1, var2 },
		events: {
			var1: 'change:user:name',
			var2: 'change:user:email'
		},




		render(state) {
			return `
				<div class="my-component">
					<p>${state.var1}</p>
					<p>${state.var2}</p>
				</div>


				<div class="my-list">
					<h2 data-xact="title">${state.title}</h2>
					<div class="items">
						${state.items.map(api.renderItem).join('')}
					</div>
				</div>


				
				<div class="item" data-id="${item.id}">
					<p data-xact="items:${item.id}:name">${item.name}</p>
				</div>



			`;
		},


		setup(api) {
			const offBus = bindBus(bus, {
				myEvent(data) {
					this.setState({ var1: data.data });
				}
			}, api);

			api.onCleanup(offBus);
		}
	});
}





// Usage:
const comp = MyComponent({
	el: document.querySelector('#app'),
	var1: 'one',
	var2: 'two',
	bus: myEvent.bus
});


// manual update
cmp.setState({ var2: 'X' })

// auto update
myEvent.bus.emit('myEvent', { data: 'NEW VALUE' });












// ════════════════════════════════════════════════════
export function createComponent({ el, state = {}, events = {}, render, setup }) {
	let currentState = { ...state };
	const cleanups = createCleanupBag();

	const api = {
		get state() {
			return currentState;
		},

		setState(patch) {
			currentState = { ...currentState, ...patch };
			api.update();
		},

		update() {
			el.innerHTML = render(currentState, api);
		},

		onCleanup(fn) {
			cleanups.add(fn);
		},

		destroy() {
			cleanups.run();
		}
	};

	if (setup) setup(api);

	api.update();

	return api;
}








// Usage:
const myItems = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }, { id: 3, name: 'Item 3' }]
const comp2 = MyList({
	el: document.querySelector('#app'),
	state: {
		title: 'Test List',
		items: myItems,
	},
	html : `
		<div class="my-list-container">
			<h2>{{ title }}</h2>
			<div class="my-list" x-map="items">
				<div class="item">
					<p class="name">{{ row.name }}</p>
					<p class="email">{{ row.email }}</p>
				</div>
			</div>
		</div>`,

	bus: X.bus,
	events: {
		'new:items' : { set: 'items' }, // renders entire list on update
		'add:item' : { run: 'addItem' }, // renders only new item
		'update:item' : {run: 'updateItem' }, // renders only updated item
		'delete:item' : { run: 'deleteItem' }, // removes item from list
	},


			
});


