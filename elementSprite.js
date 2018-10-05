function trim(stringToTrim) {
	// make sure it is indeed a string:
	stringToTrim = ' ' + stringToTrim;
	return stringToTrim.replace(/^\s+|\s+$/g,"");
}

var spriteClass = function(set){
	this.set = set;
	for(var n in spriteClass.defaults){
		this[n] = spriteClass.defaults[n];
	}
	if(set.image){
		this.image = set.image.cloneNode();
	}else{
		throw "spriteClass: Set has no image defined";
	}
	this.element = document.createElement('div');

	this.imageWidth = this.image.width;
	this.imageHeight = this.image.height;

	this.image.style.position = 'absolute';
	this.image.style.left = this.position.x;
	this.image.style.top = this.position.y;

	this.element.appendChild(this.image);

	
	this.element.style.position = 'absolute';
	this.element.style.width =  this.frameWidth + 'px';
	this.element.style.height = this.frameHeight + 'px';
	this.element.style.left = this.position.x + 'px';
	this.element.style.top = this.position.y + 'px';
	this.element.style.overflow = 'hidden';

	this.setFrameSize(this.set.frameWidth, this.set.frameHeight);

};

spriteClass.defaults = {
	frame: null,
	frameWidth: 0,
	frameHeight: 0,
	position: {x : 0, y : 0},
	rotation: 0,
	centerx : 0,
	centery : 0,
	currentFrame : null,
	currentSequence : null
};

spriteClass.prototype.rotate = function(angle){
	this.rotation += angle;
	this.element.style.transform = 'rotate(' + this.rotation + 'rad)';
}

spriteClass.prototype.detach = function(){
	this.element.parentNode.removeChild(this.element);
}

spriteClass.prototype.setFrame = function(framename){
	framename = trim(framename).toLowerCase();

	if(this.set.frames[framename] != undefined){
		this.frame = this.set.frames[framename];
		this.currentFrame = framename;
		this.setFrameSize(this.frame.width * this.scale, this.frame.height * this.scale);
		this.refreshFrame();
	}
};

// draws an random zone of the sprite's image, ignoring frames
spriteClass.prototype.drawRandomArea = function(target, drawx, drawy, width, height){
	
	width *= 1;
	width = width > this.imageWidth ? this.imageWidth : (width < 0 ? 0 : width);

	height *= 1;
	height = height > this.imageHeight ? this.imageHeight : (height < 0 ? 0 : height);

	if(width == 0 || height == 0) return;

	var x = Math.floor(Math.random() * (this.imageWidth - width));
	var y = Math.floor(Math.random() * (this.imageHeight - height));

	this.drawArea(target, drawx, drawy, x, y, width, height);

};

spriteClass.prototype.drawArea = function(target, drawx, drawy, x, y, width, height){
	var style = {
		'width' :  width * this.scale + 'px',
		'height' : height * this.scale + 'px',
		'overflow' : 'hidden',
		'position' : 'absolute',
		'display' : 'inline-block',
		'left' : drawx + 'px',
		'top' : drawy + 'px'
	};

	if(this.rotation != 0){
		style.transform = "rotate(" + this.rotation + "rad)";
	}
	
	var picture = document.createElement('div');
	var img = this.image.cloneNode();
	for(var n in style){
		picture.style[n] = style[n];
	}
	picture.appendChild(img);
	img.style.position = 'absolute';
	img.style.width = this.image.width * this.scale + 'px';
	img.style.height = this.image.height * this.scale + 'px';
	img.style.left = -(x * this.scale) + 'px';
	img.style.top = -(y * this.scale) + 'px';

	target.appendChild(picture);
}


