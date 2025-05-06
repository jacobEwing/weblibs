var paletteGraph;

window.onload = function(){ initialize(); };

// A class representing a palette adjustment UI component
var palettePlotter = function(targetCanvas, palette){
	this.palette = palette != undefined ? palette : this.getDefaultPalette();

	// User I/O interaction states
	this.states = {
		idle : 0,
		dragging : 1,
		adjustingAmplitude : 2,
		adjustingPeriod : 3
		
	};

	this.state = this.states.idle; // a state for handling I/O
	this.previewPeriodScale = 1; // a multiplier for the range of angles used in rendering the gradients/waves
	this.waveSelectRadius = cssToPixels('3mm'); // min proximity to sine wave to click and drag
	this.lastMoveEvent = null; // used to calculate displacement on mouse motion
	this.selectedPrimary = null; // The currently selected primary colour to adjust
	this.amplitudeSign = 1; // Needed when changing amplitude, as it must be negateded depending on where the grab point was
	this.periodHandleWidth = cssToPixels('1ch');
	this.selectedPeriodSlider = null;

	this.canvas = targetCanvas;
	this.context = this.canvas.getContext('2d');

	// get the proximity to wave extremes which will trigger changing amplitude on
	// click and drag rather than offset
	this.resizeMargin = Math.round(this.canvas.height * 0.1);
	if(this.resizeMargin < 5) this.resizeMargin = 5;

	// get the vertical canvas area that will be used for plotting the graph
	this.graphHeight = this.canvas.height - cssToPixels('3lh');

	// get the height of the slider widgets for adjusting the wave periods
	this.periodSliderHeight = Math.floor((this.canvas.height - this.graphHeight) / 3);


}


// handle left mouse depression events
palettePlotter.prototype.handleMouseDown = function(e){
	let rect = this.canvas.getBoundingClientRect();
	let mousePos = {
		x : e.clientX - rect.left,
		y : e.clientY - rect.top
	};
	this.selectedPeriodSlider = this.getSelectedPeriodSlider(mousePos.x, mousePos.y);
	let selectedWave = this.getSelectedPrimary(e.clientX - rect.left, e.clientY - rect.top);

	if(selectedWave != null){
		this.lastMoveEvent = e;
		this.selectedPrimary = selectedWave;

		if(this.inResizeMargin(mousePos.x, mousePos.y, this.selectedPrimary)){
			this.state = this.states.adjustingAmplitude;
			// If the location we started at represents an angle whose sine is a
			// negative value, then we will need to negate the amplitude caluclated
			// by the mouse position.
			let ang = this.getPrimaryAngle(this.selectedPrimary, mousePos.x);
			this.amplitudeSign = ang > 0 && ang <= Math.PI ? -1 : 1;
		}else{
			this.state = this.states.dragging;
		}
	}else{
		if(this.selectedPeriodSlider != null){
			this.state = this.states.adjustingPeriod;
		}
	}

}

// handle mouse button release
palettePlotter.prototype.handleMouseUp = function(e){
	this.lastMoveEvent = null;
	this.selectedPrimary = null;
	this.state = this.states.idle;
}

// react to mouse motion accordingly
palettePlotter.prototype.handleMouseMove = function(e){
	let rect = this.canvas.getBoundingClientRect();
	let mousePos = {
		x : e.clientX - rect.left,
		y : e.clientY - rect.top
	};

	let delta = {
		x : this.lastMoveEvent == null ? 0 : this.lastMoveEvent.screenX - e.screenX,
		y : this.lastMoveEvent == null ? 0 : this.lastMoveEvent.screenY - e.screenY
	};

	switch(this.state){
		case this.states.idle:

			let selectedWave = this.getSelectedPrimary(mousePos.x, mousePos.y);
			if(selectedWave != null){
				if(this.inResizeMargin(mousePos.x, mousePos.y, selectedWave)){
					this.canvas.style.cursor = 'n-resize';
				}else{
					this.canvas.style.cursor = 'pointer';
				}
			} else {
				let selectedSlider = this.getSelectedPeriodSlider(mousePos.x, mousePos.y);
				if(selectedSlider != null){
					this.canvas.style.cursor = 'pointer';
				}else{
					this.canvas.style.cursor = 'auto';
				}
			}
			break;

		case this.states.dragging:

			// convert the displacement to match the actual wave being plotted
			delta.x = 2 * Math.PI * delta.x / this.canvas.width;
			delta.y /= this.graphHeight;
			
			this.palette[this.selectedPrimary].angOffset += delta.x * this.previewPeriodScale / this.palette[this.selectedPrimary].period;

			let newYTranslate = this.palette[this.selectedPrimary].ytranslate + delta.y;
			this.palette[this.selectedPrimary].ytranslate = newYTranslate;


			this.update();
			
			break;
		case this.states.adjustingAmplitude:
			// set the amplitude based on the distance from the zero line to the mouse position
			let y = mousePos.y - this.zeroY(this.selectedPrimary);
			this.palette[this.selectedPrimary].amplitude = this.amplitudeSign * y * 2 / this.graphHeight;
			this.update();

			break;
		case this.states.adjustingPeriod:
			newPeriod = mousePos < 1 ? 1 : mousePos.x >= this.canvas.width ? this.canvas.width : mousePos.x;
			newPeriod /= this.canvas.width;
			this.palette[this.selectedPeriodSlider].period = newPeriod;

			this.update();
			break;

	}
	this.lastMoveEvent = e;
	
}

