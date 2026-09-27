#!/usr/bin/env node
/**
 * migrate-draw-offset.mjs — fold per-frame drawOffset into centerx/centery.
 *
 *   node migrate-draw-offset.mjs path/to/sheet.json             (dry run)
 *   node migrate-draw-offset.mjs path/to/sheet.json --write
 *
 * Frame drawOffset shifted the drawn image by (dx, dy) in world pixels.
 * Sprite.draw places the image at (-cx, -cy) relative to the origin, so
 * the same visual is achieved by reducing centering by the offset amount:
 *   newCenterX = oldCenterX - drawOffset.x
 *   newCenterY = oldCenterY - drawOffset.y
 *
 * Frames without drawOffset are untouched. Frames whose centering was
 * implicit (inherited from the sheet) get explicit values materialised,
 * because the adjustment has to land somewhere.
 */

import { readFile, writeFile } from 'node:fs/promises';

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const write = argv.includes('--write');

if (!file) {
	console.error('Usage: migrate-draw-offset.mjs <sheet.json> [--write]');
	process.exit(1);
}

const raw = await readFile(file, 'utf8');
const data = JSON.parse(raw);

if (!data.frames || typeof data.frames !== 'object') {
	console.error(`No frames object in ${file}.`);
	process.exit(1);
}

const sheetCX = Number(data.centerx) || 0;
const sheetCY = Number(data.centery) || 0;

let migrated = 0;
let unchanged = 0;

for (const name of Object.keys(data.frames)) {
	const frame = data.frames[name];
	const off = frame.drawOffset;
	if (!off || (off.x === 0 && off.y === 0)) { unchanged++; continue; }

	const dx = Number(off.x) || 0;
	const dy = Number(off.y) || 0;

	// Materialise centering if it was implicit, then apply the offset.
	const cx = frame.centerx !== undefined ? Number(frame.centerx) : sheetCX;
	const cy = frame.centery !== undefined ? Number(frame.centery) : sheetCY;

	frame.centerx = cx - dx;
	frame.centery = cy - dy;
	delete frame.drawOffset;

	console.log(`  ${name}: drawOffset ${dx},${dy} → center ${frame.centerx},${frame.centery}`);
	migrated++;
}

console.log(`\n${file}: ${migrated} migrated, ${unchanged} unchanged.`);

if (migrated === 0) {
	console.log('Nothing to write.');
	process.exit(0);
}

if (write) {
	await writeFile(file, JSON.stringify(data, null, '\t') + '\n', 'utf8');
	console.log('Written.');
} else {
	console.log('Dry run. Re-run with --write to apply.');
}
