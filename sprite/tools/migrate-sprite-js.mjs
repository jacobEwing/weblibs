#!/usr/bin/env node
/**
 * migrate-sprite-js.mjs — conservative codemod for the sprite API rename.
 *
 *   node migrate-sprite-js.mjs ./src --dry-run
 *   node migrate-sprite-js.mjs ./src --in-place
 *
 * Safe rewrites (applied automatically):
 *   spriteSet / cSprite                → SpriteSheet / Sprite
 *   .startSequence(name)               → .play(name)
 *   .startSequence(name, cb)           → .play(name, { onComplete: cb })
 *   .stopSequence()                    → .stop()
 *   .load_frames / .load_sequences     → .loadFrames / .loadSequences
 *   .currentSequenceName               → .sequenceName
 *   .currentSequence                   → .sequence
 *   .currentFrame                      → .frame
 *   .myParent                          → .parent
 *
 * Flagged for manual review (reported, NOT rewritten):
 *   new cSprite(...)          — construct via sheet.newSprite() instead
 *   new spriteSet(); .load()  — static factory SpriteSheet.load() now
 *   .loadJSON()               — now SpriteSheet.fromJSON()
 *   .setTemplate()            — removed
 *   .setFrameSize()           — removed
 *   .resolveImageDimensions() — removed
 *   .parseCollision()         — now module-private
 *   spriteSet.prototype.*     — port to class methods
 */

import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const argv   = process.argv.slice(2);
const root   = argv.find(a => !a.startsWith('--')) || '.';
const dryRun = !argv.includes('--in-place');

const EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx']);

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
		const p = path.join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) walk(p, out);
		else if (EXT.has(path.extname(name))) out.push(p);
	}
	return out;
}

/** Two-arg startSequence first, so the single-arg rule doesn't eat it. */
function rewriteStartSequence(src) {
	// .startSequence(name, cb)  →  .play(name, { onComplete: cb })
	src = src.replace(
		/\.startSequence\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g,
		'.play($1, { onComplete: $2 })'
	);
	// .startSequence(name)      →  .play(name)
	src = src.replace(/\.startSequence\(/g, '.play(');
	return src;
}

const RENAMES = [
	[/\bspriteSet\b/g, 'SpriteSheet'],
	[/\bcSprite\b/g,   'Sprite'],
	[/\.stopSequence\(/g,        '.stop('],
	[/\.load_frames\(/g,         '.loadFrames('],
	[/\.load_sequences\(/g,      '.loadSequences('],
	[/\.currentSequenceName\b/g, '.sequenceName'],
	[/\.currentSequence\b/g,     '.sequence'],
	[/\.currentFrame\b/g,        '.frame'],
	[/\.myParent\b/g,            '.parent'],
];

const FLAGS = [
	[/new\s+cSprite\s*\(/g,
	 'new cSprite(x) → x.newSprite()  (Sprite no longer takes a template directly)'],
	[/\.loadJSON\s*\(/g,
	 '.loadJSON() → SpriteSheet.fromJSON(data)  (static, returns Promise)'],
	[/\.setTemplate\s*\(/g,
	 '.setTemplate() was removed — construct sprites via sheet.newSprite()'],
	[/\.setFrameSize\s*\(/g,
	 '.setFrameSize() was removed — assign sheet.frameWidth / sheet.frameHeight'],
	[/\.resolveImageDimensions\s*\(/g,
	 '.resolveImageDimensions() was removed — imageWidth/Height are getters now'],
	[/\.parseCollision\s*\(/g,
	 '.parseCollision() is now a module-private helper'],
	[/SpriteSheet\.prototype\.\w+\s*=/g,
	 'spriteSet.prototype.* assignment — port to a class method or subclass'],
	[/\bnew\s+SpriteSheet\s*\(\s*\)[\s\S]{0,80}?\.load\s*\(/g,
	 'new SpriteSheet() + .load() → SpriteSheet.load()  (static factory, review by hand)'],
];

async function main() {
	const files = walk(root);
	let changed = 0;

	for (const file of files) {
		const original = await readFile(file, 'utf8');
		let src = original;

		// 1. Safe rewrites
		src = rewriteStartSequence(src);
		for (const [re, rep] of RENAMES) src = src.replace(re, rep);

		const rewrote = src !== original;

		// 2. Report anything needing a human
		const hits = [];
		for (const [re, msg] of FLAGS) {
			const matches = src.match(re);
			if (matches) hits.push({ msg, count: matches.length });
		}

		if (!rewrote && hits.length === 0) continue;

		console.log(`\n${file}`);
		if (rewrote) console.log('  rewrote: identifier / method renames');
		for (const { msg, count } of hits) console.log(`  ⚠ ${count}× ${msg}`);

		if (rewrote && !dryRun) {
			await writeFile(file, src, 'utf8');
			changed++;
		} else if (rewrote) {
			changed++;
		}
	}

	console.log(`\n${dryRun ? '[dry-run] ' : ''}${changed} file(s) rewritten.`);
	if (dryRun && changed) console.log('Re-run with --in-place to write changes.');
	console.log('Files with ⚠ need manual edits — the script deliberately did not guess.');
}

main().catch(err => { console.error(err); process.exit(1); });