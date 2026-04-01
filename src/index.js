import X 				from 'xenonjs/all';
import * as UT 			from './utils.js';
import Xactus 			from './Xactus.js';
// ════════════════════════════════════════════════════

console.log('Xactus is a simple reactive library for JavaScript. It allows you to create reactive objects that automatically update when their dependencies change.');


let i = 0

const myItems = [{ id: 1, name: 'Item 1', email:'test@example.com', count: 5, active: true }, { id: 2, name: 'Item 2', count: 3, active: false }, { id: 3, name: 'Item 3', count: 7, active: true }]

dev()
function dev() {

	setTimeout(() => {
		let newItems = structuredClone( myItems );
		newItems[1].name = 'Changed Item 2';
		X.bus.emit('items:update', { idx: 1, name: 'test name' });
		X.bus.emit('items:update', { idx: 1, count: 888 });
		X.bus.emit('flag:update', 2);
	}, 1000);
	setTimeout(() => {
		X.bus.emit('items:add', { id: 4, name: 'Item 4' });
	}, 2000);
	setTimeout(() => {
		X.bus.emit('items:delete', 2);
	}, 3000);


}



// ─────────────────────────────────────────────────
function myComp1() {
	const state = {
		title: 'Test List',
		items: myItems,
		flag: 1,
	}


	let html = `
		<div class="my-list-container">
			<h2>{{ title }}</h2>
			<h3 x-if="flag===1">Flag is -1-</h3>
			<h3 x-if="flag===2">Flag changed to {{ flag }}</h3>

			<div class="my-list" x-map="items">
				<div class="item" data-id="{{ row.id }}"
					x-class="active: row.active, low-stock: row.lowStock"
					x-bind:title="row.name">
					<p class="name">{{ row.name }} has {{ row.count }} items</p>
					<p class="email">{{ row.email }}</p>
				</div>
			</div>

			<hr>
			<h3>Two-Way Binding</h3>
			<input x-model="title" type="text" placeholder="Edit title">
			<input x-model="flag" type="number" placeholder="Set flag">
		</div>
	`

	let events = {
		'flag:update'		: { updateState: 'flag' }, // renders only a specific updated item
		'items:update:all'	: { updateAll: 'items' }, // renders any updated value in the list
		'items:update'		: { update: 'items' }, // renders only a specific updated item
		'items:new' 		: { new: 'items' }, // renders entire list on update
		'items:add' 		: { add: 'items' }, // renders only new item
		'items:delete' 		: { delete: 'items' }, // removes item from list
	}


    let actions = {
        edit(data, e, api) {
            const idx = parseInt(data.idx);
            console.log('Edit item', idx);
        },

        delete(data, e, api) {
            const idx = parseInt(data.idx);
            api.deleteItem('items', idx);
        },

        addItem(data, e, api) {
            e.preventDefault();
            const name = api.state.newItem.name;
            api.addItem({ items: { id: Date.now(), name } });
            api.setByPath('newItem:name', '');
        }
    }




	return {
		el: document.querySelector('#app'),
		bus: X.bus,
		state,
		html,
		events,
		actions,
	}


}


Xactus( myComp1() );
/*




// Usage:

// ─────────────────────────────────────────────────
const comp = new Xactus({
	el: document.querySelector('#app'),
	bus: X.bus,
	state: {
		title: 'Test List',
		items: myItems,
		flag: 1,
	},
	html : `
		<div class="my-list-container">
			<h2>{{ title }}</h2>
			<h3 x-if="flag===1">Flag is -1-</h3>
			<h3 x-if="flag===2">Flag changed to {{ flag }}</h3>

			<div class="my-list" x-map="items">
				<div class="item" data-id="{{ row.id }}"
					x-class="active: row.active, low-stock: row.lowStock"
					x-bind:title="row.name">
					<p class="name">{{ row.name }} has {{ row.count }} items</p>
					<p class="email">{{ row.email }}</p>
				</div>
			</div>

			<hr>
			<h3>Two-Way Binding</h3>
			<input x-model="title" type="text" placeholder="Edit title">
			<input x-model="flag" type="number" placeholder="Set flag">
		</div>
	`,
	
	events: {
		'flag:update'		: { updateState: 'flag' }, // renders only a specific updated item
		'items:update:all'	: { updateAll: 'items' }, // renders any updated value in the list
		'items:update'		: { update: 'items' }, // renders only a specific updated item
		'items:new' 		: { new: 'items' }, // renders entire list on update
		'items:add' 		: { add: 'items' }, // renders only new item
		'items:delete' 		: { delete: 'items' }, // removes item from list
	},
	/*
    hooks: {
        onMount(api)        { /* called after first render  },
        onUpdate(api, diff) { /* called after each update  },
        onDestroy(api)      { /* called on destroy  },
    }
	/********** *| 
});




const comp2 = Xactus({
    el: document.querySelector('#app'),
    state: {
        items: [{ price: 10 }, { price: 20 }],
    },
    computed: {
        total(state) {
            return state.items.reduce((sum, i) => sum + i.price, 0);
        },
        itemCount(state) {
            return state.items.length;
        }
    },
    html: `
        <p>Total: {{ total }}</p>
        <p>Count: {{ itemCount }}</p>
    `
});
*/



const comp3 = new Xactus({
    el: document.querySelector('#app'),
	bus: X.bus,
	state: {
        items: [{ id: 1, name: 'Item 11' }],
        newItem: { name: '' },
	},
    html: `
        <div class="my-list" x-map="items">
			<div class="item" data-id="{{ row.id }}">
				<p>{{ row.name }}</p>
				<button x-action="edit" data-idx="{{ idx }}">Edit</button>
				<button x-action="delete" data-idx="{{ idx }}">Delete</button>
			</div>
		</div>

		<form x-on="submit:addItem">
			<input x-model="newItem.name" type="text" placeholder="Name">
			<button type="submit">Add</button>
		</form>
    `,
    actions: {
        edit(data, e, api) {
            const idx = parseInt(data.idx);
            console.log('Edit item', idx);
        },

        delete(data, e, api) {
            const idx = parseInt(data.idx);
            api.deleteItem('items', idx);
        },

        addItem(data, e, api) {
            e.preventDefault();
            const name = api.state.newItem.name;
            api.addItem({ items: { id: Date.now(), name } });
            api.setByPath('newItem:name', '');
        }
    },
});















// ════════════════════════════════════════════════════




