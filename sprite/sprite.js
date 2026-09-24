'use strict';

/* =============================================================================
 * sprite.js — dependency-free sprite sheet + sprite runtime for <canvas>.
 *
 *   const sheet  = await SpriteSheet.load('hero.json');
 *   const hero   = sheet.newSprite();
 *   hero.setPosition(100, 100);
 *   hero.play('run');
 *
 *   function frame(now) {
 *     hero.update(now - last); last = now;
 *     ctx.clearRect(0, 0, canvas.width, canvas.height);
 *     hero.draw(ctx);
 *     requestAnimationFrame(frame);
 *   }
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} Vec2
 * @property {number} x
 * @property {number} y
 */

/**
 * A rectangular region of the sheet's image.
 * `x`/`y` are pixel offsets into the image; `centerx`/`centery` are the
 * sprite's origin (the point that lands on `position`).
 *
 * @typedef {Object} Frame
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} centerx
 * @property {number} centery
 * @property {Vec2}  [drawOffset]
 */

/**
 * @typedef {Object} Sequence
 * @property {string}   name
 * @property {string[]} frames       Frame names, in play order.
 * @property {number}   frameRate    Frames per second.
 * @property {number}   [iterations] 0/undefined = loop forever, n = play n times.
 * @property {'auto'|'manual'} [method]
 * @property {number[]} [frameTimes] Per-frame durations in ms; overrides frameRate.
 * @property {Function} [callback]   Invoked when a finite sequence completes.
 */

/**
 * @typedef {Object} CollisionCircle
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {number} radius
 */

/**
 * @typedef {Object} CollisionShape
 * @property {CollisionCircle[]} circles
 */

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** @returns {number} the fractional part of `v`. */
const fract = (v) => v - Math.floor(v);

/** Shallow copy of `obj` with keys trimmed + lower-cased. */
function lowerKeyMap(obj) {
	const out = Object.create(null);
	for (const key of Object.keys(obj)) out[key.trim().toLowerCase()] = obj[key];
	return out;
}

/** Deep clone that passes functions through by reference. */
function clone(value) {
	if (Array.isArray(value)) return value.map(clone);
	if (value && typeof value === 'object') {
		const out = {};
		for (const key of Object.keys(value)) out[key] = clone(value[key]);
		return out;
	}
	return value;
}

/** @returns {Promise<HTMLImageElement>} */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`sprite.js: failed to load image "${src}"`));
		img.src = src;
	});
}

/**
 * Apply a frame-parameter object onto a frame in place.
 *
 * Accepted keys (case-insensitive):
 *   width, height          – explicit size
 *   x, y, left, top        – pixel offset, added to the frame's x/y
 *   xoffset, yoffset       – alias of the above
 *   col, row               – grid index, multiplied by the sheet's tile size
 *   centerx/cx, centery/cy – origin
 *   drawOffset             – { x, y } render-time nudge
 */
function applyFrameParams(frame, params, tileW, tileH) {
	for (const rawKey of Object.keys(params)) {
		const key = rawKey.trim().toLowerCase();
		const value = params[rawKey];

		switch (key) {
			case 'width':    frame.width  = Number(value); break;
			case 'height':   frame.height = Number(value); break;

			case 'x': case 'left': case 'xoffset': frame.x += Number(value); break;
			case 'y': case 'top':  case 'yoffset': frame.y += Number(value); break;

			case 'col': frame.x += Number(value) * tileW; break;
			case 'row': frame.y += Number(value) * tileH; break;

			case 'centerx': case 'cx': frame.centerx = Number(value); break;
			case 'centery': case 'cy': frame.centery = Number(value); break;

			case 'drawoffset':
				if (value && typeof value === 'object') {
					frame.drawOffset = { x: Number(value.x) || 0, y: Number(value.y) || 0 };
				}
				break;
		}
	}
	return frame;
}

/**
 * Normalise the two collision shapes we support into `{ circles: [...] }`.
 * @returns {CollisionShape|null}
 */
