#!/usr/bin/env node
/**
 * migrate-sheet-json.mjs — migrate legacy sprite sheet JSON to the new format.
 *
 *   node migrate-sheet-json.mjs ./assets --dry-run
 *   node migrate-sheet-json.mjs ./assets --in-place
 *
 * Changes applied:
 *   • frameRate       : milliseconds-per-frame  →  frames-per-second
 *   • frame.x / .y    : grid column / row index →  col / row
 *   • frame.left/.top : pixel offsets           →  xoffset / yoffset
 *
 * Flags:
 *   --dry-run          print a diff, write nothing (default)
 *   --in-place         write files back
 *   --no-framerate     skip the ms→fps conversion
 *   --xy=grid|pixel    how to interpret frame x/y (default: grid)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const argv     = process.argv.slice(2);
const root     = argv.find(a => !a.startsWith('--')) || '.';
const dryRun   = !argv.includes('--in-place');
const doRate   = !argv.includes('--no-framerate');
const xyMode   = (argv.find(a => a.startsWith('--xy=')) || '--xy=grid').split('=')[1];

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
		const p = path.join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) walk(p, out);
		else if (name.endsWith('.json')) out.push(p);
	}
	return out;
}

/** Heuristic: does this object look like a sprite sheet? */
function looksLikeSheet(obj) {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
	const hasContent = obj.frames || obj.sequences;
	const hasShape   = obj.frameWidth !== undefined || obj.image !== undefined;
	return hasContent && hasShape;
}

function migrateFrame(frame) {
	const out = { ...frame };

	if (xyMode === 'grid') {
		if (out.x !== undefined) { out.col = Number(out.x); delete out.x; }
		if (out.y !== undefined) { out.row = Number(out.y); delete out.y; }
	}
	// `left` / `top` were always pixel offsets in the old addFrame().
	if (out.left !== undefined) { out.xoffset = Number(out.left); delete out.left; }
	if (out.top  !== undefined) { out.yoffset = Number(out.top);  delete out.top; }

	return out;
}

function migrateSheet(data) {
	const out     = { ...data };
	const changes = [];

	if (doRate && typeof out.frameRate === 'number' && out.frameRate > 0) {
		const old = out.frameRate;
		out.frameRate = Math.round((1000 / old) * 1000) / 1000;
		changes.push(`frameRate ${old}ms → ${out.frameRate}fps`);
	}

	if (out.frames && typeof out.frames === 'object') {
		const frames = {};
		for (const [name, f] of Object.entries(out.frames)) {
			const before = JSON.stringify(f);
			frames[name] = migrateFrame(f);
			if (JSON.stringify(frames[name]) !== before) {
				changes.push(`frame "${name}": ${before} → ${JSON.stringify(frames[name])}`);
			}
		}
		out.frames = frames;
	}

	if (doRate && out.sequences && typeof out.sequences === 'object') {
		const seqs = {};
		for (const [name, s] of Object.entries(out.sequences)) {
			seqs[name] = { ...s };
			if (typeof seqs[name].frameRate === 'number' && seqs[name].frameRate > 0) {
				const old = seqs[name].frameRate;
				seqs[name].frameRate = Math.round((1000 / old) * 1000) / 1000;
				changes.push(`sequence "${name}".frameRate ${old}ms → ${seqs[name].frameRate}fps`);
			}
		}
		out.sequences = seqs;
	}

	return { out, changes };
}

async function main() {
	const files = walk(root);
	let migrated = 0, skipped = 0;

	for (const file of files) {
		let raw, data;
		try {
			raw  = await readFile(file, 'utf8');
			data = JSON.parse(raw);
		} catch { skipped++; continue; }

		if (!looksLikeSheet(data)) { skipped++; continue; }

		const { out, changes } = migrateSheet(data);
		if (changes.length === 0) { skipped++; continue; }

		migrated++;
		console.log(`\n${file}`);
		for (const c of changes) console.log(`  • ${c}`);

		if (!dryRun) {
			await writeFile(file, JSON.stringify(out, null, '\t') + '\n', 'utf8');
		}
	}

	console.log(`\n${dryRun ? '[dry-run] ' : ''}${migrated} sheet(s) migrated, ${skipped} file(s) skipped.`);
	if (dryRun && migrated) console.log('Re-run with --in-place to write changes.');
}

main().catch(err => { console.error(err); process.exit(1); });