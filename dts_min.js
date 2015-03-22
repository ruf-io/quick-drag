var QD_EXT = (function () {
	//CONSTANTS
	var MOUSE_CHECK_FREQUENCY = 10,
	DRAG_THRESHOLD = 50,
	STAGGER = 50,
	BUTTON_HEIGHT = 70,

	//VARIABLES
	qd_settings = {},
	internal_drag = false,
	external_dragging = false,
	gesture_stage = 0,
	last_mm = +new Date,
	sidebar_visible = false,
	sc = [],
	buttons = [],
	buttonRemoveTimeout = null,
	//button_cache = null,	TODO - SEE IF JUST ADDING ONE PARENT ELEMENT THAT ENCAPSULATES ALL BUTTONS IS ANY FASTER

	//INIT PRIVATE FUNCTIONS
	_dragMonitor, _removeHTML, _animate, _showSidebar, _hideSidebar, _gestures, _sendMessage, _makeNotifier;
	
	//PRIVATE FUNCTIONS
	_dragMonitor = function(e, gesture) {
		_removeHTML("cancel");
		buttons.map( function (button, i) {
			button.className = "qd_droppable";
			document.body.appendChild(button);
		});
		sc = [e.screenX, e.screenY];
		dragging = e.target;
		if (gesture === "override") {
			_showSidebar();
		}
		else {
			window.ondrag = _gestures[gesture];
		}
	};

	//REMOVE (OR CANCEL THE REMOVAL) OF BUTTONS
	_removeHTML = function(type) {
		if(type === "cancel") {
			window.setTimeout(function() {
				window.clearTimeout(buttonRemoveTimeout);
			}, 50);
		else {
			buttonRemoveTimeout = window.setTimeout(function() {
				buttons.map(function(button, i) {
					document.body.removeChild(button);
				});
			}, 1000);
		}
	};

	//ANIMATE THE BUTTONS
	_animate = function(el, direction, delay, callback){
		window.setTimeout(function(){
			el.className = 'qd_droppable';
			el.classList.add(direction);
			if(callback) {
				window.setTimeout(function() {
					callback();
				}, 500);
			}
		}, delay);
	};

	//SLIDE IN THE SIDEBAR BUTTONS
	_showSidebar = function() {
		if(!sidebar_visible) {
			sidebar_visible = true;
			buttons.map(function(button, i) {
				_animate(button, "qd_in", i*STAGGER);
			});
		}
	};

	//SLIDE OUT THE SIDEBAR AND REMOVE
	_hideSidebar = function() {
		if(sidebar_visible) {
			sidebar_visible = false;
			buttons.map(function(button, i) {
				if(!button.classList.contains('over')) {
					_animate(button, "qd_out", i*STAGGER);
				}
			});
		}
	};

	//USER SELECTS FROM MULTIPLE GESTURE OPTIONS
	_gestures = {
		'up-right': function(e) {
				if (gesture_stage === 0 && sc[1] - e.screenY > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1])/(e.screenX - sc[0])) > 2) {
					gesture_stage = 1;
					sc = [e.screenX, e.screenY];
				}
				else if (gesture_stage === 1 && e.screenX - sc[0] > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1]+50)/(e.screenX - sc[0])) < 0.5) {
					_showSidebar();
					window.ondrag = null;
				}
				return true;
		},
		'right':  function(e) {
				if ( e.screenX - sc[0] > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1]+50)/(e.screenX - sc[0])) < 0.5) {
					_showSidebar();
					window.ondrag = null;
				}
				return true;
		},
		'vertical-right':  function(e) {
				if (gesture_stage === 0 && Math.abs(sc[1] - e.screenY) > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1])/(e.screenX - sc[0])) > 2) {
					gesture_stage = 1;
					sc = [e.screenX, e.screenY];
				}
				else if (gesture_stage === 1 && e.screenX - sc[0] > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1]+50)/(e.screenX - sc[0])) < 0.5) {
					_showSidebar();
					window.ondrag = null;
				}
				return true;
		}
	};

	_sendMessage = function(dragged, dropped) {
		if (dragged.tagName in qd_settings.draggable_elements && qd_settings.draggable_elements[dragged.tagName]) {
			_removeHTML("cancel");
			//BUILD DATA OBJECT TO SEND
			chrome.runtime.sendMessage({
				target:dropped.id,
				type:dragged.tagName.toLowerCase(),
				url:(dragged.src || dragged.href || ""),
				description:(dragged.getAttribute('alt') || dragged.getAttribute('title') || dragged.tagName + " from " + window.location.host),
				page_domain:window.location.host,
				page_protocol:window.location.protocol,
				page_url:window.location.href
			}, _makeNotifier(dropped));
			dropped.innerText = "Sending...";
			//FLOAT BOX TO TOP
			var float_top = parseInt(dropped.style['margin-top'].replace('px'), 10),
				position = float_top;
			window.setTimeout( function() {
				var _animateToTop = window.setInterval(function(){
					position = position/1.5;
					dropped.style.top = "-" + Math.round(float_top-position, 0) + "px";
					if(position < 1) window.clearInterval(_animateToTop);
				}, 35);
			}, 300);
		}
	};

	_makeNotifier = function(dropped) {
		return function(response) {
			dropped.innerText = response.alert || "Complete";
			dropped.classList.add(response.success ? 'success' : 'failure');
			_animate(dropped, "qd_out", 600, function() {
				dropped.style.top = null;
				dropped.innerText = dropped.getAttribute('data-default-name');
				_removeHTML();
			});
		};
	}

	return {
		initialize:function() {
			chrome.runtime.sendMessage({accountRequest:1}, function(settings_in) {
				qd_settings = settings_in;
				var i = 0;

				//SETUP BUTTONS
				Object.keys(qd_settings.accounts).forEach( function(key) {
					if( qd_settings.accounts[key].active ) {
						var el = document.createElement('button');
						el.classList.add("qd_droppable");
						el.id = key;
						el.setAttribute('data-default-name', qd_settings.accounts[key].title);
						el.innerText = qd_settings.accounts[key].title;
						el.style['margin-top'] = (i * BUTTON_HEIGHT) + "px";
						//ADD DROP LISTENER
						el.ondrop = function(e) {
							_sendMessage(dragging, this);
							e.preventDefault();
							e.stopPropagation();
						};
						el.ondragenter = function(e) {
							this.classList.add('over');
							e.preventDefault();
		      		return false;
						};
						el.ondragover = function (e) {
							e.preventDefault();
							return false;
						};
						el.ondragleave = function(e) {
							this.classList.remove('over');
							e.preventDefault();
		      		return false;
						};
						buttons[i++] = el;
					}
				});

				//ADD GENERAL DRAG EVENTS
				window.ondragstart = function(e) {
					internal_drag = true;
					if(e.target.nodeName in qd_settings.draggable_elements) {
						_dragMonitor(e, qd_settings._gestures.active_gesture);
					}
				};

				//ONLY EXISTS TO CATCH EXTERNAL DROPS (EG FROM OMNIBAR)
				window.ondragover = function(e) {
					if(!internal_drag && !external_dragging) {
						external_dragging = true;
						_dragMonitor(e, 'override');
					}
					return true;
				};

				//GET RID OF EVERYTHING ON DRAG END
				window.ondragend = function(e) {
					internal_drag = false;
					external_dragging = false;
					_hideSidebar();
					gesture_stage = 0;
					window.ondrag = null;
					_removeHTML();
					e.stopPropagation();
    			e.preventDefault();
					return true;
				};
				
				//SET VIDEO AND AUDIO TO DRAGGABLE
				window.onload = function() {
					var draggables = document.querySelectorAll('video, audio'), d_len = draggables.length, i;
					for(i=0; i<d_len; i++) {
						draggables[i].setAttribute('draggable', 'true');
					}
				}
			});
		}
	}
})();
QD_EXT.initialize();