// a class for listening to keyboard events on specific elements, tracking the up/down state of keys
var kbListener = function(){
	this.keyState = {};
	this.KEYMAP = {};
	this.REV_KEYMAP = {};
	this.initialize();
};

// initialize map keyboard map
kbListener.prototype.initialize = function(){
	var n, customMaps;

	// tailor the characters that vary by browser
	this.KEYMAP = {
		'UP' : 38,		'DOWN' : 40,		'LEFT' : 37,		'RIGHT' : 39,
		'ESC' : 27,		'ENTER' : 13,		'TAB' : 9,		'SPACE' : 32,
		'SHIFT' : 16,		'CTRL' : 17,		'ALT' : 18,		'PAUSE' : 19,
		'BACKSPACE' : 8,	'CAPS_LOCK' : 20,	'NUM_LOCK' : 144,	'SCROLL_LOCK' : 145,
		'PGUP' : 33,		'PGDN' : 34,		'END' : 35,
		'HOME' : 36,		'INSERT' : 45,		'DELETE' : 46,
		'TILDE' : 192,		"'" : 222,		'[' : 219,		']' : 221,
		'\\' : 220,		';' : 59,		'=' : 61,		'-' : 173,
		'META' : 91,		'MENU' : 93,
		'NUMPAD_*' : 106,	'NUMPAD_+' : 107,	'NUMPAD_-' : 109,	'NUMPAD_/' : 111,
		',' : 188,		'.' : 190

	};
	switch(true){
		case !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0:
			//opera (not yet mapped - taking a guess here)
			customMaps = {';' : 186, 	'=' : 187, 	'-' : 189, 	'PRTSCR' : 44 };
			break;
		case typeof InstallTrigger !== 'undefined': 
			//firefox
			customMaps = {';' : 59, 	'=' : 61, 	'-' : 173, 	'PRTSCR' : 42 };
			break;
		case Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0:
			//'safari
			customMaps = {';' : 186, 	'=' : 187, 	'-' : 189, 	'PRTSCR' : 44 };
			break;
		case !!window.chrome:
			// chrome
			customMaps = {';' : 186, 	'=' : 187, 	'-' : 189, 	'PRTSCR' : 42 };
			break;
		case /*@cc_on!@*/false || !!document.documentMode:
			// ie
			customMaps = {';' : 186, 	'=' : 187, 	'-' : 189, 	'PRTSCR' : 42 };
			break;
		default: 
			// unknown browser
			customMaps = {';' : 186, 	'=' : 187, 	'-' : 189, 	'PRTSCR' : 42 };
	};

	for(var character in customMaps){
		this.KEYMAP[character] = customMaps[character];
	}

	// generate the ones whose names are based on the character and which have no special variations
	for(n = 65; n < 91; n++) this.KEYMAP[String.fromCharCode(n)] = n;
	for(n = 0; n < 10; n++) this.KEYMAP[n] = 48 + n;
	for(n = 1; n <= 12; n++) this.KEYMAP['F' + n] = 111 + n;
	for(n = 0; n < 10; n++) this.KEYMAP['NUMPAD_' + n] = 96 + n;

	// now build our reverse map
	for(n in this.KEYMAP){
		this.keyState[n] = 0;
		this.REV_KEYMAP[this.KEYMAP[n]] = n;
	}
}
// this is called to listen to any element for keyboard events.  If none is specified, 'document' is defaulted to
kbListener.prototype.listen = function(element){
	if(element == undefined) element = document;

	var downfunction = function(e){
		me.keyState[e.which] = 1;
	}
	var upfunction = function(e){
		me.keyState[e.which] = 0;
	}
	var me = this;
	var oldDownListener, oldUpListener;

	if(element.onkeydown != null){
		oldDownListener = element.onkeydown;
		element.onkeydown = function(evt){
			oldDownListener(evt);
			downfunction(evt);
		}
	}else{
		element.onkeydown = downfunction;	
	}

	if(element.onkeyup != null){
		oldUpListener = element.onkeyup;
		element.onkeyup = function(evt){
			oldUpListener(evt);
			upfunction(evt);
		}
	}else{
		element.onkeyup = upfunction;	
	}
}
