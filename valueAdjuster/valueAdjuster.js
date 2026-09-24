function valueAdjuster(inputElement, options) {
	if (!inputElement || inputElement.tagName !== 'INPUT') {
		throw new Error('valueAdjuster: first argument must be an <input> element.');
	}

	var settings = Object.assign({
		showStepSize: false,
		showResetButton: false,
		minimum: NaN,
		maximum: NaN,
		onAdjust: null,
		stepSize: 1,
		displayElement: null,
		indicatorStyle: 'handle'
	}, options || {});

	var stepSize = settings.stepSize;
	var indicatorStyle = settings.indicatorStyle === 'color' ? 'color' : 'handle';
	var displayEl = settings.displayElement || null;
	var displayIsInput = !!(displayEl && displayEl.tagName === 'INPUT');

	var startingValue = parseFloat(inputElement.value);
	if (isNaN(startingValue)) startingValue = 0;
	var resetValue = startingValue;
	var value = clamp(startingValue);

	function clamp(v) {
		if (!isNaN(settings.minimum)) v = Math.max(settings.minimum, v);
		if (!isNaN(settings.maximum)) v = Math.min(settings.maximum, v);
		return v;
	}

	function formatForReadOnlyDisplay(n) {
		var rounded = Math.round(n * 100) / 100;
		return rounded.toLocaleString();
	}

	function updateDisplayElement() {
		if (!displayEl) return;
		if (displayIsInput) {
			if (document.activeElement !== displayEl) {
				displayEl.value = value;
			}
		} else {
			displayEl.textContent = formatForReadOnlyDisplay(value);
		}
	}

	function setValue(v, fireInputEvents) {
		value = clamp(v);
		inputElement.value = value;
		if (internalDisplay) {
			internalDisplay.textContent = formatForReadOnlyDisplay(value);
		}
		updateDisplayElement();
		if (fireInputEvents) {
			inputElement.dispatchEvent(new Event('input', { bubbles: true }));
			inputElement.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}

	function notifyAdjust() {
		if (typeof settings.onAdjust === 'function') {
			settings.onAdjust(value);
		}
	}

	// Build the widget DOM
	var container = document.createElement('div');
	container.className = 'value-adjuster';

	var track = document.createElement('div');
	track.className = 'value-adjuster-track style-' + indicatorStyle;

	var fill = document.createElement('div');
	fill.className = 'value-adjuster-fill';
	track.appendChild(fill);

	// Only render the built-in numeric readout inside the track when no
	// external displayElement was supplied, so the value is never lost.
	var internalDisplay = null;
	if (!displayEl) {
		internalDisplay = document.createElement('div');
		internalDisplay.className = 'value-adjuster-display';
		track.appendChild(internalDisplay);
	}

	var dot = null;
	var handle = null;

	if (indicatorStyle === 'color') {
		dot = document.createElement('div');
		dot.className = 'value-adjuster-dot';
		track.appendChild(dot);
	} else {
		handle = document.createElement('div');
		handle.className = 'value-adjuster-handle';
		handle.tabIndex = 0;
		handle.appendChild(document.createElement('span'));
		handle.appendChild(document.createElement('span'));
		track.appendChild(handle);
	}

	container.appendChild(track);

	var stepSelect = null;
	var resetBtn = null;

	if (settings.showStepSize || settings.showResetButton) {
		var controls = document.createElement('div');
		controls.className = 'value-adjuster-controls';

		if (settings.showStepSize) {
			var label = document.createElement('label');
			label.textContent = 'Step';
			controls.appendChild(label);

			stepSelect = document.createElement('select');
			[1, 10, 100, 1000].forEach(function (v) {
				var opt = document.createElement('option');
				opt.value = String(v);
				opt.textContent = String(v);
				if (v === stepSize) opt.selected = true;
				stepSelect.appendChild(opt);
			});
			stepSelect.addEventListener('change', function () {
				stepSize = parseFloat(stepSelect.value);
			});
			controls.appendChild(stepSelect);
		}

		if (settings.showResetButton) {
			resetBtn = document.createElement('button');
			resetBtn.type = 'button';
			resetBtn.className = 'value-adjuster-reset';
			resetBtn.textContent = 'Reset';
			resetBtn.addEventListener('click', function () {
				setValue(resetValue, true);
				notifyAdjust();
			});
			controls.appendChild(resetBtn);
		}

		container.appendChild(controls);
	}

	// Hide the original input but keep it in the DOM so forms/frameworks
	// that read its value keep working, then insert the widget after it.
	inputElement.style.display = 'none';
	inputElement.insertAdjacentElement('afterend', container);

	setValue(value, false);

	// If an editable display element was provided, let the user type a
	// value directly into it.
	if (displayIsInput) {
		displayEl.addEventListener('input', function () {
			var parsed = parseFloat(displayEl.value);
			if (!isNaN(parsed)) {
				value = clamp(parsed);
				inputElement.value = value;
				if (internalDisplay) internalDisplay.textContent = formatForReadOnlyDisplay(value);
			}
		});
		displayEl.addEventListener('change', function () {
			var parsed = parseFloat(displayEl.value);
			setValue(isNaN(parsed) ? value : parsed, true);
			notifyAdjust();
		});
	}

	// Drag-to-scrub logic: speed increases with distance from the drag origin.
	var dragging = false;
	var startX = 0;
	var accum = 0;
	var raf = null;
	var maxTravelPx = 130;
	var shiftHeld = false;

	function speedForDistance(dist, fine) {
		var d = Math.abs(dist);
		var sign = dist < 0 ? -1 : 1;
		var base = Math.pow(d / 18, 1.9) * 0.02 + (d > 8 ? (d - 8) * 0.01 : 0);
		if (fine) base *= 0.05;
		return sign * base;
	}

	function onKeyDownGlobal(e) {
		if (e.key === 'Shift') shiftHeld = true;
	}
	function onKeyUpGlobal(e) {
		if (e.key === 'Shift') shiftHeld = false;
	}

	function tick() {
		if (!dragging) return;
		var dx = accum;
		var speed = speedForDistance(dx, shiftHeld);
		if (Math.abs(speed) > 0.0001) {
			setValue(value + speed, false);
		}
		if (handle) {
			var clampedPx = Math.max(-maxTravelPx, Math.min(maxTravelPx, dx));
			handle.style.left = 'calc(50% + ' + clampedPx + 'px)';
		}
		if (dot) {
			dot.style.opacity = '1';
			var dotPx = Math.max(-maxTravelPx, Math.min(maxTravelPx, dx));
			dot.style.left = 'calc(50% + ' + dotPx + 'px)';
		}
		var fillPct = Math.max(-42, Math.min(42, dx / 3.5));
		fill.style.left = (fillPct < 0 ? 50 + fillPct : 50) + '%';
		fill.style.width = Math.abs(fillPct) + '%';
		raf = requestAnimationFrame(tick);
	}

	function pointerDown(e) {
		dragging = true;
		startX = e.clientX;
		accum = 0;
		if (handle) handle.style.transform = 'scale(0.96)';
		window.addEventListener('keydown', onKeyDownGlobal);
		window.addEventListener('keyup', onKeyUpGlobal);
		raf = requestAnimationFrame(tick);
		e.preventDefault();
	}

	function pointerMove(e) {
		if (!dragging) return;
		accum = e.clientX - startX;
	}

	function pointerUp() {
		if (!dragging) return;
		dragging = false;
		shiftHeld = false;
		window.removeEventListener('keydown', onKeyDownGlobal);
		window.removeEventListener('keyup', onKeyUpGlobal);
		if (raf) cancelAnimationFrame(raf);
		fill.style.width = '0';
		if (handle) {
			handle.style.left = '50%';
			handle.style.transform = 'scale(1)';
		}
		if (dot) {
			dot.style.opacity = '0';
			dot.style.left = '50%';
		}
		inputElement.dispatchEvent(new Event('input', { bubbles: true }));
		inputElement.dispatchEvent(new Event('change', { bubbles: true }));
		notifyAdjust();
	}

	var dragSurface = handle || track;
	dragSurface.addEventListener('pointerdown', pointerDown);
	window.addEventListener('pointermove', pointerMove);
	window.addEventListener('pointerup', pointerUp);
	window.addEventListener('pointercancel', pointerUp);

	track.addEventListener('wheel', function (e) {
		e.preventDefault();
		var delta = e.deltaY < 0 ? stepSize : -stepSize;
		setValue(value + delta, true);
		notifyAdjust();
	}, { passive: false });

	dragSurface.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowRight') {
			setValue(value + stepSize, true);
			notifyAdjust();
			e.preventDefault();
		} else if (e.key === 'ArrowLeft') {
			setValue(value - stepSize, true);
			notifyAdjust();
			e.preventDefault();
		}
	});
	if (!handle) track.tabIndex = 0;

	return {
		getValue: function () {
			return value;
		},
		setValue: function (v) {
			setValue(v, true);
			notifyAdjust();
		},
		destroy: function () {
			window.removeEventListener('pointermove', pointerMove);
			window.removeEventListener('pointerup', pointerUp);
			window.removeEventListener('pointercancel', pointerUp);
			container.remove();
			inputElement.style.display = '';
		}
	};
}
