var options = {
    files: [{ url:'', filename:'' }],
    success: function () {
        chrome.runtime.sendMessage(this.files[0].extension_id, {dropbox:1, uid:this.files[0].uid, success:true, alert:"Saved to Dropbox"}, function() { parent.window.postMessage("removeQDIframe", "*"); });
    },
    progress: function (progress) {},
    cancel: function () { chrome.runtime.sendMessage(this.files[0].extension_id, {dropbox:1, uid:this.files[0].uid, success:false, alert:"Upload Cancelled."}, function() { parent.window.postMessage("removeQDIframe", "*"); }); },
    error: function (errorMessage) { chrome.runtime.sendMessage(this.files[0].extension_id, {dropbox:1, uid:this.files[0].uid, success:false, alert:"Dropbox Error"}, function() { parent.window.postMessage("removeQDIframe", "*"); }); }
};
var vals = document.location.search.substr(1).split('&').map(function(val){ var kv = val.split('='); options.files[0][kv[0]] = decodeURIComponent(kv[1]); });
Dropbox.appKey = "im5ipdo7yu7p26r";
Dropbox.save(options);