function parseCollision(value) {
	if (!value || typeof value !== 'object') return null;

	if (value.radius != null) {
		return { circles: [{
			offsetX: Number(value.offsetX) || 0,
			offsetY: Number(value.offsetY) || 0,
			radius:  Number(value.radius),
		}]};
	}

	if (Array.isArray(value.circles)) {
		const circles = [];
		for (const c of value.circles) {
			if (!c || c.radius == null) continue;
			circles.push({
				offsetX: Number(c.offsetX) || 0,
				offsetY: Number(c.offsetY) || 0,
				radius:  Number(c.radius),
			});
		}
		return circles.length ? { circles } : null;
	}

	return null;
}

/* -------------------------------------------------------------------------- */
/* SpriteSheet                                                                */
/* -------------------------------------------------------------------------- */

/**
 * An image plus the frames cut from it and the sequences that animate them.
 * Immutable once loaded — sprites reference it, they never mutate it.
 */
class SpriteSheet {
	constructor(options = {}) {
		/** @type {CanvasImageSource|null} */
		this.image = null;
		/** @type {string|null} Original URL, kept so `toJSON()` can round-trip. */
		this.imageSrc = null;
		/** @type {string|null} Base URL used to resolve relative image paths. */
		this.baseUrl = options.baseUrl ?? null;

		this.frameWidth = 0;
		this.frameHeight = 0;
		this.centerx = 0;
		this.centery = 0;
		this.defaultFrameRate = 25;
		this.scale = 1;

		/** @type {Record<string, Frame>} */
		this.frames = Object.create(null);
		/** @type {Record<string, Sequence>} */
		this.sequences = Object.create(null);
		/** @type {CollisionShape|null} */
		this.collision = null;

		this.ready = false;
	}

	get frameNames()    { return Object.keys(this.frames); }
	get sequenceNames() { return Object.keys(this.sequences); }

	/** Reads through to the image, so it is always correct — no listeners. */
	get imageWidth()  { const i = this.image; return i ? (i.naturalWidth  ?? i.width)  : 0; }
	get imageHeight() { const i = this.image; return i ? (i.naturalHeight ?? i.height) : 0; }

	/* ---- construction ---------------------------------------------------- */

	/**
	 * Load a sheet from a URL or a plain JSON object.
	 * @param {string|Object} source
	 * @param {{ baseUrl?: string }} [options]
	 * @returns {Promise<SpriteSheet>}
	 */
	static async load(source, options = {}) {
		if (typeof source !== 'string') return SpriteSheet.fromJSON(source, options);

		const response = await fetch(source);
		if (!response.ok) {
			throw new Error(`SpriteSheet.load: HTTP ${response.status} for "${source}"`);
		}
		const baseUrl = options.baseUrl ?? new URL(source, document.baseURI).href;
		return SpriteSheet.fromJSON(await response.json(), { ...options, baseUrl });
	}

	/**
	 * Build a sheet from an already-parsed JSON object. The object is not mutated.
	 * @returns {Promise<SpriteSheet>}
	 */
	static async fromJSON(data, options = {}) {
		const sheet = new SpriteSheet(options);
		await sheet.applyJSON(data);
		sheet.ready = true;
		return sheet;
	}

	/**
	 * Apply sheet data in a deterministic order, independent of JSON key order.
	 * Image first (so dimensions are known), then tile size, then frames.
	 * @param {Object} raw
	 */
	async applyJSON(raw) {
		const data = lowerKeyMap(raw);
		const pick = (...keys) => {
			for (const key of keys) if (data[key] !== undefined) return data[key];
			return undefined;
		};

		const image = pick('image');
		if (image !== undefined) await this.setImage(image);

		const fw = pick('framewidth');
		if (fw !== undefined) this.frameWidth = Number(fw);
		const fh = pick('frameheight');
		if (fh !== undefined) this.frameHeight = Number(fh);

		const cx = pick('centerx', 'cx');
		if (cx !== undefined) this.centerx = Number(cx);
		const cy = pick('centery', 'cy');
		if (cy !== undefined) this.centery = Number(cy);

		const rate = pick('framerate');
		if (rate !== undefined) this.defaultFrameRate = Number(rate);

		const frames = pick('frames');
		if (frames !== undefined) this.loadFrames(frames);

		const sequences = pick('sequences');
		if (sequences !== undefined) this.loadSequences(sequences);

		const collision = pick('collision');
		if (collision !== undefined) this.collision = parseCollision(collision);

		return this;
	}