spriteClass.prototype.drawFrame = function(target, framename, drawx, drawy){
	if(this.set.frames[framename] == undefined) return false;
	var frame = this.set.frames[framename];
	var style = {
		'width' : frame.width * this.scale + 'px',
		'height' : frame.height * this.scale + 'px',
		'overflow' : 'hidden'
	};
	if(drawx == undefined && drawy == undefined){
		style['position'] = 'relative';
		style['display'] = 'inline-block';
	}else{
		if(drawx == undefined) drawx = 0;
		if(drawy == undefined) drawy = 0;
		style['left'] = drawx + 'px';
		style['top'] = drawy + 'px';
		style['position'] = 'absolute';
	}
	
	var picture = document.createElement('div');
	var img = this.image.cloneNode();
	for(var n in style){
		picture.style[n] = style[n];
	}
	picture.appendChild(img);
	img.style.position = 'absolute';
	img.style.width = this.image.width * this.scale + 'px';
	img.style.height = this.image.height * this.scale + 'px';
	img.style.left = -(frame.x * this.scale) + 'px';
	img.style.top = -(frame.y * this.scale) + 'px';

	target.appendChild(picture);
	return picture;
};


spriteClass.prototype.setFrameSize = function(w, h){
	this.frameWidth = w;
	this.frameHeight = h;
	this.element.style.width = this.frameWidth + 'px';
	this.element.style.height = this.frameHeight + 'px';
};


spriteClass.prototype.refreshFrame = function(){
	this.image.style.position = 'absolute';
	this.image.style.left = -(this.frame.x * this.scale) + 'px';
	this.image.style.top = -(this.frame.y * this.scale) + 'px';
};

spriteClass.prototype.drawFrame = function(target, framename, drawx, drawy){
	if(this.set.frames[framename] == undefined) return false;
	var frame = this.set.frames[framename];
	var style = {
		'width' : frame.width * this.scale + 'px',
		'height' : frame.height * this.scale + 'px',
		'overflow' : 'hidden'
	};
	if(this.rotation != 0){
		style.transform = "rotate(" + this.rotation + "rad)";
	}
	if(drawx == undefined && drawy == undefined){
		style['position'] = 'relative';
		style['display'] = 'inline-block';
	}else{
		if(drawx == undefined) drawx = 0;
		if(drawy == undefined) drawy = 0;
		style['left'] = drawx + 'px';
		style['top'] = drawy + 'px';
		style['position'] = 'absolute';
	}
	
	var picture = document.createElement('div');
	var img = this.image.cloneNode();
	for(var n in style){
		picture.style[n] = style[n];
	}
	picture.appendChild(img);
	img.style.position = 'absolute';
	img.style.width = this.image.width * this.scale + 'px';
	img.style.height = this.image.height * this.scale + 'px';
	img.style.left = -(frame.x * this.scale) + 'px';
	img.style.top = -(frame.y * this.scale) + 'px';

	target.appendChild(picture);
	return picture;
};

spriteClass.prototype.setScale = function(newScale){
	this.centerx = this.centery = 0;
	if(this.frame != undefined){
		this.centerx = this.frame.centerx;
		this.centery = this.frame.centery;
	}
	this.scale = newScale;

	// also need to adjust our element's position, as that will be
	// dependent on scale when we have a center point other than 0,0
	this.element.style.left = (this.position.x - this.centerx * this.scale) + 'px';
	this.element.style.top = (this.position.y - this.centery * this.scale) + 'px';
	
	this.image.style.width = this.image.width * this.scale + 'px';
	this.image.style.height = this.image.height * this.scale + 'px';

	if(this.frame != undefined){
		this.setFrameSize(this.frame.width * this.scale, this.frame.height * this.scale);
		this.refreshFrame();
	}else{
		this.element.style.width = this.image.width * this.scale + 'px';
		this.element.style.height = this.image.height * this.scale + 'px';
	}
};

spriteClass.prototype.appendTo = function(target){
	target.appendChild(this.element);
};

spriteClass.prototype.prependTo = function(target){
	//target.prepend(this.element);
	target.insertBefore(this.element, target.firstChild);
};