// return true if the given x, y coordinate is within the right area of one of the waves to trigger changing it's amplitude if selected
palettePlotter.prototype.inResizeMargin = function(x, y, primary){
	let ang = this.getPrimaryAngle(primary, x);
	return (
		   Math.abs(ang - Math.PI / 2) < .3
		|| Math.abs(ang - 3 * Math.PI / 2) < .3
	);
}

// refresh the canvas
palettePlotter.prototype.update = function(){
	var x, y;
	let image = new ImageData(this.canvas.width, this.canvas.height);

	for(x = 0; x < this.canvas.width; x++){

		// render the background colour at the current x coordinate
		let previewColour = this.getColour(x);
		for(y = 0; y < this.graphHeight; y++){
			drawPixel(image, x, y, previewColour);
		}
		


		for(let primary of ['red', 'green', 'blue']){
			let colour = {
				red : primary == 'red' ? 255 : 0, 
				green: primary == 'green' ? 255 : 0, 
				blue : primary == 'blue' ? 255 : 0
			};

			let zeroY = this.zeroY(primary);
			// draw the zero line for the wave
			if(x & 1 && zeroY >= 0 && zeroY < this.graphHeight){
				drawPixel(image, x, this.zeroY(primary), colour);
			}

			// render the next pixel on each wave
			y = this.primaryY(primary, x);
			if(y < 0 || y >= this.graphHeight) continue;
			drawPixel(image, x, y, colour);
			drawPixel(image, x, y - 1, colour);
			drawPixel(image, x, y + 1, colour);
			
		}

	}

	// now draw the frequncy adjusters
	for(let n = 0; n < 3; n++){
		// this colour chunk is a bit overkill and can be simplified when the coding's done if that remains the case
		let primary = ['red', 'green', 'blue'][n];
		let borderColour = {
			red : primary == 'red' ? 255 : 0, 
			green: primary == 'green' ? 255 : 0, 
			blue : primary == 'blue' ? 255 : 0
		};
		let fillColour = {
			red : borderColour.red >> 1,
			green : borderColour.green >> 1,
			blue : borderColour.blue >> 1
		}

		let region = this.getPeriodSliderRectangle(primary);
		drawBox(image, 0, region.y1, region.x1, region.y2, fillColour, fillColour);
		drawBox(image, region.x1, region.y1, region.x2, region.y2, borderColour, fillColour);
	}


	this.context.putImageData(image, 0, 0);

}

palettePlotter.prototype.getPeriodSliderRectangle = function(primary){
	let y = primary == 'red' ? 0 : primary == 'green' ? 1 : 2;
	y *= this.periodSliderHeight;
	y += this.graphHeight;
	let x = Math.round((this.canvas.width - 2 * this.periodHandleWidth) * this.palette[primary].period);

	return {
		x1 : x + this.periodHandleWidth,
		y1 : y,
		x2 : x + this.periodHandleWidth * 2,
		y2 : y + this.periodSliderHeight
	};


}

// calculate the colour that is generated for the specified count
palettePlotter.prototype.getColour = function(count){
	var rval = {
		red : Math.round(127.5 + 127.5 * this.getPrimaryAmplitude('red', count)),
		green : Math.round(127.5 + 127.5 * this.getPrimaryAmplitude('green', count)),
		blue : Math.round(127.5 + 127.5 * this.getPrimaryAmplitude('blue', count)),
		alpha : 255
	};
	return rval;
}

// For the specified R, G, or B primary, caluclate the angle that is later used
// to get the primary colour's value
palettePlotter.prototype.getPrimaryAngle = function(primaryname, count){
	let rval = (count * this.previewPeriodScale * 2 * Math.PI / this.canvas.width)
		/ this.palette[primaryname].period
		+ this.palette[primaryname].angOffset;

	// let's keep it in the 0 to 2pi range
	rval %= 2 * Math.PI; // yes, mod works on floats in JS
	if(rval < 0) rval += 2 * Math.PI;

	return rval;

}

// get the amplitude of the wave that is used to calculate the specified
// primary colour for the given count (or x-coordinate)
palettePlotter.prototype.getPrimaryAmplitude = function(primaryname, count){
	let rval = (
		this.palette[primaryname].amplitude * Math.sin(
			this.getPrimaryAngle(primaryname, count) 
		)
		+ this.palette[primaryname].ytranslate
	);
	return rval;
}

