/** @returns {void} */
function noop() {}

const identity = (x) => x;

/**
 * @template T
 * @template S
 * @param {T} tar
 * @param {S} src
 * @returns {T & S}
 */
function assign(tar, src) {
	// @ts-ignore
	for (const k in src) tar[k] = src[k];
	return /** @type {T & S} */ (tar);
}

function run(fn) {
	return fn();
}

function blank_object() {
	return Object.create(null);
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
function run_all(fns) {
	fns.forEach(run);
}

/**
 * @param {any} thing
 * @returns {thing is Function}
 */
function is_function(thing) {
	return typeof thing === 'function';
}

/** @returns {boolean} */
function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}

/** @returns {boolean} */
function is_empty(obj) {
	return Object.keys(obj).length === 0;
}

function create_slot(definition, ctx, $$scope, fn) {
	if (definition) {
		const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
		return definition[0](slot_ctx);
	}
}

function get_slot_context(definition, ctx, $$scope, fn) {
	return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
}

function get_slot_changes(definition, $$scope, dirty, fn) {
	if (definition[2] && fn) {
		const lets = definition[2](fn(dirty));
		if ($$scope.dirty === undefined) {
			return lets;
		}
		if (typeof lets === 'object') {
			const merged = [];
			const len = Math.max($$scope.dirty.length, lets.length);
			for (let i = 0; i < len; i += 1) {
				merged[i] = $$scope.dirty[i] | lets[i];
			}
			return merged;
		}
		return $$scope.dirty | lets;
	}
	return $$scope.dirty;
}

/** @returns {void} */
function update_slot_base(
	slot,
	slot_definition,
	ctx,
	$$scope,
	slot_changes,
	get_slot_context_fn
) {
	if (slot_changes) {
		const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
		slot.p(slot_context, slot_changes);
	}
}

/** @returns {any[] | -1} */
function get_all_dirty_from_scope($$scope) {
	if ($$scope.ctx.length > 32) {
		const dirty = [];
		const length = $$scope.ctx.length / 32;
		for (let i = 0; i < length; i++) {
			dirty[i] = -1;
		}
		return dirty;
	}
	return -1;
}

/** @returns {{}} */
function exclude_internal_props(props) {
	const result = {};
	for (const k in props) if (k[0] !== '$') result[k] = props[k];
	return result;
}

/** @returns {{}} */
function compute_rest_props(props, keys) {
	const rest = {};
	keys = new Set(keys);
	for (const k in props) if (!keys.has(k) && k[0] !== '$') rest[k] = props[k];
	return rest;
}

const is_client = typeof window !== 'undefined';

/** @type {() => number} */
let now = is_client ? () => window.performance.now() : () => Date.now();

let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;

const tasks = new Set();

/**
 * @param {number} now
 * @returns {void}
 */
function run_tasks(now) {
	tasks.forEach((task) => {
		if (!task.c(now)) {
			tasks.delete(task);
			task.f();
		}
	});
	if (tasks.size !== 0) raf(run_tasks);
}

/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 * @param {import('./private.js').TaskCallback} callback
 * @returns {import('./private.js').Task}
 */
function loop(callback) {
	/** @type {import('./private.js').TaskEntry} */
	let task;
	if (tasks.size === 0) raf(run_tasks);
	return {
		promise: new Promise((fulfill) => {
			tasks.add((task = { c: callback, f: fulfill }));
		}),
		abort() {
			tasks.delete(task);
		}
	};
}

/** @type {typeof globalThis} */
const globals =
	typeof window !== 'undefined'
		? window
		: typeof globalThis !== 'undefined'
		? globalThis
		: // @ts-ignore Node typings have this
		  global;

/**
 * @param {Node} target
 * @param {Node} node
 * @returns {void}
 */
function append(target, node) {
	target.appendChild(node);
}

/**
 * @param {Node} target
 * @param {string} style_sheet_id
 * @param {string} styles
 * @returns {void}
 */
function append_styles(target, style_sheet_id, styles) {
	const append_styles_to = get_root_for_style(target);
	if (!append_styles_to.getElementById(style_sheet_id)) {
		const style = element('style');
		style.id = style_sheet_id;
		style.textContent = styles;
		append_stylesheet(append_styles_to, style);
	}
}

/**
 * @param {Node} node
 * @returns {ShadowRoot | Document}
 */
function get_root_for_style(node) {
	if (!node) return document;
	const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
	if (root && /** @type {ShadowRoot} */ (root).host) {
		return /** @type {ShadowRoot} */ (root);
	}
	return node.ownerDocument;
}

/**
 * @param {Node} node
 * @returns {CSSStyleSheet}
 */
function append_empty_stylesheet(node) {
	const style_element = element('style');
	// For transitions to work without 'style-src: unsafe-inline' Content Security Policy,
	// these empty tags need to be allowed with a hash as a workaround until we move to the Web Animations API.
	// Using the hash for the empty string (for an empty tag) works in all browsers except Safari.
	// So as a workaround for the workaround, when we append empty style tags we set their content to /* empty */.
	// The hash 'sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=' will then work even in Safari.
	style_element.textContent = '/* empty */';
	append_stylesheet(get_root_for_style(node), style_element);
	return style_element.sheet;
}

/**
 * @param {ShadowRoot | Document} node
 * @param {HTMLStyleElement} style
 * @returns {CSSStyleSheet}
 */
function append_stylesheet(node, style) {
	append(/** @type {Document} */ (node).head || node, style);
	return style.sheet;
}

/**
 * @param {Node} target
 * @param {Node} node
 * @param {Node} [anchor]
 * @returns {void}
 */
function insert(target, node, anchor) {
	target.insertBefore(node, anchor || null);
}

/**
 * @param {Node} node
 * @returns {void}
 */
function detach(node) {
	if (node.parentNode) {
		node.parentNode.removeChild(node);
	}
}

/**
 * @returns {void} */
function destroy_each(iterations, detaching) {
	for (let i = 0; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].d(detaching);
	}
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} name
 * @returns {HTMLElementTagNameMap[K]}
 */
function element(name) {
	return document.createElement(name);
}

/**
 * @template {keyof SVGElementTagNameMap} K
 * @param {K} name
 * @returns {SVGElement}
 */
function svg_element(name) {
	return document.createElementNS('http://www.w3.org/2000/svg', name);
}

/**
 * @param {string} data
 * @returns {Text}
 */
function text(data) {
	return document.createTextNode(data);
}

/**
 * @returns {Text} */
function space() {
	return text(' ');
}

/**
 * @returns {Text} */
function empty() {
	return text('');
}

/**
 * @param {EventTarget} node
 * @param {string} event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
 * @returns {() => void}
 */
function listen(node, event, handler, options) {
	node.addEventListener(event, handler, options);
	return () => node.removeEventListener(event, handler, options);
}

/**
 * @returns {(event: any) => any} */
function prevent_default(fn) {
	return function (event) {
		event.preventDefault();
		// @ts-ignore
		return fn.call(this, event);
	};
}

/**
 * @param {Element} node
 * @param {string} attribute
 * @param {string} [value]
 * @returns {void}
 */
function attr(node, attribute, value) {
	if (value == null) node.removeAttribute(attribute);
	else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}
/**
 * List of attributes that should always be set through the attr method,
 * because updating them through the property setter doesn't work reliably.
 * In the example of `width`/`height`, the problem is that the setter only
 * accepts numeric values, but the attribute can also be set to a string like `50%`.
 * If this list becomes too big, rethink this approach.
 */
const always_set_through_set_attribute = ['width', 'height'];

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {{ [x: string]: string }} attributes
 * @returns {void}
 */
function set_attributes(node, attributes) {
	// @ts-ignore
	const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
	for (const key in attributes) {
		if (attributes[key] == null) {
			node.removeAttribute(key);
		} else if (key === 'style') {
			node.style.cssText = attributes[key];
		} else if (key === '__value') {
			/** @type {any} */ (node).value = node[key] = attributes[key];
		} else if (
			descriptors[key] &&
			descriptors[key].set &&
			always_set_through_set_attribute.indexOf(key) === -1
		) {
			node[key] = attributes[key];
		} else {
			attr(node, key, attributes[key]);
		}
	}
}

/**
 * @param {Element} element
 * @returns {ChildNode[]}
 */
function children(element) {
	return Array.from(element.childNodes);
}

/**
 * @param {Text} text
 * @param {unknown} data
 * @returns {void}
 */
function set_data(text, data) {
	data = '' + data;
	if (text.data === data) return;
	text.data = /** @type {string} */ (data);
}

/**
 * @returns {void} */
function set_input_value(input, value) {
	input.value = value == null ? '' : value;
}

/**
 * @returns {void} */
function toggle_class(element, name, toggle) {
	// The `!!` is required because an `undefined` flag means flipping the current state.
	element.classList.toggle(name, !!toggle);
}

/**
 * @template T
 * @param {string} type
 * @param {T} [detail]
 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
 * @returns {CustomEvent<T>}
 */
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
	return new CustomEvent(type, { detail, bubbles, cancelable });
}
/** */
class HtmlTag {
	/**
	 * @private
	 * @default false
	 */
	is_svg = false;
	/** parent for creating node */
	e = undefined;
	/** html tag nodes */
	n = undefined;
	/** target */
	t = undefined;
	/** anchor */
	a = undefined;
	constructor(is_svg = false) {
		this.is_svg = is_svg;
		this.e = this.n = null;
	}

	/**
	 * @param {string} html
	 * @returns {void}
	 */
	c(html) {
		this.h(html);
	}

	/**
	 * @param {string} html
	 * @param {HTMLElement | SVGElement} target
	 * @param {HTMLElement | SVGElement} anchor
	 * @returns {void}
	 */
	m(html, target, anchor = null) {
		if (!this.e) {
			if (this.is_svg)
				this.e = svg_element(/** @type {keyof SVGElementTagNameMap} */ (target.nodeName));
			/** #7364  target for <template> may be provided as #document-fragment(11) */ else
				this.e = element(
					/** @type {keyof HTMLElementTagNameMap} */ (
						target.nodeType === 11 ? 'TEMPLATE' : target.nodeName
					)
				);
			this.t =
				target.tagName !== 'TEMPLATE'
					? target
					: /** @type {HTMLTemplateElement} */ (target).content;
			this.c(html);
		}
		this.i(anchor);
	}

	/**
	 * @param {string} html
	 * @returns {void}
	 */
	h(html) {
		this.e.innerHTML = html;
		this.n = Array.from(
			this.e.nodeName === 'TEMPLATE' ? this.e.content.childNodes : this.e.childNodes
		);
	}

	/**
	 * @returns {void} */
	i(anchor) {
		for (let i = 0; i < this.n.length; i += 1) {
			insert(this.t, this.n[i], anchor);
		}
	}

	/**
	 * @param {string} html
	 * @returns {void}
	 */
	p(html) {
		this.d();
		this.h(html);
		this.i(this.a);
	}

	/**
	 * @returns {void} */
	d() {
		this.n.forEach(detach);
	}
}

/**
 * @typedef {Node & {
 * 	claim_order?: number;
 * 	hydrate_init?: true;
 * 	actual_end_child?: NodeEx;
 * 	childNodes: NodeListOf<NodeEx>;
 * }} NodeEx
 */

/** @typedef {ChildNode & NodeEx} ChildNodeEx */

/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

/**
 * @typedef {ChildNodeEx[] & {
 * 	claim_info?: {
 * 		last_index: number;
 * 		total_claimed: number;
 * 	};
 * }} ChildNodeArray
 */

// we need to store the information for multiple documents because a Svelte application could also contain iframes
// https://github.com/sveltejs/svelte/issues/3624
/** @type {Map<Document | ShadowRoot, import('./private.d.ts').StyleInformation>} */
const managed_styles = new Map();

let active = 0;

// https://github.com/darkskyapp/string-hash/blob/master/index.js
/**
 * @param {string} str
 * @returns {number}
 */
function hash(str) {
	let hash = 5381;
	let i = str.length;
	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return hash >>> 0;
}

/**
 * @param {Document | ShadowRoot} doc
 * @param {Element & ElementCSSInlineStyle} node
 * @returns {{ stylesheet: any; rules: {}; }}
 */
function create_style_information(doc, node) {
	const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
	managed_styles.set(doc, info);
	return info;
}

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {number} a
 * @param {number} b
 * @param {number} duration
 * @param {number} delay
 * @param {(t: number) => number} ease
 * @param {(t: number, u: number) => string} fn
 * @param {number} uid
 * @returns {string}
 */
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
	const step = 16.666 / duration;
	let keyframes = '{\n';
	for (let p = 0; p <= 1; p += step) {
		const t = a + (b - a) * ease(p);
		keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
	}
	const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
	const name = `__svelte_${hash(rule)}_${uid}`;
	const doc = get_root_for_style(node);
	const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
	if (!rules[name]) {
		rules[name] = true;
		stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
	}
	const animation = node.style.animation || '';
	node.style.animation = `${
		animation ? `${animation}, ` : ''
	}${name} ${duration}ms linear ${delay}ms 1 both`;
	active += 1;
	return name;
}

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {string} [name]
 * @returns {void}
 */
function delete_rule(node, name) {
	const previous = (node.style.animation || '').split(', ');
	const next = previous.filter(
		name
			? (anim) => anim.indexOf(name) < 0 // remove specific animation
			: (anim) => anim.indexOf('__svelte') === -1 // remove all Svelte animations
	);
	const deleted = previous.length - next.length;
	if (deleted) {
		node.style.animation = next.join(', ');
		active -= deleted;
		if (!active) clear_rules();
	}
}

/** @returns {void} */
function clear_rules() {
	raf(() => {
		if (active) return;
		managed_styles.forEach((info) => {
			const { ownerNode } = info.stylesheet;
			// there is no ownerNode if it runs on jsdom.
			if (ownerNode) detach(ownerNode);
		});
		managed_styles.clear();
	});
}

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {import('./private.js').PositionRect} from
 * @param {import('./private.js').AnimationFn} fn
 */
function create_animation(node, from, fn, params) {
	if (!from) return noop;
	const to = node.getBoundingClientRect();
	if (
		from.left === to.left &&
		from.right === to.right &&
		from.top === to.top &&
		from.bottom === to.bottom
	)
		return noop;
	const {
		delay = 0,
		duration = 300,
		easing = identity,
		// @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
		start: start_time = now() + delay,
		// @ts-ignore todo:
		end = start_time + duration,
		tick = noop,
		css
	} = fn(node, { from, to }, params);
	let running = true;
	let started = false;
	let name;
	/** @returns {void} */
	function start() {
		if (css) {
			name = create_rule(node, 0, 1, duration, delay, easing, css);
		}
		if (!delay) {
			started = true;
		}
	}
	/** @returns {void} */
	function stop() {
		if (css) delete_rule(node, name);
		running = false;
	}
	loop((now) => {
		if (!started && now >= start_time) {
			started = true;
		}
		if (started && now >= end) {
			tick(1, 0);
			stop();
		}
		if (!running) {
			return false;
		}
		if (started) {
			const p = now - start_time;
			const t = 0 + 1 * easing(p / duration);
			tick(t, 1 - t);
		}
		return true;
	});
	start();
	tick(0, 1);
	return stop;
}

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @returns {void}
 */