	/**
	 * @param {string|CanvasImageSource} src URL, HTMLImageElement, ImageBitmap, or canvas.
	 */
	async setImage(src) {
		if (src && typeof src === 'object') {
			this.image = src;
			this.imageSrc = null;
			return this;
		}
		const url = this.baseUrl ? new URL(src, this.baseUrl).href : src;
		this.image = await loadImage(url);
		this.imageSrc = src;
		return this;
	}

	/* ---- sprites --------------------------------------------------------- */

	/** @returns {Sprite} */
	newSprite() {
		if (!this.ready) {
			throw new Error('SpriteSheet: sheet is not ready — await load()/fromJSON() first');
		}
		const sprite = new Sprite(this);
		sprite.scale = this.scale;
		return sprite;
	}

	setScale(scale) { this.scale = scale; return this; }

	/* ---- frames ---------------------------------------------------------- */

	/**
	 * Add or replace a frame.
	 * @param {string} name
	 * @param {Object} [params] See {@link applyFrameParams}.
	 * @returns {Frame}
	 */
	addFrame(name, params = {}) {
		const frame = {
			x: 0,
			y: 0,
			width:  this.frameWidth  || this.imageWidth,
			height: this.frameHeight || this.imageHeight,
			centerx: this.centerx,
			centery: this.centery,
			drawOffset: { x: 0, y: 0 },
		};
		applyFrameParams(frame, params, this.frameWidth, this.frameHeight);
		this.frames[name] = frame;
		return frame;
	}

	removeFrame(name) {
		delete this.frames[name];
		return this;
	}

	/** @param {Record<string, Object>} data */
	loadFrames(data) {
		for (const name of Object.keys(data)) this.addFrame(name, data[name]);
		return this;
	}

	/* ---- sequences ------------------------------------------------------- */

	/**
	 * Add or replace a sequence.
	 * @param {string} name
	 * @param {Partial<Sequence>} [def]
	 * @returns {Sequence}
	 */
	addSequence(name, def = {}) {
		const seq = {
			name,
			frames: [],
			frameRate: this.defaultFrameRate,
			iterations: 0,
			method: 'auto',
			...def,
		};
		this.sequences[name] = seq;
		return seq;
	}

	/** @param {Record<string, Object>} data */
	loadSequences(data) {
		for (const name of Object.keys(data)) {
			const raw = data[name] || {};
			const seq = {
				name,
				frames: [],
				frameRate: this.defaultFrameRate,
				iterations: 0,
				method: 'auto',
			};

			for (const rawKey of Object.keys(raw)) {
				const key = rawKey.trim().toLowerCase();
				const value = raw[rawKey];

				switch (key) {
					case 'frames':
						seq.frames = Array.isArray(value) ? value.slice() : [];
						break;
					case 'framerate':
						seq.frameRate = Number(value);
						break;
					case 'iterations':
						seq.iterations = Number(value);
						break;
					case 'method':
						seq.method = String(value);
						break;
					case 'frametimes':
						seq.frameTimes = Array.isArray(value) ? value.slice() : [];
						break;
					case 'callback':
						if (typeof value === 'function') seq.callback = value;
						break;
				}
			}

			this.sequences[name] = seq;
		}
		return this;
	}