spriteClass.prototype.setPosition = function(x, y, useScale){
	this.centerx = this.centery = 0;

	this.position.x = x;
	this.position.y = y;
	if(useScale){
		this.position.x *= this.scale;
		this.position.y *= this.scale;
	}
	if(this.frame != undefined){
		this.centerx = this.frame.centerx;
		this.centery = this.frame.centery;
	}
	this.element.style.left = (this.position.x - this.centerx * this.scale) + 'px';
	this.element.style.top = (this.position.y - this.centery * this.scale) + 'px';
};

spriteClass.prototype.startSequence = function(sequenceName, params){
	var n, callback, frameRate, sequence, iterations, newParams;

	if(this.set.sequences[sequenceName] == undefined) return false;
	newParams = {
		frames: this.set.sequences[sequenceName].frames,
		frameRate: this.set.sequences[sequenceName].frameRate,
		callback: function(){},
		stepCallback: function(){},
		iterations: 1, // how many times it should repeat.  0 means infinitely
		currentFrame: 0,
		stop: false,
		method: 'auto', // <-- 'auto' means the animation happens automatically.  'manual' means the doSequenceStep function has to be called for each step in the sequence
		sequence: sequenceName
	};

	if(params != undefined){
		for(n in params){
			switch(trim(n).toLowerCase()){
				case 'framerate':
					newParams.frameRate = params[n];
					break;
				case 'callback':
					newParams.callback = params[n];
					break;
				case 'iterations':
					newParams.iterations = params[n];
					break;
				case 'stepcallback':
					newParams.stepCallback = params[n];
					break;
				case 'frametimes':
					newParams.frameTimes = params[n];
					newParams.currentFrameTime = 0;
					break;
				case 'method':
					newParams.method = params[n];
					break;
				case 'startframe':
					newParams.currentFrame = params[n];
					break;
			}
		}
	}
	this.currentSequence = newParams;
	if(newParams.method == 'auto')
		this.doSequenceStep();
	return newParams;
};

// kill the current sequence
spriteClass.prototype.stopSequence = function(docallback){
	if(this.currentSequence == null) return;
	this.currentSequence.stop = true;
	if(docallback == true){
		this.currentSequence.callback();
	}
};

// make this iteration of the sequence it's final iteration, adding a new callback if desired
spriteClass.prototype.finishSequence = function(callback){
	this.currentSequence.iterations = 1;
	if(callback != undefined){
		var oldCallback = this.currentSequence.callback;
		var newCallback = function(){
			oldCallback();
			callback();
		}
		this.currentSequence.callback = newCallback;
	}
};


spriteClass.prototype.doSequenceStep = function(params){
	if(params == undefined){
		if(this.currentSequence != undefined){
			params = this.currentSequence;
		}else{
			return;
		}
	}
	if(!params || params.stop == true){
		return;
	}

	var doNextFrame = (params.method == 'auto');
	var animDelay = params.frameRate;

	if(params.frameTimes != undefined){
		animDelay = params.frameTimes[params.currentFrameTime];
		params.currentFrameTime = (params.currentFrameTime + 1) % params.frameTimes.length;
	}

	this.setFrame(params.frames[params.currentFrame]);
	params.stepCallback();
	params.currentFrame++;
	
	if(params.currentFrame == params.frames.length){
		if(params.iterations == 1){
			doNextFrame = false;
			this.currentSequence = null;
			params.callback();
		}else if(params.iterations == 0){
			params.currentFrame = 0;
			this.currentSequence = params;
		}else{
			params.currentFrame = 0;
			params.iterations--;
			this.currentSequence = params;
		}
	}
	if(doNextFrame){
		var me = this;
		setTimeout(function(){me.doSequenceStep(params)}, animDelay);
	}
	return params;
};

////////////////////////////////////////////////////////////////////////

var spriteSet = function(){
	for(var n in spriteSet.defaults){
		this[n] = spriteSet.defaults[n];
	}
	if(arguments.length > 0){
		this.load.apply(this, arguments);
	}
};

spriteSet.defaults = {
	frames : [],
	frameNames : [],
	sequences : {},
	defaultFrameRate : 40,
	centerx : 0,
	centery : 0,
	loadingImage : false,
	image : null,
	scale : 1
};

