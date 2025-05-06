var GFX = function(){
	this.canvas = null;
	this.scale = 1;
	this.area = {
		width : 320,
		height : 200
	};

	if(typeof arguments[0] == 'object'){
		let params = arguments[0];
		for(let n in params){
			switch(String(n).toLowerCase()){
				case 'canvas':
					this.canvas = params[n];
					break;

				case 'width':
					this.area.width = parseInt(params[n]);
					if(this.area.width <= 0){
						throw "GFX: Invalid width argument \"" + params[n] + "'\'";
					}
					break;

				case 'height':
					this.area.height = parseInt(params[n]);
					if(this.area.height <= 0){
						throw "GFX: Invalid height argument \"" + params[n] + "'\'";
					}
					break;

				case 'scale':
					this.scale = parseInt(params[n]);
					if(this.scale < 1){
						throw "GFX: canvas scale must be greater than 1";
					}
					
			}
		}
		
	};
	if(this.canvas == null){
		this.canvas = document.createElement('canvas');
	}
	this.setScale(this.scale);
	this.canvas.width = this.area.width;
	this.canvas.height = this.area.height;
	this.context = this.canvas.getContext('2d');
	this.context.webkitImageSmoothingEnabled = false;
	this.context.mozImageSmoothingEnabled = false;
	this.context.imageSmoothingEnabled = false; /// future
	this.map = new ImageData(this.canvas.width, this.canvas.height);
}

GFX.prototype.update = function(){
	this.context.putImageData(this.map, 0, 0);
}

GFX.prototype.setScale = function(scale){
	this.scale = scale;
	this.canvas.style.scale = scale;
}

GFX.prototype.clear = function(){
	this.map = new ImageData(this.canvas.width, this.canvas.height);
}

GFX.prototype.mcgaMap = [ 
	0x000000, 0x0000AA, 0x00AA00, 0x00AAAA, 0xAA0000, 0xAA00AA, 0xAA5500, 0xAAAAAA,
	0x555555, 0x5555FF, 0x55FF55, 0x55FFFF, 0xFF5555, 0xFF55FF, 0xFFFF55, 0xFFFFFF,
	0x000000, 0x101010, 0x202020, 0x353535, 0x454545, 0x555555, 0x656565, 0x757575,
	0x8A8A8A, 0x9A9A9A, 0xAAAAAA, 0xBABABA, 0xCACACA, 0xDFDFDF, 0xEFEFEF, 0xFFFFFF,
	0x0000FF, 0x4100FF, 0x8200FF, 0xBE00FF, 0xFF00FF, 0xFF00BE, 0xFF0082, 0xFF0041,
	0xFF0000, 0xFF4100, 0xFF8200, 0xFFBE00, 0xFFFF00, 0xBEFF00, 0x82FF00, 0x41FF00,
	0x00FF00, 0x00FF41, 0x00FF82, 0x00FFBE, 0x00FFFF, 0x00BEFF, 0x0082FF, 0x0041FF,
	0x8282FF, 0x9E82FF, 0xBE82FF, 0xDF82FF, 0xFF82FF, 0xFF82DF, 0xFF82BE, 0xFF829E,
	0xFF8282, 0xFF9E82, 0xFFBE82, 0xFFDF82, 0xFFFF82, 0xDFFF82, 0xBEFF82, 0x9EFF82,
	0x82FF82, 0x82FF9E, 0x82FFBE, 0x82FFDF, 0x82FFFF, 0x82DFFF, 0x82BEFF, 0x829EFF,
	0xBABAFF, 0xCABAFF, 0xDFBAFF, 0xEFBAFF, 0xFFBAFF, 0xFFBAEF, 0xFFBADF, 0xFFBACA,
	0xFFBABA, 0xFFCABA, 0xFFDFBA, 0xFFEFBA, 0xFFFFBA, 0xEFFFBA, 0xDFFFBA, 0xCAFFBA,
	0xBAFFBA, 0xBAFFCA, 0xBAFFDF, 0xBAFFEF, 0xBAFFFF, 0xBAEFFF, 0xBADFFF, 0xBACAFF,
	0x000071, 0x1C0071, 0x390071, 0x550071, 0x710071, 0x710055, 0x710039, 0x71001C,
	0x710000, 0x711C00, 0x713900, 0x715500, 0x717100, 0x557100, 0x397100, 0x1C7100,
	0x007100, 0x00711C, 0x007139, 0x007155, 0x007171, 0x005571, 0x003971, 0x001C71,
	0x393971, 0x453971, 0x553971, 0x613971, 0x713971, 0x713961, 0x713955, 0x713945,
	0x713939, 0x714539, 0x715539, 0x716139, 0x717139, 0x617139, 0x557139, 0x457139,
	0x397139, 0x397145, 0x397155, 0x397161, 0x397171, 0x396171, 0x395571, 0x394571,
	0x515171, 0x595171, 0x615171, 0x695171, 0x715171, 0x715169, 0x715161, 0x715159,
	0x715151, 0x715951, 0x716151, 0x716951, 0x717151, 0x697151, 0x617151, 0x597151,
	0x517151, 0x517159, 0x517161, 0x517169, 0x517171, 0x516971, 0x516171, 0x515971,
	0x000041, 0x100041, 0x200041, 0x310041, 0x410041, 0x410031, 0x410020, 0x410010,
	0x410000, 0x411000, 0x412000, 0x413100, 0x414100, 0x314100, 0x204100, 0x104100,
	0x004100, 0x004110, 0x004120, 0x004131, 0x004141, 0x003141, 0x002041, 0x001041,
	0x202041, 0x282041, 0x312041, 0x392041, 0x412041, 0x412039, 0x412031, 0x412028,
	0x412020, 0x412820, 0x413120, 0x413920, 0x414120, 0x394120, 0x314120, 0x284120,
	0x204120, 0x204128, 0x204131, 0x204139, 0x204141, 0x203941, 0x203141, 0x202841,
	0x2D2D41, 0x312D41, 0x352D41, 0x3D2D41, 0x412D41, 0x412D3D, 0x412D35, 0x412D31,
	0x412D2D, 0x41312D, 0x41352D, 0x413D2D, 0x41412D, 0x3D412D, 0x35412D, 0x31412D,
	0x2D412D, 0x2D4131, 0x2D4135, 0x2D413D, 0x2D4141, 0x2D3D41, 0x2D3541, 0x2D3141,
	0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000, 0x000000
];