	/**
	 * Report sequences that reference frames this sheet does not define.
	 * Useful as a validation step in the editor.
	 * @returns {Array<{ sequence: string, frame: string }>}
	 */
	validate() {
		const problems = [];
		for (const [seqName, seq] of Object.entries(this.sequences)) {
			for (const frameName of seq.frames) {
				if (!this.frames[frameName]) problems.push({ sequence: seqName, frame: frameName });
			}
		}
		return problems;
	}

	/* ---- serialisation --------------------------------------------------- */

	/** @returns {Object} JSON-safe sheet data (function callbacks are dropped). */
	toJSON() {
		const frames = {};
		for (const [name, f] of Object.entries(this.frames)) {
			const out = {
				x: f.x, y: f.y,
				width: f.width, height: f.height,
				centerx: f.centerx, centery: f.centery,
			};
			if (f.drawOffset && (f.drawOffset.x || f.drawOffset.y)) {
				out.drawOffset = { x: f.drawOffset.x, y: f.drawOffset.y };
			}
			frames[name] = out;
		}

		const sequences = {};
		for (const [name, s] of Object.entries(this.sequences)) {
			const out = { frames: s.frames.slice(), frameRate: s.frameRate };
			if (s.iterations) out.iterations = s.iterations;
			if (s.method && s.method !== 'auto') out.method = s.method;
			if (s.frameTimes?.length) out.frameTimes = s.frameTimes.slice();
			sequences[name] = out;
		}

		const out = {
			image: this.imageSrc,
			frameWidth: this.frameWidth,
			frameHeight: this.frameHeight,
			centerx: this.centerx,
			centery: this.centery,
			frameRate: this.defaultFrameRate,
			frames,
			sequences,
		};
		if (this.collision) out.collision = clone(this.collision);
		return out;
	}
}

/* -------------------------------------------------------------------------- */
/* Sprite                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A live, drawable instance of a {@link SpriteSheet}.
 *
 * Coordinate model: `position` is where the sprite's origin lands in the
 * parent's space. The origin defaults to the sheet's `centerx`/`centery`, or
 * the frame's own override. Children are drawn inside the parent's transform,
 * so a child at (0, 0) sits on the parent's origin — handy for equipment.
 */
class Sprite {
	/** @param {SpriteSheet} sheet */
	constructor(sheet) {
		if (!(sheet instanceof SpriteSheet)) {
			throw new TypeError('Sprite: expected a SpriteSheet');
		}

		this.sheet = sheet;
		this.image = sheet.image;

		this.position   = { x: 0, y: 0 };
		this.drawOffset = { x: 0, y: 0 };
		this.scale      = sheet.scale ?? 1;
		this.rotation   = 0;
		this.zIndex     = 0;
		this.flipX      = false;
		this.flipY      = false;
		this.opacity    = 1;
		this.visible    = true;

		/** @type {Frame|null} */
		this.frame = null;
		this.frameName = null;

		/** @type {Sprite|null} */
		this.parent = null;
		/** @type {Sprite[]} Children with `zIndex < 0` draw behind this sprite. */
		this.children = [];

		// Animation state
		this.animating    = false;
		this.sequence     = null;
		this.sequenceName = null;
		this._frameIndex     = 0;
		this._elapsed        = 0;
		this._iterationsLeft = 0;
		this._onComplete     = null;
	}

	get numChildren() { return this.children.length; }
	get frameWidth()  { return this.frame?.width  ?? this.sheet.frameWidth; }
	get frameHeight() { return this.frame?.height ?? this.sheet.frameHeight; }

	/* ---- transforms ------------------------------------------------------ */

	setPosition(x, y) { this.position.x = x; this.position.y = y; return this; }
	setScale(scale)   { this.scale = scale; return this; }
	rotate(angle)     { this.rotation += angle; return this; }

	/* ---- frames ---------------------------------------------------------- */

	/** @param {string} name */
	setFrame(name) {
		const frame = this.sheet.frames[name];
		if (!frame) throw new Error(`Sprite.setFrame: unknown frame "${name}"`);
		this.frame = frame;
		this.frameName = name;
		return this;
	}