function fix_position(node) {
	const style = getComputedStyle(node);
	if (style.position !== 'absolute' && style.position !== 'fixed') {
		const { width, height } = style;
		const a = node.getBoundingClientRect();
		node.style.position = 'absolute';
		node.style.width = width;
		node.style.height = height;
		add_transform(node, a);
	}
}

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {import('./private.js').PositionRect} a
 * @returns {void}
 */
function add_transform(node, a) {
	const b = node.getBoundingClientRect();
	if (a.left !== b.left || a.top !== b.top) {
		const style = getComputedStyle(node);
		const transform = style.transform === 'none' ? '' : style.transform;
		node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
	}
}

let current_component;

/** @returns {void} */
function set_current_component(component) {
	current_component = component;
}

function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

/**
 * Schedules a callback to run immediately after the component has been updated.
 *
 * The first time the callback runs will be after the initial `onMount`
 *
 * https://svelte.dev/docs/svelte#afterupdate
 * @param {() => any} fn
 * @returns {void}
 */
function afterUpdate(fn) {
	get_current_component().$$.after_update.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];

let render_callbacks = [];

const flush_callbacks = [];

const resolved_promise = /* @__PURE__ */ Promise.resolve();

let update_scheduled = false;

/** @returns {void} */
function schedule_update() {
	if (!update_scheduled) {
		update_scheduled = true;
		resolved_promise.then(flush);
	}
}

/** @returns {void} */
function add_render_callback(fn) {
	render_callbacks.push(fn);
}

// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();

let flushidx = 0; // Do *not* move this inside the flush() function

/** @returns {void} */
function flush() {
	// Do not reenter flush while dirty components are updated, as this can
	// result in an infinite loop. Instead, let the inner flush handle it.
	// Reentrancy is ok afterwards for bindings etc.
	if (flushidx !== 0) {
		return;
	}
	const saved_component = current_component;
	do {
		// first, call beforeUpdate functions
		// and update components
		try {
			while (flushidx < dirty_components.length) {
				const component = dirty_components[flushidx];
				flushidx++;
				set_current_component(component);
				update(component.$$);
			}
		} catch (e) {
			// reset dirty state to not end up in a deadlocked state and then rethrow
			dirty_components.length = 0;
			flushidx = 0;
			throw e;
		}
		set_current_component(null);
		dirty_components.length = 0;
		flushidx = 0;
		while (binding_callbacks.length) binding_callbacks.pop()();
		// then, once components are updated, call
		// afterUpdate functions. This may cause
		// subsequent updates...
		for (let i = 0; i < render_callbacks.length; i += 1) {
			const callback = render_callbacks[i];
			if (!seen_callbacks.has(callback)) {
				// ...so guard against infinite loops
				seen_callbacks.add(callback);
				callback();
			}
		}
		render_callbacks.length = 0;
	} while (dirty_components.length);
	while (flush_callbacks.length) {
		flush_callbacks.pop()();
	}
	update_scheduled = false;
	seen_callbacks.clear();
	set_current_component(saved_component);
}

/** @returns {void} */
function update($$) {
	if ($$.fragment !== null) {
		$$.update();
		run_all($$.before_update);
		const dirty = $$.dirty;
		$$.dirty = [-1];
		$$.fragment && $$.fragment.p($$.ctx, dirty);
		$$.after_update.forEach(add_render_callback);
	}
}

/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 * @param {Function[]} fns
 * @returns {void}
 */
function flush_render_callbacks(fns) {
	const filtered = [];
	const targets = [];
	render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
	targets.forEach((c) => c());
	render_callbacks = filtered;
}

/**
 * @type {Promise<void> | null}
 */
let promise;

/**
 * @returns {Promise<void>}
 */
function wait() {
	if (!promise) {
		promise = Promise.resolve();
		promise.then(() => {
			promise = null;
		});
	}
	return promise;
}

/**
 * @param {Element} node
 * @param {INTRO | OUTRO | boolean} direction
 * @param {'start' | 'end'} kind
 * @returns {void}
 */
function dispatch(node, direction, kind) {
	node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}

const outroing = new Set();

/**
 * @type {Outro}
 */
let outros;

/**
 * @returns {void} */
function group_outros() {
	outros = {
		r: 0,
		c: [],
		p: outros // parent group
	};
}

/**
 * @returns {void} */
function check_outros() {
	if (!outros.r) {
		run_all(outros.c);
	}
	outros = outros.p;
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} [local]
 * @returns {void}
 */
function transition_in(block, local) {
	if (block && block.i) {
		outroing.delete(block);
		block.i(local);
	}
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} local
 * @param {0 | 1} [detach]
 * @param {() => void} [callback]
 * @returns {void}
 */
function transition_out(block, local, detach, callback) {
	if (block && block.o) {
		if (outroing.has(block)) return;
		outroing.add(block);
		outros.c.push(() => {
			outroing.delete(block);
			if (callback) {
				if (detach) block.d(1);
				callback();
			}
		});
		block.o(local);
	} else if (callback) {
		callback();
	}
}

/**
 * @type {import('../transition/public.js').TransitionConfig}
 */
const null_transition = { duration: 0 };

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {TransitionFn} fn
 * @param {any} params
 * @param {boolean} intro
 * @returns {{ run(b: 0 | 1): void; end(): void; }}
 */
function create_bidirectional_transition(node, fn, params, intro) {
	/**
	 * @type {TransitionOptions} */
	const options = { direction: 'both' };
	let config = fn(node, params, options);
	let t = intro ? 0 : 1;

	/**
	 * @type {Program | null} */
	let running_program = null;

	/**
	 * @type {PendingProgram | null} */
	let pending_program = null;
	let animation_name = null;

	/** @type {boolean} */
	let original_inert_value;

	/**
	 * @returns {void} */
	function clear_animation() {
		if (animation_name) delete_rule(node, animation_name);
	}

	/**
	 * @param {PendingProgram} program
	 * @param {number} duration
	 * @returns {Program}
	 */
	function init(program, duration) {
		const d = /** @type {Program['d']} */ (program.b - t);
		duration *= Math.abs(d);
		return {
			a: t,
			b: program.b,
			d,
			duration,
			start: program.start,
			end: program.start + duration,
			group: program.group
		};
	}

	/**
	 * @param {INTRO | OUTRO} b
	 * @returns {void}
	 */
	function go(b) {
		const {
			delay = 0,
			duration = 300,
			easing = identity,
			tick = noop,
			css
		} = config || null_transition;

		/**
		 * @type {PendingProgram} */
		const program = {
			start: now() + delay,
			b
		};

		if (!b) {
			// @ts-ignore todo: improve typings
			program.group = outros;
			outros.r += 1;
		}

		if ('inert' in node) {
			if (b) {
				if (original_inert_value !== undefined) {
					// aborted/reversed outro — restore previous inert value
					node.inert = original_inert_value;
				}
			} else {
				original_inert_value = /** @type {HTMLElement} */ (node).inert;
				node.inert = true;
			}
		}

		if (running_program || pending_program) {
			pending_program = program;
		} else {
			// if this is an intro, and there's a delay, we need to do
			// an initial tick and/or apply CSS animation immediately
			if (css) {
				clear_animation();
				animation_name = create_rule(node, t, b, duration, delay, easing, css);
			}
			if (b) tick(0, 1);
			running_program = init(program, duration);
			add_render_callback(() => dispatch(node, b, 'start'));
			loop((now) => {
				if (pending_program && now > pending_program.start) {
					running_program = init(pending_program, duration);
					pending_program = null;
					dispatch(node, running_program.b, 'start');
					if (css) {
						clear_animation();
						animation_name = create_rule(
							node,
							t,
							running_program.b,
							running_program.duration,
							0,
							easing,
							config.css
						);
					}
				}
				if (running_program) {
					if (now >= running_program.end) {
						tick((t = running_program.b), 1 - t);
						dispatch(node, running_program.b, 'end');
						if (!pending_program) {
							// we're done
							if (running_program.b) {
								// intro — we can tidy up immediately
								clear_animation();
							} else {
								// outro — needs to be coordinated
								if (!--running_program.group.r) run_all(running_program.group.c);
							}
						}
						running_program = null;
					} else if (now >= running_program.start) {
						const p = now - running_program.start;
						t = running_program.a + running_program.d * easing(p / running_program.duration);
						tick(t, 1 - t);
					}
				}
				return !!(running_program || pending_program);
			});
		}
	}
	return {
		run(b) {
			if (is_function(config)) {
				wait().then(() => {
					const opts = { direction: b ? 'in' : 'out' };
					// @ts-ignore
					config = config(opts);
					go(b);
				});
			} else {
				go(b);
			}
		},
		end() {
			clear_animation();
			running_program = pending_program = null;
		}
	};
}

/** @typedef {1} INTRO */
/** @typedef {0} OUTRO */
/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

/**
 * @typedef {Object} Outro
 * @property {number} r
 * @property {Function[]} c
 * @property {Object} p
 */

/**
 * @typedef {Object} PendingProgram
 * @property {number} start
 * @property {INTRO|OUTRO} b
 * @property {Outro} [group]
 */

/**
 * @typedef {Object} Program
 * @property {number} a
 * @property {INTRO|OUTRO} b
 * @property {1|-1} d
 * @property {number} duration
 * @property {number} start
 * @property {number} end
 * @property {Outro} [group]
 */

// general each functions:

function ensure_array_like(array_like_or_iterator) {
	return array_like_or_iterator?.length !== undefined
		? array_like_or_iterator
		: Array.from(array_like_or_iterator);
}

/** @returns {void} */
function outro_and_destroy_block(block, lookup) {
	transition_out(block, 1, 1, () => {
		lookup.delete(block.key);
	});
}

/** @returns {void} */
function fix_and_outro_and_destroy_block(block, lookup) {
	block.f();
	outro_and_destroy_block(block, lookup);
}

/** @returns {any[]} */
function update_keyed_each(
	old_blocks,
	dirty,
	get_key,
	dynamic,
	ctx,
	list,
	lookup,
	node,
	destroy,
	create_each_block,
	next,
	get_context
) {
	let o = old_blocks.length;
	let n = list.length;
	let i = o;
	const old_indexes = {};
	while (i--) old_indexes[old_blocks[i].key] = i;
	const new_blocks = [];
	const new_lookup = new Map();
	const deltas = new Map();
	const updates = [];
	i = n;
	while (i--) {
		const child_ctx = get_context(ctx, list, i);
		const key = get_key(child_ctx);
		let block = lookup.get(key);
		if (!block) {
			block = create_each_block(key, child_ctx);
			block.c();
		} else if (dynamic) {
			// defer updates until all the DOM shuffling is done
			updates.push(() => block.p(child_ctx, dirty));
		}
		new_lookup.set(key, (new_blocks[i] = block));
		if (key in old_indexes) deltas.set(key, Math.abs(i - old_indexes[key]));
	}
	const will_move = new Set();
	const did_move = new Set();
	/** @returns {void} */
	function insert(block) {
		transition_in(block, 1);
		block.m(node, next);
		lookup.set(block.key, block);
		next = block.first;
		n--;
	}
	while (o && n) {
		const new_block = new_blocks[n - 1];
		const old_block = old_blocks[o - 1];
		const new_key = new_block.key;
		const old_key = old_block.key;
		if (new_block === old_block) {
			// do nothing
			next = new_block.first;
			o--;
			n--;
		} else if (!new_lookup.has(old_key)) {
			// remove old block
			destroy(old_block, lookup);
			o--;
		} else if (!lookup.has(new_key) || will_move.has(new_key)) {
			insert(new_block);
		} else if (did_move.has(old_key)) {
			o--;
		} else if (deltas.get(new_key) > deltas.get(old_key)) {
			did_move.add(new_key);
			insert(new_block);
		} else {
			will_move.add(old_key);
			o--;
		}
	}
	while (o--) {
		const old_block = old_blocks[o];
		if (!new_lookup.has(old_block.key)) destroy(old_block, lookup);
	}
	while (n) insert(new_blocks[n - 1]);
	run_all(updates);
	return new_blocks;
}

/** @returns {{}} */
function get_spread_update(levels, updates) {
	const update = {};
	const to_null_out = {};
	const accounted_for = { $$scope: 1 };
	let i = levels.length;
	while (i--) {
		const o = levels[i];
		const n = updates[i];
		if (n) {
			for (const key in o) {
				if (!(key in n)) to_null_out[key] = 1;
			}
			for (const key in n) {
				if (!accounted_for[key]) {
					update[key] = n[key];
					accounted_for[key] = 1;
				}
			}
			levels[i] = n;
		} else {
			for (const key in o) {
				accounted_for[key] = 1;
			}
		}
	}
	for (const key in to_null_out) {
		if (!(key in update)) update[key] = undefined;
	}
	return update;
}

/** @returns {void} */
function mount_component(component, target, anchor) {
	const { fragment, after_update } = component.$$;
	fragment && fragment.m(target, anchor);
	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
		// if the component was destroyed immediately
		// it will update the `$$.on_destroy` reference to `null`.
		// the destructured on_destroy may still reference to the old array
		if (component.$$.on_destroy) {
			component.$$.on_destroy.push(...new_on_destroy);
		} else {
			// Edge case - component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});
	after_update.forEach(add_render_callback);
}

/** @returns {void} */
function destroy_component(component, detaching) {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		flush_render_callbacks($$.after_update);
		run_all($$.on_destroy);
		$$.fragment && $$.fragment.d(detaching);
		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}

/** @returns {void} */
function make_dirty(component, i) {
	if (component.$$.dirty[0] === -1) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty.fill(0);
	}
	component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
}

// TODO: Document the other params
/**
 * @param {SvelteComponent} component
 * @param {import('./public.js').ComponentConstructorOptions} options
 *
 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
 * This will be the `add_css` function from the compiled component.
 *
 * @returns {void}
 */
