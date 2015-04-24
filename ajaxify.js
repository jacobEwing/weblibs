function getAjaxContent(url){
	$.get(url + '?ajax=1', function(result){
		if(result.search('2e4M6u8E9i0I45i3441227P8C9d9B9p5D') >= 0){ // string in a remark in login.html, to see if we've been kicked back to the login prompt.
			var newDoc = document.open("text/html", "replace");
			newDoc.write(result);
			newDoc.close();
		}else{
			$('#pageContent').html(result);
			bindAjaxable($('#pageContent'));
			$('#rightContent').load('/right_content');
			$('#ticker_wrapper').load('/ticker?' + (new Date().getTime()));
		}
	});
}

var ajaxables = [];

function bindAjaxable(parentElement){
	var elements;
	if(typeof parentElement == 'object'){
		elements = $('.ajaxable', parentElement);
	}else{
		elements = $('.ajaxable');
	}

	elements.each(function(){
		var href = $(this).attr('href');
		ajaxables[href] = 1;
		$(this).click(function(){
			getAjaxContent(href);
			history.pushState('data', '', $(this).attr("href"));
			return false;
		});
	});

	window.onpopstate = function(event) {
		if(!event.state) return;
		if(ajaxables[window.location.pathname] != undefined){
			getAjaxContent(window.location.pathname);
		}else{
			window.location = document.location;
		}
	};

}

$(document).ready(bindAjaxable);

