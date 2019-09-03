// let's define trim as we need it here
if(typeof trim == "undefined"){
	trim = function(stringToTrim){ return (' ' + stringToTrim).replace(/^\s+|\s+$/g,""); };
}

var cSprite = function(newTemplate){
	for(var n in cSprite.defaults){
		this[n] = cSprite.defaults[n];
	}
	// these can't be copied from csprites, or we get the same object in multiple sprites
	this.position = {x : 0, y : 0};
	this.drawOffset = {x : 0, y : 0};
	this.children = Array();

	if(newTemplate != undefined){
		this.setTemplate(newTemplate);
	}
};

cSprite.defaults = {
	template : null,
	image : null,
	scale : 1,
	zIndex : 0,
	frame: null,
	frameIndex : 0,
	frameName: null,
	frameWidth: 0,
	frameHeight: 0,
	rotation: 0,
	centerx : 0,
	centery : 0,
	currentFrame : null,
	currentSequence : null,
	currentSequenceName : null,
	animating : null,

	// parent/child sprite management variables
	numChildren : 0,
	myParent : 0
};

cSprite.prototype.setTemplate = function(template){
	this.template = template;
	this.image = template.image;
};

cSprite.prototype.setFrame = function(frameName){
	this.frameName = frameName;
	this.frame = this.template.frames[frameName];
};

cSprite.prototype.startSequence = function(sequenceName){
	if(this.template.sequences[sequenceName] != undefined){
		this.animating = true;
		this.currentSequenceName = sequenceName;
		this.currentSequence = this.template.sequences[sequenceName];
		this.frameIndex = 0; // <-- fixme, allow this to be passed as an argument to this function
		this.setFrame(this.currentSequence.frames[this.frameIndex]);
	}
};

cSprite.prototype.rotate = function(angle){
	this.rotation += angle;
};

cSprite.prototype.draw = function(context, params){
	if(params == undefined) params = {};
	var x = this.position.x + this.drawOffset.x;
	var y = this.position.y + this.drawOffset.y;
	var n;
	var drawScale = null;
	for(n in params){
		switch(n){
			case 'x': x = params[n]; break;
			case 'y': y = params[n]; break;
			case 'scale' : drawScale = params[n]; break;
		}
	}
	context.save();
	context.translate(x, y);
	context.rotate(this.rotation);

	if(drawScale == null){
		drawScale = this.scale;
	}
	context.scale(drawScale, drawScale);
	if(this.frame != null) context.translate(-this.frame.centerx, -this.frame.centery);

	for(n = 0; n < this.numChildren; n++){
		if(this.children[n].zIndex > this.zIndex){
			this.children[n].draw(context);
		}
	}
	if(this.frame != null){
		context.drawImage(
			this.image,
			this.frame.x + 0.5, this.frame.y + 0.5,
			this.frame.width - 1, this.frame.height - 1,
			0, 0,
			this.frame.width, this.frame.height
		);
	}

	for(n = 0; n < this.numChildren; n++){
		if(this.children[n].zIndex <= this.zIndex){
			this.children[n].draw(context);
		}
	}

	if(this.animating){
		this.frameIndex = (this.frameIndex + 1) % this.currentSequence.frames.length;
		this.frameName = this.currentSequence.frames[this.frameIndex];
		this.setFrame(this.frameName);
	}
	context.restore();
};

cSprite.prototype.setScale = function(newScale){
	this.scale = newScale;
	/*
	this.centerx = this.centery = 0;
	if(this.frame != undefined){
		this.centerx = this.frame.centerx;
		this.centery = this.frame.centery;
	}

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
	*/
};

cSprite.prototype.setPosition = function(x, y, useScale){
	this.centerx = this.centery = 0;
	var offset = {'x' : 0, 'y' : 0};
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
};

// parent/child sprite management functions
cSprite.prototype.detach = function(oldChild){
	if(oldChild == undefined){
		// separate this sprite from it's parent
		if(this.myParent) this.myParent.detach(this);
	}else{
		// separate the specified child from it's parent
		var foundit = false;
		for(var n in this.children){
			if(this.children[n] == oldChild){
				foundit = true;
			}else if(foundit){
				this.children[n - 1] = this.children[n];
			}
		}
		if(foundit){
			this.numChildren--;
			this.children[this.numChildren].myParent = 0;
			this.children[this.numChildren] = null;
		}
	}
};

cSprite.prototype.attach = function(newChild){
	newChild.detach();
	newChild.myParent = this;
	this.children[this.numChildren] = newChild;
	this.numChildren++;
};

cSprite.prototype.attachTo = function(newParent){
	this.detach();
	newParent.attach(this);
};

cSprite.prototype.doSequenceStep = function(params){
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

	if(params.currentFrame == undefined){
		params.currentFrame = 0;
	}

	this.setFrame(params.frames[params.currentFrame]);
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


////////////////////////////////////////////////////////////////////////////////////

var spriteSet = function(filename, callback){

	for(var n in spriteSet.defaults){
		this[n] = spriteSet.defaults[n];
	}

	if(filename != undefined){
		this.load(filename, callback);
	}

}

spriteSet.defaults = {
	frames : [],
	frameNames : [],
	sequences : {},
	defaultFrameRate : 40,
	centerx : 0,
	centery : 0,
	image : null,
	scale : 1
};

spriteSet.prototype.newSprite = function(){
	return new cSprite(this);
};

spriteSet.prototype.setScale = function(scale){
	this.scale = scale;
}

spriteSet.prototype.load = function(fileName, callback){
	var me = this;
	if(typeof(fileName) == 'object'){
		// this allows passing in a raw json object instead of a file
		me.loadJSON(fileName, callback);
	} else {
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
	}
};

spriteSet.prototype.addFrame = function(id, params){
	var parts, arg, val, n;
	var newFrame = {
		'x': 0,
		'y': 0,
		'width': this.frameWidth,
		'height': this.frameHeight,
		'centerx': this.centerx,
		'centery': this.centery
	};
	for(n in params){
		switch(trim(n).toLowerCase()){
			case 'width': case 'height':
				newFrame[n] = 1 * params[n];
				break;
			case 'x': case 'left':
				newFrame['x'] = 1 * newFrame['x'] + 1 * params[n];
				break;
			case 'xoffset':
				newFrame['x'] = 1 * newFrame['x'] + 1 * params[n];
				break;
			case 'y': case 'top':
				newFrame['y'] = 1 * newFrame['y'] + 1 * params[n];
				break;
			case 'yoffset':
				newFrame['y'] = 1 * newFrame['y'] + 1 * params[n];
				break;
			case 'centerx': case 'cx':
				newFrame['centerx'] = 1 * params[n];
				break;
			case 'centery': case 'cy':
				newFrame['centery'] = 1 * params[n];
				break;
		}
	}
	this.frames[id] = newFrame;
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

spriteSet.prototype.setFrameSize = function(w, h){
	this.frameWidth = w;
	this.frameHeight = h;
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
				case 'drawoffset':
					this.frames[name]['drawOffset'] = data[name][arg];
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
