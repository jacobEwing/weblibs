
var randomTextCache = [], randomTextCount = 0;
// returns "numChars" random characters that have not been returned previously
function randomText(numChars){
	var n, c, i;
	var returnval = '';

	// note: this will cause an infinite loop if more than 26^numChars strings are asked for. 
	do{
		for(n = 0; n < numChars; n++){
			i = Math.round(Math.random() * 25);
			c = String.fromCharCode(65 + i);
			returnval = returnval + c;
		}
		inUse = false;
		for(n = 0; n < randomTextCount; n++){
			if(randomTextCache[n] == returnval){
				inUse = true;
				break;
			}
		}
	}while(inUse);
	randomTextCache[randomTextCount] = returnval;
	randomTextCount++;
	return returnval;
}

// an object allowing global references to objects
var globalRefs = {
	refs: [],
	add: function(obj){
		var tag = randomText(8);
		this.refs[tag] = obj;
		return tag;
	},
	get: function(tag){
		return this.refs[tag];
	}
};

// tell me if it's an array
function is_array(input){
	return typeof(input)=='object'&&(input instanceof Array);
}

// precede backslash characters and double quotes with backslash characters
function parseQuotes(text){
	if(text == undefined) return text;

	returnval = text.replace(/\\/g, '\\\\');
	returnval = returnval.replace(/\"/g, '\\"');
	return returnval;
}

function in_array(needle, haystack) {
	var length = haystack.length;
	for(var n = 0; n < length; n++) {
		if(haystack[n] == needle) return true;
	}
	return false;
}


function write(text, style, useBreak){
	if(style == undefined) style = 'font-weight:bold; color:#FFF';
	if(useBreak == undefined) useBreak = true;

	_console = $('#console');
	_console.append('<span style="' + style + '">' + text + '</span>');
	if(useBreak) _console.append('<br/>');
	h1 = _console.innerHeight();
	h2 = _console.attr('scrollHeight');
	_console.scrollTop(h2 - h1);
}

function error(text){
	write('[ERROR]: ' + text, "font-weight: bold; color: #F55");
}

function popup(message, lockscreen){
	if(lockscreen == undefined) lockscreen = true;
	var messageDiv = $('<div style="text-align:center"></div>');

	messageDiv.append(message);

	messageDiv.dialog({
		modal: true,
		resizable: false,
		close: function() { 
			$(this).remove();
		},
		buttons: {
			"Close": function() { 
				$(this).dialog("close");
//				$(this).remove();
			}
		}
	});

}
