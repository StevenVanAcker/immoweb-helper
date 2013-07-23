function combine(olddata, newdata) { /* {{{ */
    for(var k in newdata) {
	olddata[k] = newdata[k];
    }
    return olddata;
}
/* }}} */

function getAllIds() { /* {{{ */
    var out = [];
    descrs = document.getElementsByClassName("description");
    for(var i = 0; i < descrs.length; i++) {
	var l = descrs[i].getElementsByTagName("a");
	if(l) {
	    var arr = /\?IdBien=(\d+)/.exec(l[0].href);
	    if(arr != null && arr.length > 1)
		out.push(arr[1]);
	}
    }
    return out;//.slice(0, 10);
}
/* }}} */
function getInfoPageData(id, callback) { /* {{{ */
    var out = {};
    var ifr = document.createElement("iframe");
    ifr.setAttribute("src", "http://www.immoweb.be/nl/Rent.estate.cfm?idbien="+id);
    ifr.setAttribute("style", "display:none;");
    ifr.onload = (function(fr) {return function() {
	// find a locationinfo tag that has a non-empty innerHTML
	locs = fr.contentWindow.document.getElementsByClassName("locationinfo");
	for(var l = 0; l < locs.length; l++) {
	    if(locs[l].innerText != "") {
		// text is this span is obfuscated a bit with colored text, so you can't easily copy/paste
		// removing all <font> tags with a space, removing other HTML too
 		var addresses = locs[l].getElementsByTagName("span");
		var sp = "";
		if(addresses.length > 0) {
		    sp = addresses[0].innerHTML;
		    sp = sp.replace(/<font[^>]*>[^<]*<\/font>/gi, " ");
		    sp = sp.replace(/<[^>]*>/gi, " ");
		}
		out['address'] = sp.trim();
		break;
	    }
	}
	prices = fr.contentWindow.document.getElementsByClassName("price");
	if(prices && prices.length > 0) {
	    out['price'] = prices[0].innerText.trim();
	}

	// remove iframe from page
	document.body.removeChild(ifr);
	callback(out);
    }})(ifr);

    document.body.appendChild(ifr);
}
/* }}} */
function getPositionPageData(id, callback) { /* {{{ */
    var xhReq = new XMLHttpRequest();
    xhReq.open("GET", "http://www.immoweb.be/nl/marketip.cfm?OngletActif=4&titre=Plan&xbg=N&idbien="+id+"&mycurrent_section=Rent", false);
    xhReq.send(null);
    var serverResponse = xhReq.responseText;
    var arr = /google.maps.LatLng\(([^\)]+)\)/.exec(serverResponse);
    if(arr != null && arr.length > 1)
        var parts = arr[1].split(",");
	if(parts && parts.length > 1) {
	    callback({
		    position: {
			latitude: parseFloat(parts[0]),
			longtitude: parseFloat(parts[1])
		    }
		});
	}
}
/* }}} */
function updateDataForID(port, id) { /* {{{ */
    getPositionPageData(id, function(data) {
	var out = {}
	out['id'] = id;
	out['url'] = "http://www.immoweb.be/nl/Rent.estate.cfm?idbien="+id;

	out = combine(out, data);

	getInfoPageData(id, function(adrdata) {
	    out = combine(out, adrdata);
	    port.postMessage({cmd: "updateData", id: id, "data": out});
	});
    });
}
/* }}} */
function getData(port) { /* {{{ */
    var ids = getAllIds();

    for(var i = 0; i < ids.length; i++) {
	port.postMessage({cmd:"idSpotted", id: ids[i]});
    }
}
/* }}} */

var port = chrome.runtime.connect({name: "immoweb-content-script"});
port.onMessage.addListener(function(msg) {
    console.log("Request from popup:");
    console.log(msg);

    if("cmd" in msg) {
	switch(msg.cmd) {
	    case "getData":
		getData(port);
		break;
	    case "update":
		updateDataForID(port, msg.id);
		break;
	}
    }
    return true;
});


var allids = getAllIds();
if(allids.length > 0) {
    console.log("This looks like an immoweb page! Notifying background page");
    getData(port);
}
