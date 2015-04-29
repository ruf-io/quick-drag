var QD_ext = (function () {
	//CONSTANTS
	var MOUSE_CHECK_FREQUENCY = 10,
	DRAG_THRESHOLD = 50,
	STAGGER = 50,
	BUTTON_HEIGHT = 70,

	//VARIABLES
	qd_settings = {},
	drag_type = 0,
	drag_event = null,
	gesture_stage = 0,
	sidebar_visible = false,
	sc = [],
	buttons = [],
	buttonRemoveTimeout = null,
	message = {
		citation_domain:window.location.host,
		citation_protocol:window.location.protocol,
		citation_url:window.location.href,
		object_url:'',
		object_title:'',
		object_description:'', 
		object_type:'',
		object_tags:[]
	},
	gestureMonitor = null,
	//button_cache = null,	TODO - SEE IF JUST ADDING ONE PARENT ELEMENT THAT ENCAPSULATES ALL BUTTONS IS ANY FASTER

	//INIT PRIVATE FUNCTIONS
	_dragStart, _removeHTML, _cancelRemoveHTML, _animate, _showSidebar, _hideSidebar, _gestures, _sendMessage, _makeNotifier, _dbg, _buildMessage;


	//1. A DRAGSTART LISTENER IS POSTED TO THE WINDOW - IT TRIGGERS _dragStart
	//2. _dragStart SETS UP MESSAGE, ANIMATES IN ELIGIBLE BUTTONS, TURNS ON GESTURE LISTENER
	//3a. DROP OUTSIDE OF BUTTONS - BUTTONS ARE TRANSITIONED OFF, REMOVED AND RESET
	//3b. DROP INSIDE BUTTONS - BUTTONS (EXCEPT DROP TARGET) ARE TRANSITIONED OFF, MESSAGE IS SENT TO BACKGROUND PROCESS WITH METADATA
	//3b. continued... EVENT IS SETUP TO LISTEN FOR RESPONSE FROM BACKGROUND PROCESS WITH STATUS
	//TODO - NEED TO ACCOUNT FOR MULTIPLE PARALLEL DROPS

	_dbg = function(t) {
		//console.log(t);
	}

	//PRIVATE FUNCTIONS
	//ENTIRE PROCESS MUST START WITH THIS
	_dragStart = function(drag_event_in, drag_type_in) {
		_dbg('_dragStart');
		_dbg(drag_event_in);
		_cancelRemoveHTML();
		drag_type = drag_type_in || 1;
		drag_event = drag_event_in;
		if (drag_type === 2) {
			_dbg('DRAGGED FROM EXTERNAL WINDOW');
			_showSidebar();
			message.object_type = "external";
		} else {
			_dbg('DRAGGED FROM WITHIN THIS WINDOW');
			message.citation_title = document.title;
			message.object_type = drag_event.target.tagName.toLowerCase().replace('#', '');
			message.object_url = drag_event.target.src || drag_event.target.href || '';
			message.object_title = drag_event.target.getAttribute('alt') || drag_event.target.getAttribute('title') || message.object_type + " from " + message.citation_domain;
			sc = [drag_event.screenX, drag_event.screenY];
			window.addEventListener('drag', gestureMonitor, false);
		}
		buttons.map( function (button, i) {
			if(drag_type === 2 || button.getAttribute('data-' + message.object_type)) {
				button.className = "qd_droppable";
				document.body.appendChild(button);
			}
		});
	};

	//REMOVE (OR CANCEL THE REMOVAL) OF BUTTONS
	_removeHTML = function() {
		_hideSidebar();
		buttonRemoveTimeout = window.setTimeout(function() {
			buttons.map(function(button, i) {
				try {
					document.body.removeChild(button);
				} catch (e) { }
			});
		}, 1000);
	};

	//CANCEL REMOVE HTML
	_cancelRemoveHTML = function() {
		window.setTimeout(function() {
			window.clearTimeout(buttonRemoveTimeout);
		}, 50);
	}

	//ANIMATE BUTTONS
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
		window.removeEventListener('drag', gestureMonitor, false);
		if(!sidebar_visible) {
			sidebar_visible = true;
			buttons.map(function(button, i) {
				_animate(button, "qd_in", i*STAGGER);
			});
		}
	};

	//SLIDE OUT THE SIDEBAR AND REMOVE
	_hideSidebar = function(except_this_button) {
		drag_type = 0;
		gesture_stage = 0;
		if(sidebar_visible) {
			sidebar_visible = false;
			buttons.map(function(button, i) {
				if(button !== except_this_button) {
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
				else if (gesture_stage === 1 && e.screenX - sc[0] > DRAG_THRESHOLD) {
					_showSidebar();
				}
				return true;
		},
		'right':  function(e) {
				if ( e.screenX - sc[0] > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1]+50)/(e.screenX - sc[0])) < 0.5) {
					_showSidebar();
				}
				return true;
		},
		'vertical-right':  function(e) {
				if (gesture_stage === 0 && Math.abs(sc[1] - e.screenY) > DRAG_THRESHOLD && Math.abs((e.screenY - sc[1])/(e.screenX - sc[0])) > 2) {
					gesture_stage = 1;
					sc = [e.screenX, e.screenY];
				}
				else if (gesture_stage === 1 && e.screenX - sc[0] > DRAG_THRESHOLD) {
					_showSidebar();
				}
				return true;
		}
	};

	_sendMessage = function(e, dropped) {
		_dbg("_sendMessage");
		//BUILD MESSAGE
		if(message.object_type === "") {
			_dbg('EXTERNAL DRAG');
			//EXTERNAL MEANS LOCATION.HREF IS NO LONGER APPLICABLE, OVERWRITE CITATION, SRC, 
			for(var i=0; i<e.dataTransfer.items.length; i++) {
				e.dataTransfer.items[i].getAsString(function(){ console.log(arguments); });
			}
			for(var i=0; i<e.dataTransfer.files.length; i++) {
				e.dataTransfer.files[i].getAsString(function(){ console.log(arguments); });
			}
		} else {
			_dbg('Internal Drag');
		}
		_hideSidebar(dropped);
		message.action = dropped.id;

		//SEND MESSAGE
		chrome.runtime.sendMessage(message, _makeNotifier(dropped));
		dropped.innerText = "Sending...";

		//FLOAT BOX TO TOP
		var float_top = parseInt(dropped.style['margin-top'].replace('px'), 10),
			position = float_top;
		window.setTimeout( function() {
			var _animateToTop = window.setInterval(function(){
				position = position/1.5;
				dropped.style.top = "-" + Math.round(float_top-position, 0) + "px";
				if(position < 10) window.clearInterval(_animateToTop);
			}, 35);
		}, 300);
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
	};

	return {
		dragType:function(){console.log(drag_type);},
		initialize:function() {
			chrome.runtime.sendMessage({accountRequest:1}, function(settings_in) {
				qd_settings = settings_in;
				_dbg(qd_settings);
				gestureMonitor = _gestures[qd_settings.gestures.active_gesture];
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
						//ADD ELIGIBILITY ATTRIBUTES
						if('valid_for' in qd_settings.accounts[key]) {
							_dbg(key);
							for(var type_id of qd_settings.accounts[key].valid_for) {
								_dbg(qd_settings.draggable_elements.index[type_id]);
								el.setAttribute("data-" + qd_settings.draggable_elements.index[type_id], 1);
							}
						}
						//ADD DROP LISTENER
						el.ondrop = function(e) {
							e.stopPropagation();
    					e.preventDefault();
							drag_type = 0;
					    _sendMessage(e, this);
					    return false;
						};
						el.ondragenter = function(e) {
							this.classList.add('over');
							drag_event.dataTransfer.effectAllowed = "copy";
						};
						el.ondragover = function (e) {
							e.preventDefault();
							return false;
						};
						el.ondragleave = function(e) {
							this.classList.remove('over');
						};
						buttons[i++] = el;
					}
				});

				//ADD GENERAL DRAG EVENTS
				window.addEventListener('dragstart', _dragStart, false);
				window.addEventListener('dragover', function(e) { if(drag_type === 0) {_dragStart(e, 2);} });

				//GET RID OF EVERYTHING ON DRAG END
				window.addEventListener('dragend', function(e) {
					if(drag_type !== 0) {
						_removeHTML();
					}
				}, false);

				//SET VIDEO AND AUDIO TO DRAGGABLE
				window.addEventListener('load', function() {
					var draggables = document.querySelectorAll('video, audio'), d_len = draggables.length, i;
					for(i=0; i<d_len; i++) {
						draggables[i].setAttribute('draggable', 'true');
					}
				});
			});
		}
	}
})();
QD_ext.initialize();