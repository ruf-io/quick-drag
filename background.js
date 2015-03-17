var QD = (function () {
	//INTERNAL FUNCTIONS AND VARIABLES
	var _update_settings,
			_account_actions,
			_download_url,
			_build_filename,
			qd_settings = null,
			active_downloads = {},
			queued_callbacks = {},
			MIME_TYPES = {"application/msword": "doc","application/pdf": "pdf","application/rtf": "rtf","application/vnd.ms-excel": "xls","application/vnd.ms-powerpoint": "ppt","application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx","application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx","application/x-chrome-extension": "crx","application/x-gzip": "gzip","application/x-pdf": "pdf","application/zip": "zip",
    "audio/mp4": "mp4","audio/mpeg": "mp3","audio/ogg": "ogg","audio/vnd.wave": "wav","image/gif": "gif","image/jpeg": "jpg","image/pjpeg": "jpg","image/png": "png","image/svg+xml": "svg","image/tiff": "tif","image/vnd.microsoft.icon": "ico","text/css": "css","text/csv": "csv","text/html": "html","text/mhtml": "mht","text/plain": "txt","text/tsv": "tsv","text/xml": "xml","video/mp4": "mp4","video/mpeg": "mpg","video/ogg": "ogg"},
    	ELEMENT_TYPES = {'img':1, 'audio':1, 'video':1};

  _build_filename = function(domain, content_type) {
  	var today = new Date();
  	return domain.replace('.', '_') + "-" + today.getFullYear() +"_"+ (today.getMonth()+1) +"_"+ today.getDay() + "." + (content_type.toLowerCase() in MIME_TYPES ? MIME_TYPES[content_type.toLowerCase()] : "unknown");
  };

  //SAVE URL TO MEMORY AND CALLBACK
  _download_url = function(data, error_callback, callback) {
  	var reader, xhr = new XMLHttpRequest();
		xhr.open('GET', data.url, true);
		xhr.responseType = 'arraybuffer';
		xhr.onload = function(e){
			if (this.status == 200) {
				data.content_type = this.getResponseHeader('content-type');
				data.blob = new Blob([this.response],  {type:data.content_type});
				reader = new FileReader();
				reader.readAsDataURL(data.blob);
				reader.onloadend = function(e){
					data.raw_data = reader.result;
					data.file_name = _build_filename(data.page_domain, data.content_type);
					callback(data);
				}
			} else { error_callback({success:false, alert:"Error Downloading File"}); }
		};
		xhr.send();
  };

  //ACCOUNT ACTIONS - WHERE BEHAVIOR SPECIFIC TO AN ACCOUNT GOES 
	_account_actions = {
		s3: function(data, callback) {
			if('s3' in qd_settings.accounts && qd_settings.accounts.s3.active && qd_settings.accounts.s3.bucket) {
				AWS.config.update({accessKeyId:qd_settings.accounts.s3.access_key, secretAccessKey:qd_settings.accounts.s3.secret_key});
				_download_url(data, callback, function(data) {
					var s3 = new AWS.S3();
					s3.upload({Bucket: qd_settings.accounts.s3.bucket, Key: data.file_name, ContentType: data.content_type, ACL:"public-read", Body: data.blob},
						function (err, data) {
							console.error(arguments);
							callback({success:err, alert:err ? "S3 Error" : "Uploaded to S3"});
						});
				});
			}
		},
		dropbox: function(data, callback) {
			//DROPBOX SAVER DROPIN MUST BE TRIGGERED FROM A NON-EXTENSION DOM,
			//BUT IT MUST BE TRIGGERED FROM A PRE-APPROVED DOMAIN.
			//STEP 1: DROP AN IFRAME IN THE CURRENT TAB THAT LOADS A RANDOM ERROR PAGE ON DROPOXUSERCONTENT.cOM
			//STEP 2: MANIFEST.JSON SPECIFIES A CONTENT SCRIPT TO RUN IN THAT PAGE, INJECTING THE SAVER SCRIPTS
			//STEP 3: AT THAT POINT THE CALLBACK CHAIN IS BROKEN, QUEUE CALLBACK IN BACKGROUND AND WAIT FOR A MESSAGE FROM DOM
			_download_url(data, callback, function(data) {
				chrome.contentSettings.popups.set({primaryPattern:data.page_protocol + "//" + data.page_domain + "/*", setting:"allow" });
				var uid = +new Date();
				chrome.tabs.executeScript(data.sender.tab.id, {
					code: 'var qd_iframe = document.createElement("iframe"); qd_iframe.setAttribute("style", "position:fixed; top:-4000px; left:-4000px;"); qd_iframe.src = "https://dl.dropboxusercontent.com/emptypage?url=' + encodeURIComponent(data.url) + '&filename=' + data.file_name + '&uid=' + uid + '&extension_id=' + chrome.runtime.id +'"; document.body.appendChild(qd_iframe); function removeQDIframe(event){ if (event.data=="removeQDIframe") document.body.removeChild(qd_iframe); } window.addEventListener("message", removeQDIframe, false);'
				});
				queued_callbacks[uid] = callback;
			});
		},
		google_drive: function(data, callback) {
			_download_url(data, callback, function(data) {
				//CREATE DRIVE UPLOAD REQUEST
				var bound = 287032396531387;
		    var parts = [];
		    //PART 1 IS METADATA
		    parts.push('--' + bound);
		    parts.push('Content-Type: application/json');
		    parts.push('');
		    parts.push(JSON.stringify({title: data.file_name, mimeType:data.content_type, description:data.description + " - Found on " + data.page_url, indexableText:{text:data.description}}));
		    parts.push('--' + bound);
		    //PART 2 IS IMAGE
		    parts.push('Content-Type: ' + data.content_type);
		    parts.push('Content-Transfer-Encoding: base64');
		    parts.push('');
		    parts.push(data.raw_data.replace(/^data:[^;]+;base64,/, ""));
		    parts.push('--' + bound + '--');
		    parts.push('');

		    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
				  
					var xhr = new XMLHttpRequest();
					xhr.open("POST", "https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart", true);
					xhr.setRequestHeader("Authorization", "Bearer " + token);
					xhr.setRequestHeader("Content-Type", "multipart/mixed; boundary=" + bound);
					xhr.onload = function(e){
					    callback({success:true, alert:"Uploaded to Drive"});
					};
					xhr.send(parts.join("\r\n"));
				});
			});
		},
		local: function(data, callback) {
			chrome.storage.sync.get({download_incrementer:1}, function(stored_settings) {
				chrome.downloads.setShelfEnabled(false);
				chrome.downloads.download({
					url: data.url,
					filename: (qd_settings.accounts.local.directory) + stored_settings.download_incrementer
				}, function(download_id) {
					active_downloads[download_id] = data;
					chrome.storage.sync.set({download_incrementer:stored_settings.download_incrementer+1});
				});
			});
		},
		twitter: function(data, callback) {
			//if(data.)
		}
	};

	_update_settings = function(data) {
		if(!('version' in data)) {
			//UPDATE CODE
			chrome.tabs.create({url:"chrome://extensions/?options=" + chrome.runtime.id});	//TODO - LOOK TO SEE IF EXTENSIONS TAB IS ALREADY OPEN
		} else {
			qd_settings = qd_settings || {'accounts':{}};
			for(var section_name of data.sections) {
				if(section_name in data.content && 'options' in data.content[section_name] && data.content[section_name].options instanceof Array) {
					var ptr = ('class' in data.content[section_name] && data.content[section_name].class === "account" ? qd_settings['accounts'] : qd_settings);
					ptr[section_name] = {'title':data.content[section_name].title || ""};
					for(var option of data.content[section_name].options) {
						if('name' in option) {
							if('id' in option && option.value) ptr[section_name][option.name] = option.id;
						} else if('id' in option) ptr[section_name][option.id] = option.value;
					}
				}
			}
			//LOOK FOR OAUTH REQUIREMENTS
			if(qd_settings.accounts.tumblr.active) {

			}
		}
	};

	return {
		//EXPOSE UPDATE SETTINGS AS PUBLIC
		update_settings: function(data) { _update_settings(data); },
		//HANDLES MESSAGES FROM BROWSER (AS A RESULT OF DRAG/DROP ACTIONS, REQUESTS FOR SETTINGS, OTHER EXTERNAL MESSAGES)
		message_router: function(message, sender, sendResponse) {
			console.log(message);
			//ROUTE TO ACCOUNT-SPECIFIC FUNCTION IF APPLICABLE
			message.sender = sender;
			if('target' in message && message.target in _account_actions) { _account_actions[message.target](message, sendResponse); }
			
			//BROWSER SCRIPT CAN REQUEST CURRENT CONFIGURATION
			else if ('accountrequest' in message) { sendResponse(qd_settings); }
			
			//DROPBOX FOLLOW-UP MESSAGE FROM IFRAME DOM 
			else if('dropbox' in message) {
				if('uid' in message && message.uid in queued_callbacks) {
					queued_callbacks[message.uid]({success:message.success, alert:message.alert});
					delete queued_callbacks[message.uid];
					chrome.contentSettings.popups.clear({});
					sendResponse({});
				}
			}
			return true;
		},
		settings_watcher: function(changes, namespace) {
		  if ("content" in changes) {
		  	chrome.storage.sync.get(null, _update_settings);
		  }
		},
		download_watcher: function(download_item) {
			if(download_item.id in active_downloads && ('state' in download_item && download_item.state.current === "complete")) {
				//REMOVE FROM ACTIVE DOWNLOADS
				delete active_downloads[download_item.id];
				//RE-ENABLE THE DOWNLOAD SHELF FOR REGULAR BROWSING
				chrome.downloads.setShelfEnabled(true);
			}
		}
	}
})();

chrome.runtime.onMessage.addListener( QD.message_router );
chrome.downloads.onChanged.addListener( QD.download_watcher );
chrome.storage.onChanged.addListener( QD.settings_watcher );
chrome.storage.sync.get(null, QD.update_settings);
chrome.runtime.onMessageExternal.addListener( QD.message_router );