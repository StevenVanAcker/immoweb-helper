// This listener just forwards a request from the popup to the content script
// and forwards the response in the other direction

var storage = chrome.storage.local;
var maxAge = 24 * 3600;

var portPopup = null;
var portContentScript = null;

function sendToPopup(msg) { if(portPopup != null) portPopup.postMessage(msg); }
function sendToContentScript(msg) { if(portContentScript != null) portContentScript.postMessage(msg); }

function updateEntry(id, data) { /* {{{ */
    var key = ""+id;
    storage.get(key, function(olddata) {
	var newdata = {};
	if(key in olddata) {
	    newdata = olddata[key];
	}
	for(var k in data) {
	    newdata[k] = data[k];
	}
	var storobj = {};
	storobj[key] = newdata;
	storage.set(storobj);
    });
}
/* }}} */
function sendBackAllData(port) { /* {{{ */
    if(port == null) return;
    getAllData(function(allData) {
	for(var k in allData) {
	    port.postMessage({cmd: "renderData", data: allData[k]});
	}
    });
}
/* }}} */
function getAllData(callback) { /* {{{ */
    storage.get(null, function(d) { callback(d); });
}
/* }}} */
function getEntry(id, callback) { /* {{{ */
    storage.get(id, function(d) { callback(d[id]); });
}
/* }}} */
function commandFromPopupHandledLocally(msg) { /* {{{ */
    if("cmd" in msg) {
	switch(msg.cmd) {
	    case "getData":
		console.log("Popup requesting data");
		sendBackAllData(portPopup);
		return true;
		break;
	    case "updateData":
		console.log("Popup sent update for id "+msg.id);
		console.log(msg.data);
		//msg.data['lastUpdate'] = Date.now();
		updateEntry(msg.id, msg.data);
		return true;
		break;
	}
    }

    return false;
}
/* }}} */
function commandFromContentScriptHandledLocally(msg) { /* {{{ */
    if("cmd" in msg) {
	switch(msg.cmd) {
	    case "idSpotted":
		console.log("ContentScript spotted id "+msg.id);
		// request update
		getEntry(msg.id, function(data) {
		    var now = Date.now();
		    if(data != null && "lastUpdate" in data && data.lastUpdate + (maxAge * 1000) > now) {
			// do nothing, data is up to date
			console.log("Data up to date for id "+msg.id+" now="+now);
		    } else {
			// request update
			console.log("Requesting update for id "+msg.id);
			sendToContentScript({cmd: "update", id: msg.id});
		    }
		});
		return true;
		break;
	    case "updateData":
		console.log("ContentScript sent update for id "+msg.id);
		console.log(msg.data);
		msg.data['lastUpdate'] = Date.now();
		updateEntry(msg.id, msg.data);
		return true;
		break;
	}
    }

    return false;
}
/* }}} */
chrome.runtime.onConnect.addListener(function(port) { /* {{{ */
    switch(port.name) {
        case "immoweb-popup":
	    console.log("Incoming connection from popup");
	    portPopup = port;

	    portPopup.onMessage.addListener(function(msg) {
		commandFromPopupHandledLocally(msg);
		return true;
	    });
	    sendToPopup({connected: true});
	    break;

        case "immoweb-content-script":
	    console.log("Incoming connection from content-script");
	    portContentScript = port;

	    portContentScript.onMessage.addListener(function(msg) {
		commandFromContentScriptHandledLocally(msg);
		return true;
	    });
	    break;
    }
});
/* }}} */