function init(
	component,
	options,
	instance,
	create_fragment,
	not_equal,
	props,
	append_styles = null,
	dirty = [-1]
) {
	const parent_component = current_component;
	set_current_component(component);
	/** @type {import('./private.js').T$$} */
	const $$ = (component.$$ = {
		fragment: null,
		ctx: [],
		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),
		// lifecycle
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
		// everything else
		callbacks: blank_object(),
		dirty,
		skip_bound: false,
		root: options.target || parent_component.$$.root
	});
	append_styles && append_styles($$.root);
	let ready = false;
	$$.ctx = instance
		? instance(component, options.props || {}, (i, ret, ...rest) => {
				const value = rest.length ? rest[0] : ret;
				if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
					if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
					if (ready) make_dirty(component, i);
				}
				return ret;
		  })
		: [];
	$$.update();
	ready = true;
	run_all($$.before_update);
	// `false` as a special case of no DOM component
	$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
	if (options.target) {
		if (options.hydrate) {
			// TODO: what is the correct type here?
			// @ts-expect-error
			const nodes = children(options.target);
			$$.fragment && $$.fragment.l(nodes);
			nodes.forEach(detach);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment && $$.fragment.c();
		}
		if (options.intro) transition_in(component.$$.fragment);
		mount_component(component, options.target, options.anchor);
		flush();
	}
	set_current_component(parent_component);
}

/**
 * Base class for Svelte components. Used when dev=false.
 *
 * @template {Record<string, any>} [Props=any]
 * @template {Record<string, any>} [Events=any]
 */
class SvelteComponent {
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$ = undefined;
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$set = undefined;

	/** @returns {void} */
	$destroy() {
		destroy_component(this, 1);
		this.$destroy = noop;
	}

	/**
	 * @template {Extract<keyof Events, string>} K
	 * @param {K} type
	 * @param {((e: Events[K]) => void) | null | undefined} callback
	 * @returns {() => void}
	 */
	$on(type, callback) {
		if (!is_function(callback)) {
			return noop;
		}
		const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
		callbacks.push(callback);
		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	/**
	 * @param {Partial<Props>} props
	 * @returns {void}
	 */
	$set(props) {
		if (this.$$set && !is_empty(props)) {
			this.$$.skip_bound = true;
			this.$$set(props);
			this.$$.skip_bound = false;
		}
	}
}

/**
 * @typedef {Object} CustomElementPropDefinition
 * @property {string} [attribute]
 * @property {boolean} [reflect]
 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
 */

// generated during release, do not modify

const PUBLIC_VERSION = '4';

if (typeof window !== 'undefined')
	// @ts-ignore
	(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

/*
Adapted from https://github.com/mattdesl
Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
*/

/**
 * https://svelte.dev/docs/svelte-easing
 * @param {number} t
 * @returns {number}
 */
function cubicOut(t) {
	const f = t - 1.0;
	return f * f * f + 1.0;
}

/**
 * The flip function calculates the start and end position of an element and animates between them, translating the x and y values.
 * `flip` stands for [First, Last, Invert, Play](https://aerotwist.com/blog/flip-your-animations/).
 *
 * https://svelte.dev/docs/svelte-animate#flip
 * @param {Element} node
 * @param {{ from: DOMRect; to: DOMRect }} fromTo
 * @param {import('./public.js').FlipParams} params
 * @returns {import('./public.js').AnimationConfig}
 */
function flip(node, { from, to }, params = {}) {
	const style = getComputedStyle(node);
	const transform = style.transform === 'none' ? '' : style.transform;
	const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat);
	const dx = from.left + (from.width * ox) / to.width - (to.left + ox);
	const dy = from.top + (from.height * oy) / to.height - (to.top + oy);
	const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
	return {
		delay,
		duration: is_function(duration) ? duration(Math.sqrt(dx * dx + dy * dy)) : duration,
		easing,
		css: (t, u) => {
			const x = u * dx;
			const y = u * dy;
			const sx = t + (u * from.width) / to.width;
			const sy = t + (u * from.height) / to.height;
			return `transform: ${transform} translate(${x}px, ${y}px) scale(${sx}, ${sy});`;
		}
	};
}

/**
 * Animates the opacity of an element from 0 to the current opacity for `in` transitions and from the current opacity to 0 for `out` transitions.
 *
 * https://svelte.dev/docs/svelte-transition#fade
 * @param {Element} node
 * @param {import('./public').FadeParams} [params]
 * @returns {import('./public').TransitionConfig}
 */
function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
	const o = +getComputedStyle(node).opacity;
	return {
		delay,
		duration,
		easing,
		css: (t) => `opacity: ${t * o}`
	};
}

/* node_modules/simple-svelte-autocomplete/src/SimpleAutocomplete.svelte generated by Svelte v4.2.10 */

const { window: window_1 } = globals;

function add_css(target) {
	append_styles(target, "svelte-75ckfb", ".autocomplete.svelte-75ckfb.svelte-75ckfb{min-width:200px;display:inline-block;max-width:100%;position:relative;vertical-align:top;height:2.25em}.autocomplete.svelte-75ckfb.svelte-75ckfb:not(.hide-arrow):not(.is-loading)::after{border:3px solid;border-radius:2px;border-right:0;border-top:0;content:\" \";display:block;height:0.625em;margin-top:-0.4375em;pointer-events:none;position:absolute;top:50%;-webkit-transform:rotate(-45deg);transform:rotate(-45deg);-webkit-transform-origin:center;transform-origin:center;width:0.625em;border-color:#3273dc;right:1.125em;z-index:4}.autocomplete.show-clear.svelte-75ckfb.svelte-75ckfb:not(.hide-arrow)::after{right:2.3em}.autocomplete.svelte-75ckfb .svelte-75ckfb{box-sizing:border-box}.autocomplete-input.svelte-75ckfb.svelte-75ckfb{font:inherit;width:100%;height:100%;padding:5px 11px}.autocomplete.svelte-75ckfb:not(.hide-arrow) .autocomplete-input.svelte-75ckfb{padding-right:2em}.autocomplete.show-clear.svelte-75ckfb:not(.hide-arrow) .autocomplete-input.svelte-75ckfb{padding-right:3.2em}.autocomplete.hide-arrow.show-clear.svelte-75ckfb .autocomplete-input.svelte-75ckfb{padding-right:2em}.autocomplete-list.svelte-75ckfb.svelte-75ckfb{background:#fff;position:relative;width:100%;overflow-y:auto;z-index:99;padding:10px 0;top:0px;border:1px solid #999;max-height:calc(15 * (1rem + 10px) + 15px);user-select:none}.autocomplete-list.svelte-75ckfb.svelte-75ckfb:empty{padding:0}.autocomplete-list-item.svelte-75ckfb.svelte-75ckfb{padding:5px 15px;color:#333;cursor:pointer;line-height:1}.autocomplete-list-item.confirmed.svelte-75ckfb.svelte-75ckfb{background-color:#789fed;color:#fff}.autocomplete-list-item.selected.svelte-75ckfb.svelte-75ckfb{background-color:#2e69e2;color:#fff}.autocomplete-list-item-no-results.svelte-75ckfb.svelte-75ckfb{padding:5px 15px;color:#999;line-height:1}.autocomplete-list-item-create.svelte-75ckfb.svelte-75ckfb{padding:5px 15px;line-height:1}.autocomplete-list-item-loading.svelte-75ckfb.svelte-75ckfb{padding:5px 15px;line-height:1}.autocomplete-list.hidden.svelte-75ckfb.svelte-75ckfb{visibility:hidden}.autocomplete.show-clear.svelte-75ckfb .autocomplete-clear-button.svelte-75ckfb{cursor:pointer;display:block;text-align:center;position:absolute;right:0.1em;padding:0.3em 0.6em;top:50%;-webkit-transform:translateY(-50%);-ms-transform:translateY(-50%);transform:translateY(-50%);z-index:4}.autocomplete.svelte-75ckfb:not(.show-clear) .autocomplete-clear-button.svelte-75ckfb{display:none}.autocomplete.svelte-75ckfb select.svelte-75ckfb{display:none}.autocomplete.is-multiple.svelte-75ckfb .input-container.svelte-75ckfb{height:auto;box-shadow:inset 0 1px 2px rgba(10, 10, 10, 0.1);border-radius:4px;border:1px solid #b5b5b5;padding-left:0.4em;padding-right:0.4em;display:flex;flex-wrap:wrap;align-items:stretch;background-color:#fff}.autocomplete.is-multiple.svelte-75ckfb .tag.svelte-75ckfb{display:flex;margin-top:0.5em;margin-bottom:0.3em}.autocomplete.is-multiple.svelte-75ckfb .tag.is-delete.svelte-75ckfb{cursor:pointer}.autocomplete.is-multiple.svelte-75ckfb .tags.svelte-75ckfb{margin-right:0.3em;margin-bottom:0}.autocomplete.is-multiple.svelte-75ckfb .autocomplete-input.svelte-75ckfb{display:flex;width:100%;flex:1 1 50px;min-width:3em;border:none;box-shadow:none;background:none}");
}

const get_no_results_slot_changes = dirty => ({
	noResultsText: dirty[0] & /*noResultsText*/ 1024
});

const get_no_results_slot_context = ctx => ({ noResultsText: /*noResultsText*/ ctx[10] });

const get_create_slot_changes = dirty => ({
	createText: dirty[0] & /*createText*/ 8192
});

const get_create_slot_context = ctx => ({ createText: /*createText*/ ctx[13] });

const get_loading_slot_changes = dirty => ({
	loadingText: dirty[0] & /*loadingText*/ 2048
});

const get_loading_slot_context = ctx => ({ loadingText: /*loadingText*/ ctx[11] });

const get_dropdown_footer_slot_changes = dirty => ({
	nbItems: dirty[1] & /*filteredListItems*/ 1,
	maxItemsToShowInList: dirty[0] & /*maxItemsToShowInList*/ 16
});

const get_dropdown_footer_slot_context = ctx => ({
	nbItems: /*filteredListItems*/ ctx[31].length,
	maxItemsToShowInList: /*maxItemsToShowInList*/ ctx[4]
});

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[144] = list[i];
	child_ctx[146] = i;
	return child_ctx;
}

const get_item_slot_changes = dirty => ({
	item: dirty[1] & /*filteredListItems*/ 1,
	label: dirty[1] & /*filteredListItems*/ 1
});

const get_item_slot_context = ctx => ({
	item: /*listItem*/ ctx[144].item,
	label: /*listItem*/ ctx[144].highlighted
	? /*listItem*/ ctx[144].highlighted
	: /*listItem*/ ctx[144].label
});

const get_dropdown_header_slot_changes = dirty => ({
	nbItems: dirty[1] & /*filteredListItems*/ 1,
	maxItemsToShowInList: dirty[0] & /*maxItemsToShowInList*/ 16
});

const get_dropdown_header_slot_context = ctx => ({
	nbItems: /*filteredListItems*/ ctx[31].length,
	maxItemsToShowInList: /*maxItemsToShowInList*/ ctx[4]
});

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[147] = list[i];
	child_ctx[146] = i;
	return child_ctx;
}

const get_tag_slot_changes = dirty => ({
	label: dirty[0] & /*selectedItem*/ 2,
	item: dirty[0] & /*selectedItem*/ 2
});

const get_tag_slot_context = ctx => ({
	label: /*safeLabelFunction*/ ctx[43](/*tagItem*/ ctx[147]),
	item: /*tagItem*/ ctx[147],
	unselectItem: /*unselectItem*/ ctx[50]
});

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[146] = list[i];
	return child_ctx;
}

// (1125:39) 
function create_if_block_11(ctx) {
	let each_1_anchor;
	let each_value_2 = ensure_array_like(/*selectedItem*/ ctx[1]);
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*valueFunction, selectedItem*/ 10 | dirty[1] & /*safeLabelFunction*/ 4096) {
				each_value_2 = ensure_array_like(/*selectedItem*/ ctx[1]);
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (1121:4) {#if !multiple && hasSelection}
function create_if_block_10(ctx) {
	let option;
	let t_value = /*safeLabelFunction*/ ctx[43](/*selectedItem*/ ctx[1]) + "";
	let t;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t = text(t_value);
			option.__value = option_value_value = /*valueFunction*/ ctx[3](/*selectedItem*/ ctx[1], true);
			set_input_value(option, option.__value);
			option.selected = true;
			attr(option, "class", "svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedItem*/ 2 && t_value !== (t_value = /*safeLabelFunction*/ ctx[43](/*selectedItem*/ ctx[1]) + "")) set_data(t, t_value);

			if (dirty[0] & /*valueFunction, selectedItem*/ 10 && option_value_value !== (option_value_value = /*valueFunction*/ ctx[3](/*selectedItem*/ ctx[1], true))) {
				option.__value = option_value_value;
				set_input_value(option, option.__value);
			}
		},
		d(detaching) {
			if (detaching) {
				detach(option);
			}
		}
	};
}

// (1126:6) {#each selectedItem as i}
function create_each_block_2(ctx) {
	let option;
	let t0_value = /*safeLabelFunction*/ ctx[43](/*i*/ ctx[146]) + "";
	let t0;
	let t1;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t0 = text(t0_value);
			t1 = space();
			option.__value = option_value_value = /*valueFunction*/ ctx[3](/*i*/ ctx[146], true);
			set_input_value(option, option.__value);
			option.selected = true;
			attr(option, "class", "svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t0);
			append(option, t1);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedItem*/ 2 && t0_value !== (t0_value = /*safeLabelFunction*/ ctx[43](/*i*/ ctx[146]) + "")) set_data(t0, t0_value);

			if (dirty[0] & /*valueFunction, selectedItem*/ 10 && option_value_value !== (option_value_value = /*valueFunction*/ ctx[3](/*i*/ ctx[146], true))) {
				option.__value = option_value_value;
				set_input_value(option, option.__value);
			}
		},
		d(detaching) {
			if (detaching) {
				detach(option);
			}
		}
	};
}

// (1134:4) {#if multiple && hasSelection}
function create_if_block_9(ctx) {
	let each_blocks = [];
	let each_1_lookup = new Map();
	let each_1_anchor;
	let current;
	let each_value_1 = ensure_array_like(/*selectedItem*/ ctx[1]);
	const get_key = ctx => /*valueFunction*/ ctx[3](/*tagItem*/ ctx[147], true);

	for (let i = 0; i < each_value_1.length; i += 1) {
		let child_ctx = get_each_context_1(ctx, each_value_1, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedItem, valueFunction*/ 10 | dirty[1] & /*draggingOver, dragstart, dragover, dragleave, drop, unselectItem, safeLabelFunction*/ 503844992 | dirty[3] & /*$$scope*/ 8) {
				each_value_1 = ensure_array_like(/*selectedItem*/ ctx[1]);
				group_outros();
				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, fix_and_outro_and_destroy_block, create_each_block_1, each_1_anchor, get_each_context_1);
				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d(detaching);
			}
		}
	};
}