palettePlotter.prototype.zeroY = function(primaryname){
	// get y coordinate of the canvas position for the zero line on the given primary
	return Math.floor(this.graphHeight * (.5 - this.palette[primaryname].ytranslate));
}

palettePlotter.prototype.primaryY = function(primaryname, x){
	/*
	Get the appropriate y coordinate for the specific primary colour's sine wave
	plotted at the given x coordinate.

	Note that we're subtracting the actual wave value here rather than adding it.
	This is to account for the vertical axis on a canvas being the inverse of that
	in normal math plotting.

	*/
	return Math.floor(
		(
			.5 - this.getPrimaryAmplitude(primaryname, x) / 2
			* Math.abs(this.palette[primaryname].amplitude)
			- this.palette[primaryname].ytranslate
		) 
		* this.graphHeight 

	);
}

// checks whether the specified point lands on one of the primary sine waves,
// and returns the name of the primary if so, null otherwise
palettePlotter.prototype.getSelectedPrimary = function(x, y){

	var primary, temp;

	let rect = this.canvas.getBoundingClientRect();

	let closest = Math.abs(y - this.primaryY('red', x));
	let selected = 'red';


	temp = Math.abs(y - this.primaryY('green', x));
	if(temp < closest){
		closest = temp;
		selected = 'green';
	}

	temp = Math.abs(y - this.primaryY('blue', x));
	if(temp < closest){
		closest = temp;
		selected = 'blue';
	}

	if(closest > this.waveSelectRadius){
		selected = null;
	}

	return selected;

}

palettePlotter.prototype.getSelectedPeriodSlider = function(x, y){
	rval = null;
	for(let primary of ['red', 'green', 'blue']){
		let box = this.getPeriodSliderRectangle(primary);
		if(box.x1 <= x && box.x2 >= x && box.y1 <= y && box.y2 >= y){
			rval = primary;
			break;
		}
	}
	return rval;

}

palettePlotter.prototype.getDefaultPalette = function(){
	return {
		"red": {
			"angOffset": -.47,
			"ytranslate" : 0,
			"amplitude" : 1,
			"period" : 1
		},
		"green": {
			"angOffset": 0,
			"ytranslate" : 0,
			"amplitude" : 1,
			"period" : 1
		},
		"blue": {
			"angOffset": .7,
			"ytranslate" : 0,
			"amplitude" : 1,
			"period" : 1
		}
	};

}

// draw a single pixel in an image
function drawPixel(image, x, y, colour){
	if(x < 0 || x >= image.width || y < 0 || y >= image.width) return;

	let alpha = colour.alpha == undefined ? 255 : colour.alpha;

	let index = (y * image.width + x) * 4;

	image.data[index + 0] = colour.red;
	image.data[index + 1] = colour.green;
	image.data[index + 2] = colour.blue;
	image.data[index + 3] = alpha;
		
}

function drawBox(image, x1, y1, x2, y2, borderColour, fillColour){
	var x, y;
	for(x = x1; x <= x2; x++){
		drawPixel(image, x, y1, borderColour);
		drawPixel(image, x, y2, borderColour);
	}

	for(y = y1; y <= y2; y++){
		drawPixel(image, x1, y, borderColour);
		drawPixel(image, x2, y, borderColour);
	}

	for(x = x1 + 1; x < x2; x++){
		for(y = y1 + 1; y < y2; y++){
			drawPixel(image, x, y, fillColour);
		}
	}
	
}

// approximate the number of pixels in the given style measurement.
// Not my code, credit to pizzamonster on stack overflow.
function cssToPixels(cssScale) {

	var div = document.createElement('div');
	div.style.display = 'block';
	div.style.position = 'absolute';
	div.style.height = cssScale;

	document.body.appendChild(div);

	var px = parseFloat(window.getComputedStyle(div, null).height);

	div.parentNode.removeChild(div);

	return px;
}

// initial set up
function initialize(step){
	if(step == undefined) step = 'create plotter';

	switch(step){
		case 'create plotter':
			paletteGraph = new palettePlotter(document.getElementById('targetCanvas'));
			setTimeout(function(){initialize('add events');}, 0);
			break;

		case 'add events':
			paletteGraph.canvas.onmousedown = function(e){ paletteGraph.handleMouseDown(e); };

			let oldOnMouseUp = document.onmouseup == null ? function(){} : document.onmouseup;
			document.onmouseup = function(e){ paletteGraph.handleMouseUp(e); oldOnMouseUp(e)};

			let oldOnMouseMove = document.onmousemove == null ? function(){} : document.onmousemove;
			document.onmousemove = function(e){ paletteGraph.handleMouseMove(e); oldOnMouseMove(e);};

			setTimeout(function(){initialize('finish');}, 0);
			break;

		case 'finish':
			paletteGraph.update();
	}
}

