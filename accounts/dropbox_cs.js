//DROPBOX CONTENT SCRIPT - RUNS IN THE DROPOX IFRAME (https://dl.dropboxusercontent.com/emptypage...)
var s = document.createElement('script');
s.src = 'https://www.dropbox.com/static/api/2/dropins.js';
s.onload = function() {
    this.parentNode.removeChild(this);
    s = document.createElement('script');
		s.src = chrome.extension.getURL('accounts/dropbox_inject.js');
		s.onload = function() {
		    this.parentNode.removeChild(this);
		};
		(document.head||document.documentElement).appendChild(s);
};
(document.head||document.documentElement).appendChild(s);