	clearFrame() {
		this.frame = null;
		this.frameName = null;
		return this;
	}

	/* ---- animation ------------------------------------------------------- */

	/**
	 * Start a sequence. Replaces any sequence already running.
	 *
	 * @param {string} name
	 * @param {{ onComplete?: Function }} [options]
	 */
	play(name, options = {}) {
		const seq = this.sheet.sequences[name];
		if (!seq) {
			console.warn(`Sprite.play: no sequence named "${name}"`);
			return this;
		}
		if (seq.frames.length === 0) {
			console.warn(`Sprite.play: sequence "${name}" has no frames`);
			return this;
		}

		this.animating       = true;
		this.sequence        = seq;
		this.sequenceName    = name;
		this._frameIndex     = 0;
		this._elapsed        = 0;
		this._iterationsLeft = seq.iterations ?? 0;
		this._onComplete     = options.onComplete ?? seq.callback ?? null;

		this.setFrame(seq.frames[0]);
		return this;
	}

	/** Stop animating. Does not fire the completion callback. */
	stop() {
		this.animating = false;
		this.sequence = null;
		this.sequenceName = null;
		this._onComplete = null;
		return this;
	}

	/** @returns {number} Duration of the current frame in ms. */
	_currentDelay() {
		const seq = this.sequence;
		if (!seq) return Infinity;

		if (seq.frameTimes?.length) {
			const t = seq.frameTimes[this._frameIndex % seq.frameTimes.length];
			if (Number.isFinite(t) && t > 0) return t;
		}
		const fps = seq.frameRate || this.sheet.defaultFrameRate || 25;
		return 1000 / fps;
	}

	/** Advance one frame, wrapping and firing the callback as needed. */
	_step() {
		const seq = this.sequence;
		if (!seq) return;

		const frames = seq.frames;
		let next = this._frameIndex + 1;

		if (next >= frames.length) {
			if (this._iterationsLeft > 0) {
				this._iterationsLeft -= 1;
				if (this._iterationsLeft === 0) {
					// Finished — hold the final frame, then notify.
					this.animating = false;
					this.sequence = null;
					this.sequenceName = null;
					const cb = this._onComplete;
					this._onComplete = null;
					if (typeof cb === 'function') cb.call(this);
					return;
				}
			}
			next = 0;
		}

		this._frameIndex = next;
		const name = frames[next];
		if (name) this.setFrame(name);
	}

	/**
	 * Advance the animation clock. Call this from your rAF loop.
	 * @param {number} dtMs Elapsed milliseconds since the previous update.
	 */
	update(dtMs) {
		if (!this.animating || !this.sequence) return this;
		this._elapsed += dtMs;

		// A long stall (tab switch, breakpoint) must not fast-forward forever.
		let guard = 0;
		while (this.animating) {
			const delay = this._currentDelay();
			if (!(this._elapsed >= delay)) break;
			this._elapsed -= delay;
			this._step();
			if (++guard > 512) { this._elapsed = 0; break; }
		}
		return this;
	}

	/* ---- rendering ------------------------------------------------------- */

	/**
	 * Draw the sprite and its children.
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Object} [options] Per-call overrides: x, y, scale, frameX, frameY,
	 *   frameWidth, frameHeight, centerx, centery.
	 */
	draw(ctx, options = {}) {
		if (!this.visible || !this.image) return;

		const frame = this.frame;
		const sheet = this.sheet;

		const sx = options.frameX ?? frame?.x ?? 0;
		const sy = options.frameY ?? frame?.y ?? 0;
		const sw = options.frameWidth  ?? frame?.width  ?? sheet.imageWidth;
		const sh = options.frameHeight ?? frame?.height ?? sheet.imageHeight;
		const cx = options.centerx ?? frame?.centerx ?? sheet.centerx;
		const cy = options.centery ?? frame?.centery ?? sheet.centery;

		const scale = options.scale ?? this.scale;
		const x = (options.x ?? this.position.x) + this.drawOffset.x + (frame?.drawOffset?.x ?? 0);
		const y = (options.y ?? this.position.y) + this.drawOffset.y + (frame?.drawOffset?.y ?? 0);

		ctx.save();
		try {
			ctx.translate(x * scale, y * scale);
			if (this.rotation) ctx.rotate(this.rotation);
			if (scale !== 1) ctx.scale(scale, scale);
			if (this.flipX || this.flipY) ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
			if (this.opacity !== 1) ctx.globalAlpha *= this.opacity;

			this._drawChildren(ctx, true);
			ctx.drawImage(this.image, sx, sy, sw, sh, -cx, -cy, sw, sh);
			this._drawChildren(ctx, false);
		} finally {
			ctx.restore();
		}
	}