// (1146:92)              
function fallback_block_5(ctx) {
	let div;
	let span0;
	let t0_value = /*safeLabelFunction*/ ctx[43](/*tagItem*/ ctx[147]) + "";
	let t0;
	let t1;
	let span1;
	let mounted;
	let dispose;

	function keypress_handler(...args) {
		return /*keypress_handler*/ ctx[99](/*tagItem*/ ctx[147], ...args);
	}

	return {
		c() {
			div = element("div");
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");
			attr(span0, "class", "tag svelte-75ckfb");
			attr(span1, "class", "tag is-delete svelte-75ckfb");
			attr(div, "class", "tags has-addons svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, span0);
			append(span0, t0);
			append(div, t1);
			append(div, span1);

			if (!mounted) {
				dispose = [
					listen(span1, "click", prevent_default(function () {
						if (is_function(/*unselectItem*/ ctx[50](/*tagItem*/ ctx[147]))) /*unselectItem*/ ctx[50](/*tagItem*/ ctx[147]).apply(this, arguments);
					})),
					listen(span1, "keypress", prevent_default(keypress_handler))
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*selectedItem*/ 2 && t0_value !== (t0_value = /*safeLabelFunction*/ ctx[43](/*tagItem*/ ctx[147]) + "")) set_data(t0, t0_value);
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (1135:6) {#each selectedItem as tagItem, i (valueFunction(tagItem, true))}
function create_each_block_1(key_1, ctx) {
	let div;
	let t;
	let div_transition;
	let rect;
	let stop_animation = noop;
	let current;
	let mounted;
	let dispose;
	const tag_slot_template = /*#slots*/ ctx[97].tag;
	const tag_slot = create_slot(tag_slot_template, ctx, /*$$scope*/ ctx[96], get_tag_slot_context);
	const tag_slot_or_fallback = tag_slot || fallback_block_5(ctx);

	function dragstart_handler(...args) {
		return /*dragstart_handler*/ ctx[100](/*i*/ ctx[146], ...args);
	}

	function dragover_handler(...args) {
		return /*dragover_handler*/ ctx[101](/*i*/ ctx[146], ...args);
	}

	function dragleave_handler(...args) {
		return /*dragleave_handler*/ ctx[102](/*i*/ ctx[146], ...args);
	}

	function drop_handler(...args) {
		return /*drop_handler*/ ctx[103](/*i*/ ctx[146], ...args);
	}

	return {
		key: key_1,
		first: null,
		c() {
			div = element("div");
			if (tag_slot_or_fallback) tag_slot_or_fallback.c();
			t = space();
			attr(div, "draggable", true);
			attr(div, "class", "svelte-75ckfb");
			toggle_class(div, "is-active", /*draggingOver*/ ctx[38] === /*i*/ ctx[146]);
			this.first = div;
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (tag_slot_or_fallback) {
				tag_slot_or_fallback.m(div, null);
			}

			append(div, t);
			current = true;

			if (!mounted) {
				dispose = [
					listen(div, "dragstart", dragstart_handler),
					listen(div, "dragover", dragover_handler),
					listen(div, "dragleave", dragleave_handler),
					listen(div, "drop", drop_handler)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (tag_slot) {
				if (tag_slot.p && (!current || dirty[0] & /*selectedItem*/ 2 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						tag_slot,
						tag_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(tag_slot_template, /*$$scope*/ ctx[96], dirty, get_tag_slot_changes),
						get_tag_slot_context
					);
				}
			} else {
				if (tag_slot_or_fallback && tag_slot_or_fallback.p && (!current || dirty[0] & /*selectedItem*/ 2)) {
					tag_slot_or_fallback.p(ctx, !current ? [-1, -1, -1, -1, -1] : dirty);
				}
			}

			if (!current || dirty[0] & /*selectedItem*/ 2 | dirty[1] & /*draggingOver*/ 128) {
				toggle_class(div, "is-active", /*draggingOver*/ ctx[38] === /*i*/ ctx[146]);
			}
		},
		r() {
			rect = div.getBoundingClientRect();
		},
		f() {
			fix_position(div);
			stop_animation();
			add_transform(div, rect);
		},
		a() {
			stop_animation();
			stop_animation = create_animation(div, rect, flip, { duration: 200 });
		},
		i(local) {
			if (current) return;
			transition_in(tag_slot_or_fallback, local);

			if (local) {
				add_render_callback(() => {
					if (!current) return;
					if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 200 }, true);
					div_transition.run(1);
				});
			}

			current = true;
		},
		o(local) {
			transition_out(tag_slot_or_fallback, local);

			if (local) {
				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 200 }, false);
				div_transition.run(0);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (tag_slot_or_fallback) tag_slot_or_fallback.d(detaching);
			if (detaching && div_transition) div_transition.end();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1185:4) {#if clearable}
function create_if_block_8(ctx) {
	let span;
	let mounted;
	let dispose;

	return {
		c() {
			span = element("span");
			attr(span, "class", "autocomplete-clear-button svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, span, anchor);
			span.innerHTML = /*clearText*/ ctx[8];

			if (!mounted) {
				dispose = [
					listen(span, "click", /*clear*/ ctx[54]),
					listen(span, "keypress", /*keypress_handler_1*/ ctx[108])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*clearText*/ 256) span.innerHTML = /*clearText*/ ctx[8];		},
		d(detaching) {
			if (detaching) {
				detach(span);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

// (1250:28) 
function create_if_block_7(ctx) {
	let div;
	let current;
	const no_results_slot_template = /*#slots*/ ctx[97]["no-results"];
	const no_results_slot = create_slot(no_results_slot_template, ctx, /*$$scope*/ ctx[96], get_no_results_slot_context);
	const no_results_slot_or_fallback = no_results_slot || fallback_block_4(ctx);

	return {
		c() {
			div = element("div");
			if (no_results_slot_or_fallback) no_results_slot_or_fallback.c();
			attr(div, "class", "autocomplete-list-item-no-results svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (no_results_slot_or_fallback) {
				no_results_slot_or_fallback.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (no_results_slot) {
				if (no_results_slot.p && (!current || dirty[0] & /*noResultsText*/ 1024 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						no_results_slot,
						no_results_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(no_results_slot_template, /*$$scope*/ ctx[96], dirty, get_no_results_slot_changes),
						get_no_results_slot_context
					);
				}
			} else {
				if (no_results_slot_or_fallback && no_results_slot_or_fallback.p && (!current || dirty[0] & /*noResultsText*/ 1024)) {
					no_results_slot_or_fallback.p(ctx, !current ? [-1, -1, -1, -1, -1] : dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(no_results_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(no_results_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (no_results_slot_or_fallback) no_results_slot_or_fallback.d(detaching);
		}
	};
}

// (1242:21) 
function create_if_block_6(ctx) {
	let div;
	let current;
	let mounted;
	let dispose;
	const create_slot_template = /*#slots*/ ctx[97].create;
	const create_slot_1 = create_slot(create_slot_template, ctx, /*$$scope*/ ctx[96], get_create_slot_context);
	const create_slot_or_fallback = create_slot_1 || fallback_block_3(ctx);

	return {
		c() {
			div = element("div");
			if (create_slot_or_fallback) create_slot_or_fallback.c();
			attr(div, "class", "autocomplete-list-item-create svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (create_slot_or_fallback) {
				create_slot_or_fallback.m(div, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div, "click", /*selectItem*/ ctx[44]),
					listen(div, "keypress", /*keypress_handler_3*/ ctx[113])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (create_slot_1) {
				if (create_slot_1.p && (!current || dirty[0] & /*createText*/ 8192 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						create_slot_1,
						create_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(create_slot_template, /*$$scope*/ ctx[96], dirty, get_create_slot_changes),
						get_create_slot_context
					);
				}
			} else {
				if (create_slot_or_fallback && create_slot_or_fallback.p && (!current || dirty[0] & /*createText*/ 8192)) {
					create_slot_or_fallback.p(ctx, !current ? [-1, -1, -1, -1, -1] : dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(create_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(create_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (create_slot_or_fallback) create_slot_or_fallback.d(detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1238:37) 
function create_if_block_5(ctx) {
	let div;
	let current;
	const loading_slot_template = /*#slots*/ ctx[97].loading;
	const loading_slot = create_slot(loading_slot_template, ctx, /*$$scope*/ ctx[96], get_loading_slot_context);
	const loading_slot_or_fallback = loading_slot || fallback_block_2(ctx);

	return {
		c() {
			div = element("div");
			if (loading_slot_or_fallback) loading_slot_or_fallback.c();
			attr(div, "class", "autocomplete-list-item-loading svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (loading_slot_or_fallback) {
				loading_slot_or_fallback.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (loading_slot) {
				if (loading_slot.p && (!current || dirty[0] & /*loadingText*/ 2048 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						loading_slot,
						loading_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(loading_slot_template, /*$$scope*/ ctx[96], dirty, get_loading_slot_changes),
						get_loading_slot_context
					);
				}
			} else {
				if (loading_slot_or_fallback && loading_slot_or_fallback.p && (!current || dirty[0] & /*loadingText*/ 2048)) {
					loading_slot_or_fallback.p(ctx, !current ? [-1, -1, -1, -1, -1] : dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(loading_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(loading_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (loading_slot_or_fallback) loading_slot_or_fallback.d(detaching);
		}
	};
}

// (1198:4) {#if filteredListItems && filteredListItems.length > 0}
function create_if_block(ctx) {
	let t0;
	let t1;
	let current;
	const dropdown_header_slot_template = /*#slots*/ ctx[97]["dropdown-header"];
	const dropdown_header_slot = create_slot(dropdown_header_slot_template, ctx, /*$$scope*/ ctx[96], get_dropdown_header_slot_context);
	let each_value = ensure_array_like(/*filteredListItems*/ ctx[31]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	const dropdown_footer_slot_template = /*#slots*/ ctx[97]["dropdown-footer"];
	const dropdown_footer_slot = create_slot(dropdown_footer_slot_template, ctx, /*$$scope*/ ctx[96], get_dropdown_footer_slot_context);
	const dropdown_footer_slot_or_fallback = dropdown_footer_slot || fallback_block(ctx);

	return {
		c() {
			if (dropdown_header_slot) dropdown_header_slot.c();
			t0 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			if (dropdown_footer_slot_or_fallback) dropdown_footer_slot_or_fallback.c();
		},
		m(target, anchor) {
			if (dropdown_header_slot) {
				dropdown_header_slot.m(target, anchor);
			}

			insert(target, t0, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, t1, anchor);

			if (dropdown_footer_slot_or_fallback) {
				dropdown_footer_slot_or_fallback.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (dropdown_header_slot) {
				if (dropdown_header_slot.p && (!current || dirty[0] & /*maxItemsToShowInList*/ 16 | dirty[1] & /*filteredListItems*/ 1 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						dropdown_header_slot,
						dropdown_header_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(dropdown_header_slot_template, /*$$scope*/ ctx[96], dirty, get_dropdown_header_slot_changes),
						get_dropdown_header_slot_context
					);
				}
			}

			if (dirty[0] & /*highlightIndex, maxItemsToShowInList*/ 1073741840 | dirty[1] & /*isConfirmed, filteredListItems, onListItemClick*/ 16793601 | dirty[3] & /*$$scope*/ 8) {
				each_value = ensure_array_like(/*filteredListItems*/ ctx[31]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(t1.parentNode, t1);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			if (dropdown_footer_slot) {
				if (dropdown_footer_slot.p && (!current || dirty[0] & /*maxItemsToShowInList*/ 16 | dirty[1] & /*filteredListItems*/ 1 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						dropdown_footer_slot,
						dropdown_footer_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(dropdown_footer_slot_template, /*$$scope*/ ctx[96], dirty, get_dropdown_footer_slot_changes),
						get_dropdown_footer_slot_context
					);
				}
			} else {
				if (dropdown_footer_slot_or_fallback && dropdown_footer_slot_or_fallback.p && (!current || dirty[0] & /*moreItemsText, maxItemsToShowInList*/ 4112 | dirty[1] & /*filteredListItems*/ 1)) {
					dropdown_footer_slot_or_fallback.p(ctx, !current ? [-1, -1, -1, -1, -1] : dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(dropdown_header_slot, local);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			transition_in(dropdown_footer_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(dropdown_header_slot, local);
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			transition_out(dropdown_footer_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}

			if (dropdown_header_slot) dropdown_header_slot.d(detaching);
			destroy_each(each_blocks, detaching);
			if (dropdown_footer_slot_or_fallback) dropdown_footer_slot_or_fallback.d(detaching);
		}
	};
}

// (1252:48) {noResultsText}
function fallback_block_4(ctx) {
	let t;

	return {
		c() {
			t = text(/*noResultsText*/ ctx[10]);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*noResultsText*/ 1024) set_data(t, /*noResultsText*/ ctx[10]);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (1248:41) {createText}
function fallback_block_3(ctx) {
	let t;

	return {
		c() {
			t = text(/*createText*/ ctx[13]);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*createText*/ 8192) set_data(t, /*createText*/ ctx[13]);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (1240:43) {loadingText}
function fallback_block_2(ctx) {
	let t;

	return {
		c() {
			t = text(/*loadingText*/ ctx[11]);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*loadingText*/ 2048) set_data(t, /*loadingText*/ ctx[11]);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (1202:8) {#if listItem && (maxItemsToShowInList <= 0 || i < maxItemsToShowInList)}
function create_if_block_3(ctx) {
	let div;
	let current;
	let mounted;
	let dispose;
	const item_slot_template = /*#slots*/ ctx[97].item;
	const item_slot = create_slot(item_slot_template, ctx, /*$$scope*/ ctx[96], get_item_slot_context);
	const item_slot_or_fallback = item_slot || fallback_block_1(ctx);

	function click_handler() {
		return /*click_handler*/ ctx[110](/*listItem*/ ctx[144]);
	}

	function keypress_handler_2(...args) {
		return /*keypress_handler_2*/ ctx[111](/*listItem*/ ctx[144], ...args);
	}

	function pointerenter_handler() {
		return /*pointerenter_handler*/ ctx[112](/*i*/ ctx[146]);
	}

	return {
		c() {
			div = element("div");
			if (item_slot_or_fallback) item_slot_or_fallback.c();
			attr(div, "class", "autocomplete-list-item svelte-75ckfb");
			toggle_class(div, "selected", /*i*/ ctx[146] === /*highlightIndex*/ ctx[30]);
			toggle_class(div, "confirmed", /*isConfirmed*/ ctx[55](/*listItem*/ ctx[144].item));
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (item_slot_or_fallback) {
				item_slot_or_fallback.m(div, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div, "click", click_handler),
					listen(div, "keypress", keypress_handler_2),
					listen(div, "pointerenter", pointerenter_handler)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (item_slot) {
				if (item_slot.p && (!current || dirty[1] & /*filteredListItems*/ 1 | dirty[3] & /*$$scope*/ 8)) {
					update_slot_base(
						item_slot,
						item_slot_template,
						ctx,
						/*$$scope*/ ctx[96],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[96])
						: get_slot_changes(item_slot_template, /*$$scope*/ ctx[96], dirty, get_item_slot_changes),
						get_item_slot_context
					);
				}
			} else {
				if (item_slot_or_fallback && item_slot_or_fallback.p && (!current || dirty[1] & /*filteredListItems*/ 1)) {
					item_slot_or_fallback.p(ctx, !current ? [-1, -1, -1, -1, -1] : dirty);
				}
			}

			if (!current || dirty[0] & /*highlightIndex*/ 1073741824) {
				toggle_class(div, "selected", /*i*/ ctx[146] === /*highlightIndex*/ ctx[30]);
			}

			if (!current || dirty[1] & /*isConfirmed, filteredListItems*/ 16777217) {
				toggle_class(div, "confirmed", /*isConfirmed*/ ctx[55](/*listItem*/ ctx[144].item));
			}
		},
		i(local) {
			if (current) return;
			transition_in(item_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(item_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (item_slot_or_fallback) item_slot_or_fallback.d(detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1220:14) {:else}
function create_else_block(ctx) {
	let html_tag;
	let raw_value = /*listItem*/ ctx[144].label + "";
	let html_anchor;

	return {
		c() {
			html_tag = new HtmlTag(false);
			html_anchor = empty();
			html_tag.a = html_anchor;
		},
		m(target, anchor) {
			html_tag.m(raw_value, target, anchor);
			insert(target, html_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty[1] & /*filteredListItems*/ 1 && raw_value !== (raw_value = /*listItem*/ ctx[144].label + "")) html_tag.p(raw_value);
		},
		d(detaching) {
			if (detaching) {
				detach(html_anchor);
				html_tag.d();
			}
		}
	};
}

// (1218:14) {#if listItem.highlighted}
function create_if_block_4(ctx) {
	let html_tag;
	let raw_value = /*listItem*/ ctx[144].highlighted + "";
	let html_anchor;

	return {
		c() {
			html_tag = new HtmlTag(false);
			html_anchor = empty();
			html_tag.a = html_anchor;
		},
		m(target, anchor) {
			html_tag.m(raw_value, target, anchor);
			insert(target, html_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty[1] & /*filteredListItems*/ 1 && raw_value !== (raw_value = /*listItem*/ ctx[144].highlighted + "")) html_tag.p(raw_value);
		},
		d(detaching) {
			if (detaching) {
				detach(html_anchor);
				html_tag.d();
			}
		}
	};
}

// (1217:13)                
function fallback_block_1(ctx) {
	let if_block_anchor;

	function select_block_type_2(ctx, dirty) {
		if (/*listItem*/ ctx[144].highlighted) return create_if_block_4;
		return create_else_block;
	}

	let current_block_type = select_block_type_2(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_block.d(detaching);
		}
	};
}

// (1201:6) {#each filteredListItems as listItem, i}
function create_each_block(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*listItem*/ ctx[144] && (/*maxItemsToShowInList*/ ctx[4] <= 0 || /*i*/ ctx[146] < /*maxItemsToShowInList*/ ctx[4]) && create_if_block_3(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (/*listItem*/ ctx[144] && (/*maxItemsToShowInList*/ ctx[4] <= 0 || /*i*/ ctx[146] < /*maxItemsToShowInList*/ ctx[4])) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty[0] & /*maxItemsToShowInList*/ 16 | dirty[1] & /*filteredListItems*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_3(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) if_block.d(detaching);
		}
	};
}

// (1229:8) {#if maxItemsToShowInList > 0 && filteredListItems.length > maxItemsToShowInList}
function create_if_block_1(ctx) {
	let if_block_anchor;
	let if_block = /*moreItemsText*/ ctx[12] && create_if_block_2(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (/*moreItemsText*/ ctx[12]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_2(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) if_block.d(detaching);
		}
	};
}

// (1230:10) {#if moreItemsText}
function create_if_block_2(ctx) {
	let div;
	let t0;
	let t1_value = /*filteredListItems*/ ctx[31].length - /*maxItemsToShowInList*/ ctx[4] + "";
	let t1;
	let t2;
	let t3;

	return {
		c() {
			div = element("div");
			t0 = text("...");
			t1 = text(t1_value);
			t2 = space();
			t3 = text(/*moreItemsText*/ ctx[12]);
			attr(div, "class", "autocomplete-list-item-no-results svelte-75ckfb");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
			append(div, t2);
			append(div, t3);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*maxItemsToShowInList*/ 16 | dirty[1] & /*filteredListItems*/ 1 && t1_value !== (t1_value = /*filteredListItems*/ ctx[31].length - /*maxItemsToShowInList*/ ctx[4] + "")) set_data(t1, t1_value);
			if (dirty[0] & /*moreItemsText*/ 4096) set_data(t3, /*moreItemsText*/ ctx[12]);
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}
		}
	};
}

// (1228:93)          
function fallback_block(ctx) {
	let if_block_anchor;
	let if_block = /*maxItemsToShowInList*/ ctx[4] > 0 && /*filteredListItems*/ ctx[31].length > /*maxItemsToShowInList*/ ctx[4] && create_if_block_1(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (/*maxItemsToShowInList*/ ctx[4] > 0 && /*filteredListItems*/ ctx[31].length > /*maxItemsToShowInList*/ ctx[4]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_1(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (if_block) if_block.d(detaching);
		}
	};
}

function create_fragment(ctx) {
	let div2;
	let select;
	let t0;
	let div0;
	let t1;
	let input_1;
	let input_1_class_value;
	let input_1_id_value;
	let input_1_autocomplete_value;
	let input_1_readonly_value;
	let t2;
	let t3;
	let div1;
	let current_block_type_index;
	let if_block3;
	let div1_class_value;
	let div2_class_value;
	let current;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (!/*multiple*/ ctx[5] && /*hasSelection*/ ctx[32]) return create_if_block_10;
		if (/*multiple*/ ctx[5] && /*hasSelection*/ ctx[32]) return create_if_block_11;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type && current_block_type(ctx);
	let if_block1 = /*multiple*/ ctx[5] && /*hasSelection*/ ctx[32] && create_if_block_9(ctx);

	let input_1_levels = [
		{ type: "text" },
		{
			class: input_1_class_value = "" + ((/*inputClassName*/ ctx[16]
			? /*inputClassName*/ ctx[16]
			: '') + " " + (/*noInputStyles*/ ctx[27]
			? ''
			: 'input autocomplete-input'))
		},
		{
			id: input_1_id_value = /*inputId*/ ctx[17] ? /*inputId*/ ctx[17] : ""
		},
		{
			autocomplete: input_1_autocomplete_value = /*html5autocomplete*/ ctx[22]
			? "on"
			: /*autocompleteOffValue*/ ctx[23]
		},
		{ placeholder: /*placeholder*/ ctx[14] },
		{ name: /*name*/ ctx[18] },
		{ disabled: /*disabled*/ ctx[26] },
		{ required: /*required*/ ctx[28] },
		{ title: /*title*/ ctx[21] },
		{
			readOnly: input_1_readonly_value = /*readonly*/ ctx[24] || /*locked*/ ctx[39]
		},
		{ tabindex: /*tabindex*/ ctx[29] },
		/*$$restProps*/ ctx[60]
	];

	let input_data = {};

	for (let i = 0; i < input_1_levels.length; i += 1) {
		input_data = assign(input_data, input_1_levels[i]);
	}

	let if_block2 = /*clearable*/ ctx[40] && create_if_block_8(ctx);
	const if_block_creators = [create_if_block, create_if_block_5, create_if_block_6, create_if_block_7];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*filteredListItems*/ ctx[31] && /*filteredListItems*/ ctx[31].length > 0) return 0;
		if (/*loading*/ ctx[36] && /*loadingText*/ ctx[11]) return 1;
		if (/*create*/ ctx[6]) return 2;
		if (/*noResultsText*/ ctx[10]) return 3;
		return -1;
	}

	if (~(current_block_type_index = select_block_type_1(ctx))) {
		if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	}

	return {
		c() {
			div2 = element("div");
			select = element("select");
			if (if_block0) if_block0.c();
			t0 = space();
			div0 = element("div");
			if (if_block1) if_block1.c();
			t1 = space();
			input_1 = element("input");
			t2 = space();
			if (if_block2) if_block2.c();
			t3 = space();
			div1 = element("div");
			if (if_block3) if_block3.c();
			attr(select, "name", /*selectName*/ ctx[19]);
			attr(select, "id", /*selectId*/ ctx[20]);
			select.multiple = /*multiple*/ ctx[5];
			attr(select, "class", "svelte-75ckfb");
			set_attributes(input_1, input_data);
			toggle_class(input_1, "svelte-75ckfb", true);
			attr(div0, "class", "input-container svelte-75ckfb");

			attr(div1, "class", div1_class_value = "" + ((/*dropdownClassName*/ ctx[25]
			? /*dropdownClassName*/ ctx[25]
			: '') + " autocomplete-list " + (/*showList*/ ctx[41] ? '' : 'hidden') + " is-fullwidth" + " svelte-75ckfb"));

			attr(div2, "class", div2_class_value = "" + ((/*className*/ ctx[15] ? /*className*/ ctx[15] : '') + " autocomplete select is-fullwidth " + /*uniqueId*/ ctx[42] + " svelte-75ckfb"));
			toggle_class(div2, "hide-arrow", /*hideArrow*/ ctx[7] || !/*items*/ ctx[0].length);
			toggle_class(div2, "is-multiple", /*multiple*/ ctx[5]);
			toggle_class(div2, "show-clear", /*clearable*/ ctx[40]);
			toggle_class(div2, "is-loading", /*showLoadingIndicator*/ ctx[9] && /*loading*/ ctx[36]);
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, select);
			if (if_block0) if_block0.m(select, null);
			append(div2, t0);
			append(div2, div0);
			if (if_block1) if_block1.m(div0, null);
			append(div0, t1);
			append(div0, input_1);
			if (input_1.autofocus) input_1.focus();
			/*input_1_binding*/ ctx[104](input_1);
			set_input_value(input_1, /*text*/ ctx[2]);
			append(div0, t2);
			if (if_block2) if_block2.m(div0, null);
			/*div0_binding*/ ctx[109](div0);
			append(div2, t3);
			append(div2, div1);

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(div1, null);
			}

			/*div1_binding*/ ctx[114](div1);
			current = true;

			if (!mounted) {
				dispose = [
					listen(window_1, "click", /*onDocumentClick*/ ctx[46]),
					listen(window_1, "scroll", /*scroll_handler*/ ctx[98]),
					listen(input_1, "input", /*input_1_input_handler*/ ctx[105]),
					listen(input_1, "input", /*onInput*/ ctx[49]),
					listen(input_1, "focus", /*onFocusInternal*/ ctx[52]),
					listen(input_1, "blur", /*onBlurInternal*/ ctx[53]),
					listen(input_1, "keydown", /*onKeyDown*/ ctx[47]),
					listen(input_1, "click", /*onInputClick*/ ctx[51]),
					listen(input_1, "keypress", /*onKeyPress*/ ctx[48]),
					listen(input_1, "dragover", /*dragover_handler_1*/ ctx[106]),
					listen(input_1, "drop", /*drop_handler_1*/ ctx[107])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if (if_block0) if_block0.d(1);
				if_block0 = current_block_type && current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(select, null);
				}
			}

			if (!current || dirty[0] & /*selectName*/ 524288) {
				attr(select, "name", /*selectName*/ ctx[19]);
			}

			if (!current || dirty[0] & /*selectId*/ 1048576) {
				attr(select, "id", /*selectId*/ ctx[20]);
			}

			if (!current || dirty[0] & /*multiple*/ 32) {
				select.multiple = /*multiple*/ ctx[5];
			}

			if (/*multiple*/ ctx[5] && /*hasSelection*/ ctx[32]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty[0] & /*multiple*/ 32 | dirty[1] & /*hasSelection*/ 2) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block_9(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div0, t1);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}

			set_attributes(input_1, input_data = get_spread_update(input_1_levels, [
				{ type: "text" },
				(!current || dirty[0] & /*inputClassName, noInputStyles*/ 134283264 && input_1_class_value !== (input_1_class_value = "" + ((/*inputClassName*/ ctx[16]
				? /*inputClassName*/ ctx[16]
				: '') + " " + (/*noInputStyles*/ ctx[27]
				? ''
				: 'input autocomplete-input')))) && { class: input_1_class_value },
				(!current || dirty[0] & /*inputId*/ 131072 && input_1_id_value !== (input_1_id_value = /*inputId*/ ctx[17] ? /*inputId*/ ctx[17] : "")) && { id: input_1_id_value },
				(!current || dirty[0] & /*html5autocomplete, autocompleteOffValue*/ 12582912 && input_1_autocomplete_value !== (input_1_autocomplete_value = /*html5autocomplete*/ ctx[22]
				? "on"
				: /*autocompleteOffValue*/ ctx[23])) && { autocomplete: input_1_autocomplete_value },
				(!current || dirty[0] & /*placeholder*/ 16384) && { placeholder: /*placeholder*/ ctx[14] },
				(!current || dirty[0] & /*name*/ 262144) && { name: /*name*/ ctx[18] },
				(!current || dirty[0] & /*disabled*/ 67108864) && { disabled: /*disabled*/ ctx[26] },
				(!current || dirty[0] & /*required*/ 268435456) && { required: /*required*/ ctx[28] },
				(!current || dirty[0] & /*title*/ 2097152) && { title: /*title*/ ctx[21] },
				(!current || dirty[0] & /*readonly*/ 16777216 | dirty[1] & /*locked*/ 256 && input_1_readonly_value !== (input_1_readonly_value = /*readonly*/ ctx[24] || /*locked*/ ctx[39])) && { readOnly: input_1_readonly_value },
				(!current || dirty[0] & /*tabindex*/ 536870912) && { tabindex: /*tabindex*/ ctx[29] },
				dirty[1] & /*$$restProps*/ 536870912 && /*$$restProps*/ ctx[60]
			]));

			if (dirty[0] & /*text*/ 4 && input_1.value !== /*text*/ ctx[2]) {
				set_input_value(input_1, /*text*/ ctx[2]);
			}

			toggle_class(input_1, "svelte-75ckfb", true);

			if (/*clearable*/ ctx[40]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_8(ctx);
					if_block2.c();
					if_block2.m(div0, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				}
			} else {
				if (if_block3) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block3 = if_blocks[current_block_type_index];

					if (!if_block3) {
						if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block3.c();
					} else {
						if_block3.p(ctx, dirty);
					}

					transition_in(if_block3, 1);
					if_block3.m(div1, null);
				} else {
					if_block3 = null;
				}
			}

			if (!current || dirty[0] & /*dropdownClassName*/ 33554432 | dirty[1] & /*showList*/ 1024 && div1_class_value !== (div1_class_value = "" + ((/*dropdownClassName*/ ctx[25]
			? /*dropdownClassName*/ ctx[25]
			: '') + " autocomplete-list " + (/*showList*/ ctx[41] ? '' : 'hidden') + " is-fullwidth" + " svelte-75ckfb"))) {
				attr(div1, "class", div1_class_value);
			}

			if (!current || dirty[0] & /*className*/ 32768 && div2_class_value !== (div2_class_value = "" + ((/*className*/ ctx[15] ? /*className*/ ctx[15] : '') + " autocomplete select is-fullwidth " + /*uniqueId*/ ctx[42] + " svelte-75ckfb"))) {
				attr(div2, "class", div2_class_value);
			}

			if (!current || dirty[0] & /*className, hideArrow, items*/ 32897) {
				toggle_class(div2, "hide-arrow", /*hideArrow*/ ctx[7] || !/*items*/ ctx[0].length);
			}

			if (!current || dirty[0] & /*className, multiple*/ 32800) {
				toggle_class(div2, "is-multiple", /*multiple*/ ctx[5]);
			}

			if (!current || dirty[0] & /*className*/ 32768 | dirty[1] & /*clearable*/ 512) {
				toggle_class(div2, "show-clear", /*clearable*/ ctx[40]);
			}

			if (!current || dirty[0] & /*className, showLoadingIndicator*/ 33280 | dirty[1] & /*loading*/ 32) {
				toggle_class(div2, "is-loading", /*showLoadingIndicator*/ ctx[9] && /*loading*/ ctx[36]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			transition_in(if_block3);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			transition_out(if_block3);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div2);
			}

			if (if_block0) {
				if_block0.d();
			}

			if (if_block1) if_block1.d();
			/*input_1_binding*/ ctx[104](null);
			if (if_block2) if_block2.d();
			/*div0_binding*/ ctx[109](null);

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d();
			}

			/*div1_binding*/ ctx[114](null);
			mounted = false;
			run_all(dispose);
		}
	};
}

function safeFunction(theFunction, argument) {
	if (typeof theFunction !== "function") {
		console.error("Not a function: " + theFunction + ", argument: " + argument);
		return undefined;
	}

	let result;

	try {
		result = theFunction(argument);
	} catch(error) {
		console.warn("Error executing Autocomplete function on value: " + argument + " function: " + theFunction);
	}

	return result;
}

function safeStringFunction(theFunction, argument) {
	let result = safeFunction(theFunction, argument);

	if (result === undefined || result === null) {
		result = "";
	}

	if (typeof result !== "string") {
		result = result.toString();
	}

	return result;
}

function numberOfMatches(listItem, searchWords) {
	if (!listItem) {
		return 0;
	}

	const itemKeywords = listItem.keywords;
	let matches = 0;

	searchWords.forEach(searchWord => {
		if (itemKeywords.includes(searchWord)) {
			matches++;
		}
	});

	return matches;
}

function defaultItemSortFunction(obj1, obj2, searchWords) {
	return numberOfMatches(obj2, searchWords) - numberOfMatches(obj1, searchWords);
}

function removeAccents(str) {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function instance($$self, $$props, $$invalidate) {
	let showList;
	let hasSelection;
	let clearable;
	let locked;

	const omit_props_names = [
		"items","searchFunction","labelFieldName","keywordsFieldName","valueFieldName","labelFunction","keywordsFunction","valueFunction","keywordsCleanFunction","textCleanFunction","beforeChange","onChange","onFocus","onBlur","onCreate","selectFirstIfEmpty","minCharactersToSearch","maxItemsToShowInList","multiple","create","ignoreAccents","matchAllKeywords","sortByMatchedKeywords","itemFilterFunction","itemSortFunction","lock","delay","localFiltering","localSorting","cleanUserText","lowercaseKeywords","closeOnBlur","orderableSelection","hideArrow","showClear","clearText","showLoadingIndicator","noResultsText","loadingText","moreItemsText","createText","placeholder","className","inputClassName","inputId","name","selectName","selectId","title","html5autocomplete","autocompleteOffValue","readonly","dropdownClassName","disabled","noInputStyles","required","debug","tabindex","selectedItem","value","highlightedItem","text","highlightFilter"
	];

	let $$restProps = compute_rest_props($$props, omit_props_names);
	let { $$slots: slots = {}, $$scope } = $$props;
	let { items = [] } = $$props;
	let { searchFunction = false } = $$props;
	let { labelFieldName = undefined } = $$props;
	let { keywordsFieldName = labelFieldName } = $$props;
	let { valueFieldName = undefined } = $$props;

	let { labelFunction = function (item) {
		if (item === undefined || item === null) {
			return "";
		}

		return labelFieldName ? item[labelFieldName] : item;
	} } = $$props;

	let { keywordsFunction = function (item) {
		if (item === undefined || item === null) {
			return "";
		}

		return keywordsFieldName
		? item[keywordsFieldName]
		: labelFunction(item);
	} } = $$props;

	let { valueFunction = function (item, forceSingle = false) {
		if (item === undefined || item === null) {
			return item;
		}

		if (!multiple || forceSingle) {
			return valueFieldName ? item[valueFieldName] : item;
		} else {
			return item.map(i => valueFieldName ? i[valueFieldName] : i);
		}
	} } = $$props;

	let { keywordsCleanFunction = function (keywords) {
		return keywords;
	} } = $$props;

	let { textCleanFunction = function (userEnteredText) {
		return userEnteredText;
	} } = $$props;

	let { beforeChange = function (oldSelectedItem, newSelectedItem) {
		return true;
	} } = $$props;

	let { onChange = function (newSelectedItem) {
		
	} } = $$props;

	let { onFocus = function () {
		
	} } = $$props;

	let { onBlur = function () {
		
	} } = $$props;

	let { onCreate = function (text) {
		if (debug) {
			console.log("onCreate: " + text);
		}
	} } = $$props;

	let { selectFirstIfEmpty = false } = $$props;
	let { minCharactersToSearch = 1 } = $$props;
	let { maxItemsToShowInList = 0 } = $$props;
	let { multiple = false } = $$props;
	let { create = false } = $$props;
	let { ignoreAccents = true } = $$props;
	let { matchAllKeywords = true } = $$props;
	let { sortByMatchedKeywords = false } = $$props;
	let { itemFilterFunction = undefined } = $$props;
	let { itemSortFunction = undefined } = $$props;
	let { lock = false } = $$props;
	let { delay = 0 } = $$props;
	let { localFiltering = true } = $$props;
	let { localSorting = true } = $$props;
	let { cleanUserText = true } = $$props;
	let { lowercaseKeywords = true } = $$props;
	let { closeOnBlur = false } = $$props;
	let { orderableSelection = false } = $$props;
	let { hideArrow = false } = $$props;
	let { showClear = false } = $$props;
	let { clearText = "&#10006;" } = $$props;
	let { showLoadingIndicator = false } = $$props;
	let { noResultsText = "No results found" } = $$props;
	let { loadingText = "Loading results..." } = $$props;
	let { moreItemsText = "items not shown" } = $$props;
	let { createText = "Not found, add anyway?" } = $$props;
	let { placeholder = undefined } = $$props;
	let { className = undefined } = $$props;
	let { inputClassName = undefined } = $$props;
	let { inputId = undefined } = $$props;
	let { name = undefined } = $$props;
	let { selectName = undefined } = $$props;
	let { selectId = undefined } = $$props;
	let { title = undefined } = $$props;
	let { html5autocomplete = undefined } = $$props;
	let { autocompleteOffValue = "off" } = $$props;
	let { readonly = undefined } = $$props;
	let { dropdownClassName = undefined } = $$props;
	let { disabled = false } = $$props;
	let { noInputStyles = false } = $$props;
	let { required = null } = $$props;
	let { debug = false } = $$props;
	let { tabindex = 0 } = $$props;
	let { selectedItem = multiple ? [] : undefined } = $$props;
	let { value = undefined } = $$props;
	let { highlightedItem = undefined } = $$props;

	// --- Internal State ----
	const uniqueId = "sautocomplete-" + Math.floor(Math.random() * 1000);

	// HTML elements
	let input;

	let list;
	let inputContainer;

	// UI state
	let opened = false;

	let loading = false;
	let highlightIndex = -1;
	let { text = undefined } = $$props;
	let filteredTextLength = 0;

	// view model
	let filteredListItems;

	let listItems = [];

	// requests/responses counters
	let lastRequestId = 0;

	let lastResponseId = 0;

	// other state
	let inputDelayTimeout;

	let setPositionOnNextUpdate = false;

	// --- Lifecycle events ---
	afterUpdate(() => {
		if (setPositionOnNextUpdate) {
			setScrollAwareListPosition();
		}

		$$invalidate(37, setPositionOnNextUpdate = false);
	});

	function safeLabelFunction(item) {
		// console.log("labelFunction: " + labelFunction);
		// console.log("safeLabelFunction, item: " + item);
		return safeStringFunction(labelFunction, item);
	}

	function safeKeywordsFunction(item) {
		// console.log("safeKeywordsFunction");
		const keywords = safeStringFunction(keywordsFunction, item);

		let result = safeStringFunction(keywordsCleanFunction, keywords);
		result = lowercaseKeywords ? result.toLowerCase().trim() : result;

		if (ignoreAccents) {
			result = removeAccents(result);
		}

		if (debug) {
			console.log("Extracted keywords: '" + result + "' from item: " + JSON.stringify(item));
		}

		return result;
	}

	function prepareListItems() {
		let timerId;

		if (debug) {
			timerId = `Autocomplete prepare list ${inputId ? `(id: ${inputId})` : ""}`;
			console.time(timerId);
			console.log("Prepare items to search");
			console.log("items: " + JSON.stringify(items));
		}

		if (!Array.isArray(items)) {
			console.warn("Autocomplete items / search function did not return array but", items);
			$$invalidate(0, items = []);
		}

		const length = items ? items.length : 0;
		listItems = new Array(length);

		if (length > 0) {
			items.forEach((item, i) => {
				const listItem = getListItem(item);

				if (listItem === undefined) {
					console.log("Undefined item for: ", item);
				}

				listItems[i] = listItem;
			});
		}

		$$invalidate(31, filteredListItems = listItems);

		if (debug) {
			console.log(listItems.length + " items to search");
			console.timeEnd(timerId);
		}
	}

	function getListItem(item) {
		return {
			// keywords representation of the item
			keywords: localFiltering ? safeKeywordsFunction(item) : [],
			// item label
			label: safeLabelFunction(item),
			// store reference to the origial item
			item
		};
	}

	function onSelectedItemChanged() {
		$$invalidate(61, value = valueFunction(selectedItem));

		if (selectedItem && !multiple) {
			$$invalidate(2, text = safeLabelFunction(selectedItem));
		}

		$$invalidate(31, filteredListItems = listItems);
		onChange(selectedItem);
	}

	function prepareUserEnteredText(userEnteredText) {
		if (userEnteredText === undefined || userEnteredText === null) {
			return "";
		}

		if (!cleanUserText) {
			return userEnteredText;
		}

		const textFiltered = userEnteredText.replace(/[&/\\#,+()$~%.'":*?<>{}]/g, " ").trim();
		const cleanUserEnteredText = safeStringFunction(textCleanFunction, textFiltered);

		const textTrimmed = lowercaseKeywords
		? cleanUserEnteredText.toLowerCase().trim()
		: cleanUserEnteredText.trim();

		return textTrimmed;
	}

	async function search() {
		let timerId;

		if (debug) {
			timerId = `Autocomplete search ${inputId ? `(id: ${inputId})` : ""}`;
			console.time(timerId);
			console.log("Searching user entered text: '" + text + "'");
		}

		let textFiltered = prepareUserEnteredText(text);

		if (minCharactersToSearch > 1 && textFiltered.length < minCharactersToSearch) {
			textFiltered = "";
		}

		$$invalidate(95, filteredTextLength = textFiltered.length);

		if (debug) {
			console.log("Changed user entered text '" + text + "' into '" + textFiltered + "'");
		}

		// if no search text load all items
		if (textFiltered === "") {
			if (searchFunction) {
				// we will need to rerun the search
				$$invalidate(0, items = []);

				if (debug) {
					console.log("User entered text is empty clear list of items");
				}
			} else {
				$$invalidate(31, filteredListItems = listItems);

				if (debug) {
					console.log("User entered text is empty set the list of items to all items");
				}
			}

			if (closeIfMinCharsToSearchReached()) {
				if (debug) {
					console.timeEnd(timerId);
				}

				return;
			}
		}

		if (!searchFunction) {
			// internal search
			processListItems(textFiltered);
		} else {
			// external search which provides items
			lastRequestId = lastRequestId + 1;

			const currentRequestId = lastRequestId;
			$$invalidate(36, loading = true);

			// searchFunction is a generator
			if (searchFunction.constructor.name === "AsyncGeneratorFunction") {
				for await (const chunk of searchFunction(textFiltered, maxItemsToShowInList)) {
					// a chunk of an old response: throw it away
					if (currentRequestId < lastResponseId) {
						return false;
					}

					// a chunk for a new response: reset the item list
					if (currentRequestId > lastResponseId) {
						$$invalidate(0, items = []);
					}

					lastResponseId = currentRequestId;
					$$invalidate(0, items = [...items, ...chunk]);
					processListItems(textFiltered);
				}

				// there was nothing in the chunk
				if (lastResponseId < currentRequestId) {
					lastResponseId = currentRequestId;
					$$invalidate(0, items = []);
					processListItems(textFiltered);
				}
			} else // searchFunction is a regular function
			{
				let result = await searchFunction(textFiltered, maxItemsToShowInList);

				// If a response to a newer request has been received
				// while responses to this request were being loaded,
				// then we can just throw away this outdated results.
				if (currentRequestId < lastResponseId) {
					return false;
				}

				lastResponseId = currentRequestId;
				$$invalidate(0, items = result);
				processListItems(textFiltered);
			}

			$$invalidate(36, loading = false);
		}

		if (debug) {
			console.timeEnd(timerId);
			console.log("Search found " + filteredListItems.length + " items");
		}
	}

	function defaultItemFilterFunction(listItem, searchWords) {
		const matches = numberOfMatches(listItem, searchWords);

		if (matchAllKeywords) {
			return matches >= searchWords.length;
		} else {
			return matches > 0;
		}
	}

	function processListItems(textFiltered) {
		// cleans, filters, orders, and highlights the list items
		prepareListItems();

		const textFilteredWithoutAccents = ignoreAccents
		? removeAccents(textFiltered)
		: textFiltered;

		const searchWords = textFilteredWithoutAccents.split(/\s+/g).filter(word => word !== "");

		// local search
		let tempfilteredListItems;

		if (localFiltering) {
			if (itemFilterFunction) {
				tempfilteredListItems = listItems.filter(item => itemFilterFunction(item.item, searchWords));
			} else {
				tempfilteredListItems = listItems.filter(item => defaultItemFilterFunction(item, searchWords));
			}

			if (localSorting) {
				if (itemSortFunction) {
					tempfilteredListItems = tempfilteredListItems.sort((item1, item2) => itemSortFunction(item1.item, item2.item, searchWords));
				} else {
					if (sortByMatchedKeywords) {
						tempfilteredListItems = tempfilteredListItems.sort((item1, item2) => defaultItemSortFunction(item1, item2, searchWords));
					}
				}
			}
		} else {
			tempfilteredListItems = listItems;
		}

		const hlfilter = highlightFilter(searchWords, "label");
		$$invalidate(31, filteredListItems = tempfilteredListItems.map(hlfilter));
		closeIfMinCharsToSearchReached();
		return true;
	}

	// $: text, search();
	function afterCreate(createdItem) {
		let listItem;

		if (debug) {
			console.log("createdItem", createdItem);
		}

		if ("undefined" !== typeof createdItem) {
			prepareListItems();
			$$invalidate(31, filteredListItems = listItems);
			let index = findItemIndex(createdItem, filteredListItems);

			// if the items array was not updated, add the created item manually
			if (index <= 0) {
				$$invalidate(0, items = [createdItem]);
				prepareListItems();
				$$invalidate(31, filteredListItems = listItems);
				index = 0;
			}

			if (index >= 0) {
				$$invalidate(30, highlightIndex = index);
				listItem = filteredListItems[highlightIndex];
			}
		}

		return listItem;
	}

	function selectListItem(listItem) {
		if (debug) {
			console.log("selectListItem", listItem);
		}

		if ("undefined" === typeof listItem && create) {
			// allow undefined items if create is enabled
			const createdItem = onCreate(text);

			if ("undefined" !== typeof createdItem) {
				if (typeof createdItem.then === "function") {
					createdItem.then(newItem => {
						if ("undefined" !== typeof newItem) {
							const newListItem = afterCreate(newItem);

							if ("undefined" !== typeof newListItem) {
								selectListItem(newListItem);
							}
						}
					});

					return true;
				} else {
					listItem = afterCreate(createdItem);
				}
			}
		}

		if ("undefined" === typeof listItem) {
			if (debug) {
				console.log(`listItem is undefined. Can not select.`);
			}

			return false;
		}

		if (locked) {
			return true;
		}

		const newSelectedItem = listItem.item;

		if (beforeChange(selectedItem, newSelectedItem)) {
			// simple selection
			if (!multiple) {
				$$invalidate(1, selectedItem = undefined); // triggers change even if the the same item is selected
				$$invalidate(1, selectedItem = newSelectedItem);
			} else // first selection of multiple ones
			if (!selectedItem) {
				$$invalidate(1, selectedItem = [newSelectedItem]);
			} else // selecting something already selected => unselect it
			if (selectedItem.includes(newSelectedItem)) {
				$$invalidate(1, selectedItem = selectedItem.filter(i => i !== newSelectedItem));
			} else // adds the element to the selection
			{
				$$invalidate(1, selectedItem = [...selectedItem, newSelectedItem]);
			}
		}

		return true;
	}

	function selectItem() {
		if (debug) {
			console.log("selectItem", highlightIndex);
		}

		const listItem = filteredListItems[highlightIndex];

		if (selectListItem(listItem)) {
			if (debug) {
				console.log("selectListItem true, closing");
			}

			close();

			if (multiple) {
				$$invalidate(2, text = "");
				input.focus();
			}
		} else {
			if (debug) {
				console.log("selectListItem false, not closing");
			}
		}
	}

	function up() {
		if (debug) {
			console.log("up");
		}

		open();

		if (highlightIndex > 0) {
			$$invalidate(30, highlightIndex--, highlightIndex);
		}

		highlight();
	}

	function down() {
		if (debug) {
			console.log("down");
		}

		open();

		if (highlightIndex < filteredListItems.length - 1) {
			$$invalidate(30, highlightIndex++, highlightIndex);
		}

		highlight();
	}

	function highlight() {
		if (debug) {
			console.log("highlight");
		}

		const query = ".selected";

		if (debug) {
			console.log("Seaching DOM element: " + query + " in " + list);
		}

		/**
 * @param {Element} el
 */
		const el = list && list.querySelector(query);

		if (el) {
			if (typeof el.scrollIntoViewIfNeeded === "function") {
				if (debug) {
					console.log("Scrolling selected item into view");
				}

				el.scrollIntoViewIfNeeded();
			} else if (el.scrollIntoView === "function") {
				if (debug) {
					console.log("Scrolling selected item into view");
				}

				el.scrollIntoView();
			} else {
				if (debug) {
					console.warn("Could not scroll selected item into view, scrollIntoViewIfNeeded not supported");
				}
			}
		} else {
			if (debug) {
				console.warn("Selected item not found to scroll into view");
			}
		}
	}

	function onListItemClick(listItem) {
		if (debug) {
			console.log("onListItemClick");
		}

		if (selectListItem(listItem)) {
			close();

			if (multiple) {
				$$invalidate(2, text = "");
				input.focus();
			}
		}
	}

	function onDocumentClick(e) {
		if (debug) {
			console.log("onDocumentClick");
		}

		if (e.composedPath().some(path => path.classList && path.classList.contains(uniqueId))) {
			if (debug) {
				console.log("onDocumentClick inside");
			}

			// resetListToAllItemsAndOpen();
			highlight();
		} else {
			if (debug) {
				console.log("onDocumentClick outside");
			}

			close();
		}
	}

	function onKeyDown(e) {
		if (debug) {
			console.log("onKeyDown");
		}

		let key = e.key;
		if (key === "Tab" && e.shiftKey) key = "ShiftTab";

		const fnmap = {
			Tab: opened ? close : null,
			ShiftTab: opened ? close : null,
			ArrowDown: down.bind(this),
			ArrowUp: up.bind(this),
			Escape: onEsc.bind(this),
			Backspace: multiple && hasSelection && !text
			? onBackspace.bind(this)
			: null
		};

		const fn = fnmap[key];

		if (typeof fn === "function") {
			fn(e);
		}
	}

	function onKeyPress(e) {
		if (debug) {
			console.log("onKeyPress");
		}

		if (e.key === "Enter") {
			onEnter(e);
		}
	}

	function onEnter(e) {
		if (opened) {
			e.preventDefault();
			selectItem();
		}
	}

	function onInput(e) {
		if (debug) {
			console.log("onInput");
		}

		$$invalidate(2, text = e.target.value);

		if (inputDelayTimeout) {
			clearTimeout(inputDelayTimeout);
		}

		if (delay) {
			inputDelayTimeout = setTimeout(processInput, delay);
		} else {
			processInput();
		}
	}

	function unselectItem(tag) {
		if (debug) {
			console.log("unselectItem", tag);
		}

		$$invalidate(1, selectedItem = selectedItem.filter(i => i !== tag));
		input.focus();
	}

	function processInput() {
		if (search()) {
			$$invalidate(30, highlightIndex = 0);
			open();
		}
	}

	function onInputClick() {
		if (debug) {
			console.log("onInputClick");
		}

		resetListToAllItemsAndOpen();
	}

	function onEsc(e) {
		if (debug) {
			console.log("onEsc");
		}

		//if (text) return clear();
		e.stopPropagation();

		if (opened) {
			input.focus();
			close();
		}
	}

	function onBackspace(e) {
		if (debug) {
			console.log("onBackspace");
		}

		unselectItem(selectedItem[selectedItem.length - 1]);
	}

	function onFocusInternal() {
		if (debug) {
			console.log("onFocus");
		}

		onFocus();
		resetListToAllItemsAndOpen();
	}

	function onBlurInternal() {
		if (debug) {
			console.log("onBlur");
		}

		if (closeOnBlur) {
			close();
		}

		onBlur();
	}

	function resetListToAllItemsAndOpen() {
		if (debug) {
			console.log("resetListToAllItemsAndOpen");
		}

		if (searchFunction && !listItems.length) {
			search();
		} else if (!text) {
			$$invalidate(31, filteredListItems = listItems);
		}

		open();

		// find selected item
		if (selectedItem) {
			if (debug) {
				console.log("Searching currently selected item: " + JSON.stringify(selectedItem));
			}

			const index = findItemIndex(selectedItem, filteredListItems);

			if (index >= 0) {
				$$invalidate(30, highlightIndex = index);
				highlight();
			}
		}
	}

	function findItemIndex(item, items) {
		if (debug) {
			console.log("Finding index for item", item);
		}

		let index = -1;

		for (let i = 0; i < items.length; i++) {
			const listItem = items[i];

			if ("undefined" === typeof listItem) {
				if (debug) {
					console.log(`listItem ${i} is undefined. Skipping.`);
				}

				continue;
			}

			if (debug) {
				console.log("Item " + i + ": " + JSON.stringify(listItem));
			}

			if (item === listItem.item) {
				index = i;
				break;
			}
		}

		if (debug) {
			if (index >= 0) {
				console.log("Found index for item: " + index);
			} else {
				console.warn("Not found index for item: " + item);
			}
		}

		return index;
	}

	function open() {
		if (debug) {
			console.log("open");
		}

		// check if the search text has more than the min chars required
		if (locked || notEnoughSearchText()) {
			return;
		}

		$$invalidate(37, setPositionOnNextUpdate = true);
		$$invalidate(94, opened = true);
	}

	function close() {
		if (debug) {
			console.log("close");
		}

		$$invalidate(94, opened = false);
		$$invalidate(36, loading = false);

		if (!text && selectFirstIfEmpty) {
			$$invalidate(30, highlightIndex = 0);
			selectItem();
		}
	}

	function notEnoughSearchText() {
		return minCharactersToSearch > 0 && filteredTextLength < minCharactersToSearch && (// When no searchFunction is defined, the menu should always open when the input is focused
		searchFunction || filteredTextLength > 0);
	}

	function closeIfMinCharsToSearchReached() {
		if (notEnoughSearchText()) {
			close();
			return true;
		}

		return false;
	}

	function clear() {
		if (debug) {
			console.log("clear");
		}

		$$invalidate(2, text = "");
		$$invalidate(1, selectedItem = multiple ? [] : undefined);

		setTimeout(() => {
			input.focus();
		});
	}

	function highlightFilter(keywords, field) {
		return item => {
			let label = item[field];
			const newItem = Object.assign({ highlighted: undefined }, item);
			newItem.highlighted = label;
			const labelLowercase = label.toLowerCase();

			const labelLowercaseNoAc = ignoreAccents
			? removeAccents(labelLowercase)
			: labelLowercase;

			if (keywords && keywords.length) {
				const positions = [];

				for (let i = 0; i < keywords.length; i++) {
					let keyword = keywords[i];

					if (ignoreAccents) {
						keyword = removeAccents(keyword);
					}

					const keywordLen = keyword.length;
					let pos1 = 0;

					do {
						pos1 = labelLowercaseNoAc.indexOf(keyword, pos1);

						if (pos1 >= 0) {
							let pos2 = pos1 + keywordLen;
							positions.push([pos1, pos2]);
							pos1 = pos2;
						}
					} while (pos1 !== -1);
				}

				if (positions.length > 0) {
					const keywordPatterns = new Set();

					for (let i = 0; i < positions.length; i++) {
						const pair = positions[i];
						const pos1 = pair[0];
						const pos2 = pair[1];
						const keywordPattern = labelLowercase.substring(pos1, pos2);
						keywordPatterns.add(keywordPattern);
					}

					for (let keywordPattern of keywordPatterns) {
						// FIXME pst: workarond for wrong replacement <b> tags
						if (keywordPattern === "b") {
							continue;
						}

						const reg = new RegExp("(" + keywordPattern + ")", "ig");
						const newHighlighted = newItem.highlighted.replace(reg, "<b>$1</b>");
						newItem.highlighted = newHighlighted;
					}
				}
			}

			return newItem;
		};
	}

	function isConfirmed(listItem) {
		if (!selectedItem) {
			return false;
		}

		if (multiple) {
			return selectedItem.includes(listItem);
		} else {
			return listItem === selectedItem;
		}
	}

	let draggingOver = false;

	function dragstart(event, index) {
		if (orderableSelection) {
			event.dataTransfer.setData("source", index);
		}
	}

	function dragover(event, index) {
		if (orderableSelection) {
			event.preventDefault();
			$$invalidate(38, draggingOver = index);
		}
	}

	function dragleave(event, index) {
		if (orderableSelection) {
			$$invalidate(38, draggingOver = false);
		}
	}

	function drop(event, index) {
		if (orderableSelection) {
			event.preventDefault();
			$$invalidate(38, draggingOver = false);
			let from = parseInt(event.dataTransfer.getData("source"));
			let to = index;

			if (from != to) {
				moveSelectedItem(from, to);
			}
		}
	}

	function moveSelectedItem(from, to) {
		let newSelection = [...selectedItem];

		if (from < to) {
			newSelection.splice(to + 1, 0, newSelection[from]);
			newSelection.splice(from, 1);
		} else {
			newSelection.splice(to, 0, newSelection[from]);
			newSelection.splice(from + 1, 1);
		}

		$$invalidate(1, selectedItem = newSelection);
	}

	function setScrollAwareListPosition() {
		const { height: viewPortHeight } = window.visualViewport;
		const { bottom: inputButtom, height: inputHeight } = inputContainer.getBoundingClientRect();
		const { height: listHeight } = list.getBoundingClientRect();

		if (inputButtom + listHeight > viewPortHeight) {
			$$invalidate(34, list.style.top = `-${inputHeight + listHeight}px`, list);
		} else {
			$$invalidate(34, list.style.top = "0px", list);
		}
	}

	const scroll_handler = () => $$invalidate(37, setPositionOnNextUpdate = true);

	const keypress_handler = (tagItem, e) => {
		e.key == "Enter" && unselectItem(tagItem);
	};

	const dragstart_handler = (i, event) => dragstart(event, i);
	const dragover_handler = (i, event) => dragover(event, i);
	const dragleave_handler = (i, event) => dragleave();
	const drop_handler = (i, event) => drop(event, i);

	function input_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			input = $$value;
			$$invalidate(33, input);
		});
	}

	function input_1_input_handler() {
		text = this.value;
		$$invalidate(2, text);
	}

	const dragover_handler_1 = event => dragover(event, selectedItem.length - 1);
	const drop_handler_1 = event => drop(event, selectedItem.length - 1);

	const keypress_handler_1 = e => {
		e.key == "Enter" && clear();
	};

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			inputContainer = $$value;
			$$invalidate(35, inputContainer);
		});
	}

	const click_handler = listItem => onListItemClick(listItem);

	const keypress_handler_2 = (listItem, e) => {
		e.key == "Enter" && onListItemClick(listItem);
	};

	const pointerenter_handler = i => {
		$$invalidate(30, highlightIndex = i);
	};

	const keypress_handler_3 = e => {
		e.key == "Enter" && selectItem();
	};

	function div1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			list = $$value;
			$$invalidate(34, list);
		});
	}

	$$self.$$set = $$new_props => {
		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
		$$invalidate(60, $$restProps = compute_rest_props($$props, omit_props_names));
		if ('items' in $$new_props) $$invalidate(0, items = $$new_props.items);
		if ('searchFunction' in $$new_props) $$invalidate(63, searchFunction = $$new_props.searchFunction);
		if ('labelFieldName' in $$new_props) $$invalidate(64, labelFieldName = $$new_props.labelFieldName);
		if ('keywordsFieldName' in $$new_props) $$invalidate(65, keywordsFieldName = $$new_props.keywordsFieldName);
		if ('valueFieldName' in $$new_props) $$invalidate(66, valueFieldName = $$new_props.valueFieldName);
		if ('labelFunction' in $$new_props) $$invalidate(67, labelFunction = $$new_props.labelFunction);
		if ('keywordsFunction' in $$new_props) $$invalidate(68, keywordsFunction = $$new_props.keywordsFunction);
		if ('valueFunction' in $$new_props) $$invalidate(3, valueFunction = $$new_props.valueFunction);
		if ('keywordsCleanFunction' in $$new_props) $$invalidate(69, keywordsCleanFunction = $$new_props.keywordsCleanFunction);
		if ('textCleanFunction' in $$new_props) $$invalidate(70, textCleanFunction = $$new_props.textCleanFunction);
		if ('beforeChange' in $$new_props) $$invalidate(71, beforeChange = $$new_props.beforeChange);
		if ('onChange' in $$new_props) $$invalidate(72, onChange = $$new_props.onChange);
		if ('onFocus' in $$new_props) $$invalidate(73, onFocus = $$new_props.onFocus);
		if ('onBlur' in $$new_props) $$invalidate(74, onBlur = $$new_props.onBlur);
		if ('onCreate' in $$new_props) $$invalidate(75, onCreate = $$new_props.onCreate);
		if ('selectFirstIfEmpty' in $$new_props) $$invalidate(76, selectFirstIfEmpty = $$new_props.selectFirstIfEmpty);
		if ('minCharactersToSearch' in $$new_props) $$invalidate(77, minCharactersToSearch = $$new_props.minCharactersToSearch);
		if ('maxItemsToShowInList' in $$new_props) $$invalidate(4, maxItemsToShowInList = $$new_props.maxItemsToShowInList);
		if ('multiple' in $$new_props) $$invalidate(5, multiple = $$new_props.multiple);
		if ('create' in $$new_props) $$invalidate(6, create = $$new_props.create);
		if ('ignoreAccents' in $$new_props) $$invalidate(78, ignoreAccents = $$new_props.ignoreAccents);
		if ('matchAllKeywords' in $$new_props) $$invalidate(79, matchAllKeywords = $$new_props.matchAllKeywords);
		if ('sortByMatchedKeywords' in $$new_props) $$invalidate(80, sortByMatchedKeywords = $$new_props.sortByMatchedKeywords);
		if ('itemFilterFunction' in $$new_props) $$invalidate(81, itemFilterFunction = $$new_props.itemFilterFunction);
		if ('itemSortFunction' in $$new_props) $$invalidate(82, itemSortFunction = $$new_props.itemSortFunction);
		if ('lock' in $$new_props) $$invalidate(83, lock = $$new_props.lock);
		if ('delay' in $$new_props) $$invalidate(84, delay = $$new_props.delay);
		if ('localFiltering' in $$new_props) $$invalidate(85, localFiltering = $$new_props.localFiltering);
		if ('localSorting' in $$new_props) $$invalidate(86, localSorting = $$new_props.localSorting);
		if ('cleanUserText' in $$new_props) $$invalidate(87, cleanUserText = $$new_props.cleanUserText);
		if ('lowercaseKeywords' in $$new_props) $$invalidate(88, lowercaseKeywords = $$new_props.lowercaseKeywords);
		if ('closeOnBlur' in $$new_props) $$invalidate(89, closeOnBlur = $$new_props.closeOnBlur);
		if ('orderableSelection' in $$new_props) $$invalidate(90, orderableSelection = $$new_props.orderableSelection);
		if ('hideArrow' in $$new_props) $$invalidate(7, hideArrow = $$new_props.hideArrow);
		if ('showClear' in $$new_props) $$invalidate(91, showClear = $$new_props.showClear);
		if ('clearText' in $$new_props) $$invalidate(8, clearText = $$new_props.clearText);
		if ('showLoadingIndicator' in $$new_props) $$invalidate(9, showLoadingIndicator = $$new_props.showLoadingIndicator);
		if ('noResultsText' in $$new_props) $$invalidate(10, noResultsText = $$new_props.noResultsText);
		if ('loadingText' in $$new_props) $$invalidate(11, loadingText = $$new_props.loadingText);
		if ('moreItemsText' in $$new_props) $$invalidate(12, moreItemsText = $$new_props.moreItemsText);
		if ('createText' in $$new_props) $$invalidate(13, createText = $$new_props.createText);
		if ('placeholder' in $$new_props) $$invalidate(14, placeholder = $$new_props.placeholder);
		if ('className' in $$new_props) $$invalidate(15, className = $$new_props.className);
		if ('inputClassName' in $$new_props) $$invalidate(16, inputClassName = $$new_props.inputClassName);
		if ('inputId' in $$new_props) $$invalidate(17, inputId = $$new_props.inputId);
		if ('name' in $$new_props) $$invalidate(18, name = $$new_props.name);
		if ('selectName' in $$new_props) $$invalidate(19, selectName = $$new_props.selectName);
		if ('selectId' in $$new_props) $$invalidate(20, selectId = $$new_props.selectId);
		if ('title' in $$new_props) $$invalidate(21, title = $$new_props.title);
		if ('html5autocomplete' in $$new_props) $$invalidate(22, html5autocomplete = $$new_props.html5autocomplete);
		if ('autocompleteOffValue' in $$new_props) $$invalidate(23, autocompleteOffValue = $$new_props.autocompleteOffValue);
		if ('readonly' in $$new_props) $$invalidate(24, readonly = $$new_props.readonly);
		if ('dropdownClassName' in $$new_props) $$invalidate(25, dropdownClassName = $$new_props.dropdownClassName);
		if ('disabled' in $$new_props) $$invalidate(26, disabled = $$new_props.disabled);
		if ('noInputStyles' in $$new_props) $$invalidate(27, noInputStyles = $$new_props.noInputStyles);
		if ('required' in $$new_props) $$invalidate(28, required = $$new_props.required);
		if ('debug' in $$new_props) $$invalidate(92, debug = $$new_props.debug);
		if ('tabindex' in $$new_props) $$invalidate(29, tabindex = $$new_props.tabindex);
		if ('selectedItem' in $$new_props) $$invalidate(1, selectedItem = $$new_props.selectedItem);
		if ('value' in $$new_props) $$invalidate(61, value = $$new_props.value);
		if ('highlightedItem' in $$new_props) $$invalidate(62, highlightedItem = $$new_props.highlightedItem);
		if ('text' in $$new_props) $$invalidate(2, text = $$new_props.text);
		if ('$$scope' in $$new_props) $$invalidate(96, $$scope = $$new_props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*items*/ 1 | $$self.$$.dirty[2] & /*searchFunction*/ 2) {
			// -- Reactivity --
			(searchFunction || prepareListItems());
		}

		if ($$self.$$.dirty[0] & /*selectedItem*/ 2) {
			(onSelectedItemChanged());
		}

		if ($$self.$$.dirty[0] & /*highlightIndex*/ 1073741824 | $$self.$$.dirty[1] & /*filteredListItems*/ 1) {
			$$invalidate(62, highlightedItem = filteredListItems && highlightIndex && highlightIndex >= 0 && highlightIndex < filteredListItems.length
			? filteredListItems[highlightIndex].item
			: null);
		}

		if ($$self.$$.dirty[0] & /*items*/ 1 | $$self.$$.dirty[3] & /*opened, filteredTextLength*/ 6) {
			$$invalidate(41, showList = opened && (items && items.length > 0 || filteredTextLength > 0));
		}

		if ($$self.$$.dirty[0] & /*multiple, selectedItem*/ 34) {
			$$invalidate(32, hasSelection = multiple && selectedItem && selectedItem.length > 0 || !multiple && selectedItem);
		}

		if ($$self.$$.dirty[0] & /*multiple*/ 32 | $$self.$$.dirty[1] & /*hasSelection*/ 2 | $$self.$$.dirty[2] & /*showClear, lock*/ 538968064) {
			$$invalidate(40, clearable = showClear || (lock || multiple) && hasSelection);
		}

		if ($$self.$$.dirty[1] & /*hasSelection*/ 2 | $$self.$$.dirty[2] & /*lock*/ 2097152) {
			$$invalidate(39, locked = lock && hasSelection);
		}
	};

	return [
		items,
		selectedItem,
		text,
		valueFunction,
		maxItemsToShowInList,
		multiple,
		create,
		hideArrow,
		clearText,
		showLoadingIndicator,
		noResultsText,
		loadingText,
		moreItemsText,
		createText,
		placeholder,
		className,
		inputClassName,
		inputId,
		name,
		selectName,
		selectId,
		title,
		html5autocomplete,
		autocompleteOffValue,
		readonly,
		dropdownClassName,
		disabled,
		noInputStyles,
		required,
		tabindex,
		highlightIndex,
		filteredListItems,
		hasSelection,
		input,
		list,
		inputContainer,
		loading,
		setPositionOnNextUpdate,
		draggingOver,
		locked,
		clearable,
		showList,
		uniqueId,
		safeLabelFunction,
		selectItem,
		onListItemClick,
		onDocumentClick,
		onKeyDown,
		onKeyPress,
		onInput,
		unselectItem,
		onInputClick,
		onFocusInternal,
		onBlurInternal,
		clear,
		isConfirmed,
		dragstart,
		dragover,
		dragleave,
		drop,
		$$restProps,
		value,
		highlightedItem,
		searchFunction,
		labelFieldName,
		keywordsFieldName,
		valueFieldName,
		labelFunction,
		keywordsFunction,
		keywordsCleanFunction,
		textCleanFunction,
		beforeChange,
		onChange,
		onFocus,
		onBlur,
		onCreate,
		selectFirstIfEmpty,
		minCharactersToSearch,
		ignoreAccents,
		matchAllKeywords,
		sortByMatchedKeywords,
		itemFilterFunction,
		itemSortFunction,
		lock,
		delay,
		localFiltering,
		localSorting,
		cleanUserText,
		lowercaseKeywords,
		closeOnBlur,
		orderableSelection,
		showClear,
		debug,
		highlightFilter,
		opened,
		filteredTextLength,
		$$scope,
		slots,
		scroll_handler,
		keypress_handler,
		dragstart_handler,
		dragover_handler,
		dragleave_handler,
		drop_handler,
		input_1_binding,
		input_1_input_handler,
		dragover_handler_1,
		drop_handler_1,
		keypress_handler_1,
		div0_binding,
		click_handler,
		keypress_handler_2,
		pointerenter_handler,
		keypress_handler_3,
		div1_binding
	];
}

class SimpleAutocomplete extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				items: 0,
				searchFunction: 63,
				labelFieldName: 64,
				keywordsFieldName: 65,
				valueFieldName: 66,
				labelFunction: 67,
				keywordsFunction: 68,
				valueFunction: 3,
				keywordsCleanFunction: 69,
				textCleanFunction: 70,
				beforeChange: 71,
				onChange: 72,
				onFocus: 73,
				onBlur: 74,
				onCreate: 75,
				selectFirstIfEmpty: 76,
				minCharactersToSearch: 77,
				maxItemsToShowInList: 4,
				multiple: 5,
				create: 6,
				ignoreAccents: 78,
				matchAllKeywords: 79,
				sortByMatchedKeywords: 80,
				itemFilterFunction: 81,
				itemSortFunction: 82,
				lock: 83,
				delay: 84,
				localFiltering: 85,
				localSorting: 86,
				cleanUserText: 87,
				lowercaseKeywords: 88,
				closeOnBlur: 89,
				orderableSelection: 90,
				hideArrow: 7,
				showClear: 91,
				clearText: 8,
				showLoadingIndicator: 9,
				noResultsText: 10,
				loadingText: 11,
				moreItemsText: 12,
				createText: 13,
				placeholder: 14,
				className: 15,
				inputClassName: 16,
				inputId: 17,
				name: 18,
				selectName: 19,
				selectId: 20,
				title: 21,
				html5autocomplete: 22,
				autocompleteOffValue: 23,
				readonly: 24,
				dropdownClassName: 25,
				disabled: 26,
				noInputStyles: 27,
				required: 28,
				debug: 92,
				tabindex: 29,
				selectedItem: 1,
				value: 61,
				highlightedItem: 62,
				text: 2,
				highlightFilter: 93
			},
			add_css,
			[-1, -1, -1, -1, -1]
		);
	}

	get highlightFilter() {
		return this.$$.ctx[93];
	}
}

const newSimpleAutocomplete = (target, props) => {
    return new SimpleAutocomplete({ 
        target: target, 
        props: props
    });
};

export { newSimpleAutocomplete };
//# sourceMappingURL=main.js.map