GFX.prototype.MCGAColour = (function(){

	return function(idx){
		if(idx < 0 || idx >= this.mcgaMap.length){
			throw 'GFX.MCGAColour: Invalid colour index: ' + idx;
		}
		return {
			red : this.mcgaMap[idx] & 255,
			green : this.mcgaMap[idx] >> 8 & 255,
			blue : this.mcgaMap[idx] >> 16,
			alpha : 255
		};
	}

})();

GFX.prototype.putPixel = function (x, y, colour, mode, map) {
	if(map == undefined) map = this.map;
	const index = (y * map.width + x) * 4;

	if(index < 0 || index >= map.data.length - 3) return;

	// Allowing for mcga palette. Otherwise an RGBA value is expected
	if(typeof colour == 'number'){
		colour = this.MCGAColour(colour);
	}

	map.data[index + 0] = colour.red;
	map.data[index + 1] = colour.green;
	map.data[index + 2] = colour.blue;
	map.data[index + 3] = colour.alpha;
}

GFX.prototype.line = function(x1, y1, x2, y2, colourIndex, mode, map){
	let dx = x2 - x1;
	let dy = y2 - y1;
	let absDX = dx < 0 ? -dx : dx;
	let absDY = dy < 0 ? -dy : dy;
	let sgnDX = dx < 0 ? -1 : 1;
	let sgnDY = dy < 0 ? -1 : 1;
	let tally = 0;
	let x = x1;
	let y = y1;
	if(map == undefined) map = this.map;

	this.putPixel(x, y, colourIndex, mode, map);
	if(absDX > absDY){
		while(x != x2){
			x += sgnDX;
			tally += absDY;
			if(tally >= absDX){
				y += sgnDY;
				tally -= absDX;
			}
			this.putPixel(x, y, colourIndex, mode, map);
		}
	}else{
		while(y != y2){
			y += sgnDY;
			tally += absDX;
			if(tally >= absDY){
				x += sgnDX;
				tally -= absDY;
			}
			this.putPixel(x, y, colourIndex, mode, map);
		}
	}
}

