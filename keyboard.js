var keyState = {};
var keyBuffer = Array();
var KEYMAP, REV_KEYMAP;

function initialize_keymap(){
	var n;
	KEYMAP = {
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
	for(n = 65; n < 91; n++) KEYMAP[String.fromCharCode(n)] = n;
	for(n = 0; n < 10; n++) KEYMAP[n] = 48 + n;
	for(n = 1; n <= 12; n++) KEYMAP['F' + n] = 111 + n;
	for(n = 0; n < 10; n++) KEYMAP['NUMPAD_' + n] = 96 + n;
	REV_KEYMAP = {};
	for(n in KEYMAP){
		keyState[n] = 0;
		REV_KEYMAP[KEYMAP[n]] = n;
	}
}

function keyupCall(e){
	keyState[e.which] = 0;
	handleKey(e.which, 0); return false;
}

function keydownCall(e){
	keyState[e.which] = 1;
	handleKey(e.which, 1); return false;
}

$(document).ready(function(){
	initialize_keymap();
	$(document).keydown(keydownCall);
	$(document).keyup(keyupCall);
});

function handleKey(id, state){
}