spriteSet.prototype.setScale = function(scale){
	this.scale = scale;
}

spriteSet.prototype.load = function(fileName, callback){
	var me = this;
	var loc = window.location.pathname;
	var dir = loc.substring(0, loc.lastIndexOf('/'));
	var client = new XMLHttpRequest();

	client.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {

			try{
				data = JSON.parse(this.responseText);
				me.loadJSON(data, callback);

			}catch(e){
				throw "spriteSet::load: " + e;
			}
		}
	}
	client.open('GET', dir + '/' + fileName);
	client.send();

};

// This overly complicated argument processing allows us to go through each
// argument and wait for it to be processed.  The big advantage here is that we
// can simply wait for an image to be fully loaded before returning the
// callback.  Using a callback on each call to this function allows this
// without getting a huge call stack.
spriteSet.prototype.loadJSON = function(data, callback){
	var me = this;
	var key = Object.keys(data)[0];
	var rfunc;

	if(key != undefined){
		val = data[key];
		delete data[key];
		rfunc = function(){setTimeout(me.loadJSON(data, callback), 0);};
		switch(key){
			case 'image':
				this.setImage(val, rfunc);
				break;
			case 'frameWidth': case 'framewidth':
				this.frameWidth = 1 * val;
				rfunc();
				break;
			case 'frameHeight': case 'frameheight':
				this.frameHeight = 1 * val;
				rfunc();
				break;
			case 'centerx': case 'cx':
				this.centerx = 1 * val;
				rfunc();
				break;
			case 'centery': case 'cy':
				this.centery = 1 * val;
				rfunc();
				break;
			case 'framerate':
				this.defaultFrameRate = 1 * val;
				rfunc();
				break;
			case 'frames':
				this.load_frames(val);
				rfunc();
				break;
			case 'sequences':
				this.load_sequences(val);
				rfunc();
				break;
			default:
				rfunc();
		}
	}else if(callback != undefined){
		callback.call(this, data);
	}
};

// load animation sequences from a JSON object
spriteSet.prototype.load_sequences = function(data){
	var name, param, newSequence, n;

	for(name in data){
		newSequence = {
			'name': name,
			'frames':[],
			'frameRate': this.defaultFrameRate
		};
		for(param in data[name]){
			switch(param){
				case 'frames':
					for(n = 0; n < data[name][param].length; n++){
						newSequence.frames[n] = data[name][param][n];
					}
					break;
				case 'framerate': case 'frameRate':
					newSequence.frameRate = 1 * data[name][param];
					break;
			}
		}
		this.sequences[newSequence.name] = newSequence;
	}
};

// load frames from a JSON object passed in
spriteSet.prototype.load_frames = function(data){
	var name, arg;
	for(name in data){
		this.frames[name] = {
			'x': 0,
			'y': 0,
			'width': this.frameWidth,
			'height': this.frameHeight,
			'centerx': this.centerx,
			'centery': this.centery
		};
		this.frameNames[this.frameNames.length] = name;
		for(arg in data[name]){
			switch(arg){
				case 'width': case 'height':
					this.frames[name][arg] = 1 * data[name][arg];
					break;
				case 'x':
					this.frames[name]['x'] += this.frameWidth * data[name][arg];
					break;
				case 'xoffset':
					this.frames[name]['x'] += 1 * data[name][arg];
					break;
				case 'y':
					this.frames[name]['y'] += this.frameHeight * data[name][arg];
					break;
				case 'yoffset':
					this.frames[name]['y'] += 1 * data[name][arg];
					break;
				case 'centerx': case 'cx':
					this.frames[name]['centerx'] = 1 * data[name][arg];
					break;
				case 'centery': case 'cy':
					this.frames[name]['centery'] = 1 * data[name][arg];
					break;
				
			}
		}
	}
};

spriteSet.prototype.setImage = function(filename, callback){
	this.image = new Image();
	if(typeof(callback) == 'function'){
		this.image.onload = callback;
	}
	this.image.src = filename;
};