// draw a vertical line
GFX.prototype.vLine = function(x, y1, y2, colour, mode, map){
	if(map == undefined) map = this.map;
	if(y1 > y2){
		let swp = y1;
		y1 = y2;
		y2 = swp;
	}
	if(y2 < 0) return;
	if(y1 >= this.area.height) return;

	if(y1 < 0) y1 = 0;
	if(y2 >= this.area.height) y2 = this.area.height - 1;

	// Allowing for mcga palette. Otherwise an RGBA value is expected
	if(typeof colour == 'number'){
		colour = this.MCGAColour(colour);
	}

	var index = (y1 * map.width + x) * 4;
	var maxIndex = (y2 * map.width + x) * 4;
	do{
		map.data[index + 0] = colour.red;
		map.data[index + 1] = colour.green;
		map.data[index + 2] = colour.blue;
		map.data[index + 3] = colour.alpha;
		index += 4 * map.width;
	}while(index <= maxIndex);
}

// draw a horizontal line
GFX.prototype.hLine = function(y, x1, x2, colour, mode, map){
	if(map == undefined) map = this.map;
	if(x1 > x2){
		let swp = x1;
		x1 = x2;
		x2 = swp;
	}
	if(x2 < 0) return;
	if(x1 >= this.area.width) return;

	if(x1 < 0) y1 = 0;
	if(x2 >= this.area.width) x2 = this.area.width - 1;

	// Allowing for mcga palette. Otherwise an RGBA value is expected
	if(typeof colour == 'number'){
		colour = this.MCGAColour(colour);
	}

	var index = (y * map.width + x1) * 4;
	var maxIndex = (y * map.width + x2) * 4;
	do{
		map.data[index++] = colour.red;
		map.data[index++] = colour.green;
		map.data[index++] = colour.blue;
		map.data[index++] = colour.alpha;
	}while(index <= maxIndex);
}


GFX.prototype.circle = function(x0, y0, radius, colour) {
	var x = radius;
	var y = 0;
	var err = 0;

	while (x >= y) {
		this.putPixel(x0 + x, y0 + y, colour);
		this.putPixel(x0 + y, y0 + x, colour);
		this.putPixel(x0 - y, y0 + x, colour);
		this.putPixel(x0 - x, y0 + y, colour);
		this.putPixel(x0 - x, y0 - y, colour);
		this.putPixel(x0 - y, y0 - x, colour);
		this.putPixel(x0 + y, y0 - x, colour);
		this.putPixel(x0 + x, y0 - y, colour);

		y += 1;
		err += 1 + 2*y;
		if (2*(err-x) + 1 > 0) {
			x -= 1;
			err += 1 - 2*x;
		}
	}
}

GFX.prototype.fillCircle = function(x0, y0, radius, colour) {
	var f = 1 - radius;
	var ddF_x = 0;
	var ddF_y = -2 * radius;
	var x = 0;
	var y = radius;

	var delta = 0;
	while (x < y) {
		this.vLine(x0 + x, y0 + y, y0 + delta, colour);
		this.vLine(x0 - x, y0 + y, y0 + delta, colour);

		this.vLine(x0 + x, y0 - y, y0 - delta , colour);
		this.vLine(x0 - x, y0 - y, y0 - delta, colour);

		this.hLine(y0 + x, x0 + y, x0 + delta, colour);
		this.hLine(y0 + x, x0 - y, x0 - delta, colour);

		this.hLine(y0 - x, x0 + y, x0 + delta, colour);
		this.hLine(y0 - x, x0 - y, x0 - delta, colour);

		delta += 1;
		if (f >= 0) {
			y--;
			ddF_y += 2;
			f += ddF_y;
		}
		x++;
		ddF_x += 2;
		f += ddF_x + 1;
	}
};
/*
var GFXimage = function(){
	this.source = null;
	this.width = null;
	this.height = null;
	this.canvas = null;
	if(arguments.length == 1 && typeof arguments[0] == 'object'){
		for(let param in [source, width, height, canvas]){
			if(arguments[param] != undefined){
				this[param] = arguments[param];
			}
		}
	}
};
*/
