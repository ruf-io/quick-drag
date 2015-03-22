var QD_pocket = (function () {
	//PRIVATE VARS
	var CONSUMER_KEY = "39245-88f828ff30ea1ed92696bd7c",		//REGISTER YOUR APP TO GET CONSUMER KEY http://getpocket.com/developer/apps/new
	REDIRECT_URI = "chrome-extension://dkilhaadjikcodnfcgjlakmapnjnijlb/accounts/pocket_auth.html?step2",	//PAGE MOVES PROCESS TO STEP TWO
	POCKET_URL = {
		REQUEST:'https://getpocket.com/v3/oauth/request',
		CONFIRM:'https://getpocket.com/auth/authorize?request_token=@CODE&redirect_uri=@URI',
		AUTHORIZE: 'https://getpocket.com/v3/oauth/authorize',
		ADD: 'https://getpocket.com/v3/add'
	},
	HEADERS = {
		"Content-type": "application/json; charset=UTF-8",
		"X-Accept": "application/json"
	},
	_getAuthCode, _oAuthPost, _getRequestToken;

	//PRIVATE FUNCTIONS
	_getAuthCode = function(callback) {
		chrome.storage.sync.get(null, function(data) {
			for(var opt of data.content.pocket.options) {
				if(opt.id === "code" && opt.value !== "") {
					callback(opt.value);
					return;
				}
			}
			//NO AUTH CODE? INITIATE REQUEST
			_getRequestToken();
		});
	}
	
	//CREATE POST REQUEST PASSING JSON-FORMATTED DATA TO POCKET
	//FOLLOWING POCKET OAUTH SPECS HERE: http://getpocket.com/developer/docs/authentication
	_oAuthPost = function(url, data) {
		var http = new XMLHttpRequest();
		http.open('POST', url, true);
		//CREATE HEADERS
		Object.keys(HEADERS).forEach(function (key) {
			http.setRequestHeader(key, HEADERS[key]);
		});
		http.onload = function(resp) {
			//PARSE JSON
			var response_json = JSON.parse(resp.target.response);
			if(!response_json.code && !response_json.access_token) return false;	//TODO - HANDLE ERROR
			//FOR INITIAL OAUTH RESPONSES - SAVE RESPONSE IN SYNC
			chrome.storage.sync.get(null, function(data) {
				for(var opt of data.content.pocket.options) {
					if(opt.id in response_json) opt.value = response_json[opt.id];
				}
				chrome.storage.sync.set(data, function(){
					//FOR PRE-AUTHORIZE TYPE, LOAD AUTHORIZE WINDOW
					if(response_json.code)
						chrome.windows.create(
							{'url':POCKET_URL.CONFIRM.replace('@CODE', response_json.code).replace('@URI', encodeURIComponent(REDIRECT_URI)), 'type': 'popup'},
							function(win) {
								//SAVE WINDOW ID
								chrome.storage.local.set({pocket_window_id:win.id});
							}
						);
					//OTHERWISE CLOSE WINDOW
					else chrome.storage.local.get('pocket_window_id', function(data) { chrome.windows.remove(data.pocket_window_id); });
				});
			});
		};
		http.send(JSON.stringify(data));
	};

	_getRequestToken = function(){
		_oAuthPost(POCKET_URL.REQUEST, {consumer_key:CONSUMER_KEY, redirect_uri:REDIRECT_URI});
	}

	return {
		authorize: function() {
			_getAuthCode(function(code) {
				_oAuthPost(POCKET_URL.AUTHORIZE, {consumer_key:CONSUMER_KEY, code:code});
			});
		},
		add: function(data) {
			_getAuthCode(function(code) {
				_oAuthPost(POCKET_URL.ADD, {consumer_key:CONSUMER_KEY, code:code, url:data.url, title:data.title});
			});
		}
	}
})();

//step2 IN URL INDICATES RESPONSE FROM MANUAL AUTHORIZE
if(document.location.search === "?step2") {
	QD_pocket.authorize();
}