	/** @param {boolean} behind Draw the children with `zIndex < 0` (or the rest). */
	_drawChildren(ctx, behind) {
		const kids = this.children;
		for (let i = 0; i < kids.length; i++) {
			const child = kids[i];
			if ((child.zIndex < 0) === behind) child.draw(ctx);
		}
	}

	/**
	 * Blit an arbitrary region of the sheet, bypassing rotation/centering.
	 * Useful for tiles and background decoration.
	 */
	drawArea(ctx, dx, dy, sx, sy, sw, sh, scale = this.scale) {
		if (!this.image) return;
		ctx.drawImage(this.image, sx, sy, sw, sh, dx * scale, dy * scale, sw * scale, sh * scale);
	}

	/**
	 * Blit a random region of the sheet — handy for rubble, foliage, stars.
	 * @param {number} [randomKey] Deterministic seed; omit for true randomness.
	 */
	drawRandomArea(ctx, dx, dy, width, height, randomKey) {
		if (!this.image) return;

		const sheet = this.sheet;
		const w = Math.min(Math.max(Math.trunc(width), 0), sheet.imageWidth);
		const h = Math.min(Math.max(Math.trunc(height), 0), sheet.imageHeight);
		if (w === 0 || h === 0) return;

		let rx, ry;
		if (randomKey === undefined) {
			rx = Math.random();
			ry = Math.random();
		} else {
			rx = fract(Math.sin(randomKey) * 10000);
			ry = fract(Math.sin(rx * 10000));
		}

		// `+ 1` so the final row/column is reachable.
		const sx = Math.floor(rx * (sheet.imageWidth  - w + 1));
		const sy = Math.floor(ry * (sheet.imageHeight - h + 1));

		this.drawArea(ctx, dx, dy, sx, sy, w, h);
	}

	/* ---- hierarchy ------------------------------------------------------- */

	/** @param {Sprite} child */
	attach(child) {
		if (child === this) throw new Error('Sprite.attach: cannot attach a sprite to itself');
		if (child.parent === this) return this;
		child.detach();
		child.parent = this;
		this.children.push(child);
		return this;
	}

	/** @param {Sprite} parent */
	attachTo(parent) {
		if (!parent || typeof parent.attach !== 'function') {
			throw new TypeError('Sprite.attachTo: expected a parent Sprite');
		}
		parent.attach(this);
		return this;
	}

	/**
	 * Detach `child` from this sprite, or — with no argument — detach this
	 * sprite from its own parent.
	 * @param {Sprite} [child]
	 */
	detach(child = null) {
		if (child === null) {
			this.parent?.detach(this);
			return this;
		}
		const index = this.children.indexOf(child);
		if (index !== -1) {
			this.children.splice(index, 1);
			child.parent = null;
		}
		return this;
	}

	/** Detach from the tree, drop children, and stop animating. */
	destroy() {
		this.stop();
		for (const child of this.children) child.parent = null;
		this.children.length = 0;
		this.parent?.detach(this);
		this.parent = null;
	}
}

//export { Sprite, SpriteSheet };
window.Sprite = Sprite;
window.SpriteSheet = SpriteSheet;
