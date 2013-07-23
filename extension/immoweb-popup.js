var port = null;
var markerData = {};
var markers = {};
var infowindows = {};
var bounds = null;
var map = null;


function generateStateSelectBox(id, currstate) { /* {{{ */
    var states = {
	none: "Unknown",
	interested: "Interested",
	notinterested: "Not interested",
    };
    var html = "";

    if(!(currstate in states)) {
        currstate = "none";
    }

    html += "<select id=\"state_"+id+"\">";
    for(k in states) {
	var seltext = "";
	if(k == currstate) { seltext = " selected"; }
	html += "<option value=\""+k+"\""+seltext+">"+states[k]+"</option>";
    }

    html += "</select>";

    return html;
}
/* }}} */

function generateInfoWindowOptions(id) { /* {{{ */
    var data = markerData[id];
    var html = "";

    html += "<table>";

    html += "<tr>";
    html += "<td>ID:</td>";
    html += "<td><a href=\""+data.url+"\" id=\"url_"+id+"\">"+id+"</a></td>";
    html += "</tr>";

    html += "<tr>";
    html += "<td>Address:</td>";
    html += "<td>" + data['address'] + "</td>";
    html += "</tr>";

    html += "<tr>";
    html += "<td>Price:</td>";
    html += "<td><b>" + data['price'] + "</b></td>";
    html += "</tr>";

    html += "<tr>";
    html += "<td>State:</td>";
    html += "<td>"+generateStateSelectBox(id, data.state)+"</td>";
    html += "</tr>";

    html += "<tr>";
    html += "<td>Notes:</td>";
    html += "<td><textarea id=\"note_"+id+"\" rows=\"4\" cols=\"50\">";
    if("note" in data) html += data.note;
    html += "</textarea><br>";
    html += "<input id=\"notesubmit_"+id+"\" type=\"submit\" value=\"Store note\"></td>";
    html += "</tr>";

    html += "</table>";

    return {
	content: html
    }
}
/* }}} */
function updateMarkerOptions(id) { /* {{{ */
    var data = markerData[id];
    var marker = markers[id];
    var options = {
	position: new google.maps.LatLng(data['position']['latitude'], data['position']['longtitude']),
	map: map,
    };

    switch(data.state) {
        case "interested": options.icon = "green.png"; break;
        case "notinterested": options.icon = "grey.png"; break;
        default: options.icon = "red.png"; break;
    }

    marker.setOptions(options);
}
/* }}} */
function addInfoWindowEventHandlers(id) { /* {{{ */
    var infowindow = infowindows[id];
    google.maps.event.addListener(infowindow, 'domready', function() {
	$("#state_"+id).change( function() {
	    var elid = "state_"+id;
	    var stateel = document.getElementById(elid);
	    var stateid = stateel.selectedIndex;
	    console.log("Selected: "+stateid);
	    updateLocalCache(id, {state: stateel.options[stateid].value});
	    renderMarker(id);
	});
	$("#url_"+id).click( function() {
	    var data = markerData[id];
	    chrome.tabs.getSelected(null, function(tab) {
	      chrome.tabs.update(tab.id, {url: data.url});
	    });
	});
	$("#notesubmit_"+id).click( function() {
	    var elid = "note_"+id;
	    var note = document.getElementById(elid).value;
	    updateLocalCache(id, {note: note});
	});
    });

}
/* }}} */
function addMarkerEventHandlers(id) { /* {{{ */
    var marker = markers[id];
}
/* }}} */


/* infrastructure code underneath */
function updateLocalCache(id, data, nosubmit) { /* {{{ */
    // make changes to the data stored in the popup, and submit the changes to the background page
    var newdata = {};
    if(id in markerData) {
	newdata = markerData[id];
    }

    for(var k in data) {
	newdata[k] = data[k];
    }
    markerData[id] = newdata;

    console.log("Update cache for id "+id);
    console.log(newdata);

    if(!nosubmit) submitLocalCache(id);
}
/* }}} */
function submitLocalCache(id) { /* {{{ */
    console.log("Sending updateData for id "+id);
    if(id in markerData) port.postMessage({cmd: "updateData", id: id, data: markerData[id]});
}
/* }}} */
function renderMarker(id) { /* {{{ */
    // WARNING: don't call updateMarker from this function!
    var marker = null;
    var infowindow = null;
    var data = markerData[id];
    var newmarker = false;

    console.log("Updating marker "+id);
    console.log(data);

    if(id in infowindows) {
	infowindow = infowindows[id];
    } else {
	infowindow = new google.maps.InfoWindow();
	infowindows[id] = infowindow;
        newmarker = true;
    }

    if(id in markers) {
	marker = markers[id];
    } else {
	marker = new google.maps.Marker();
	markers[id] = marker;
        newmarker = true;
    }

    updateMarkerOptions(id);
    infowindow.setOptions(generateInfoWindowOptions(id));

    google.maps.event.clearInstanceListeners(infowindow);
    google.maps.event.clearInstanceListeners(marker);

    addInfoWindowEventHandlers(id);
    addMarkerEventHandlers(id);

    google.maps.event.addListener(infowindow, 'closeclick', function() {
	infowindow.close();
	infowindow.isOpen = false;
	// update the contents of this marker with new data for the next time it is opened
	renderMarker(id);
    });
    
    google.maps.event.addListener(marker, 'click', function() {
	if("isOpen" in infowindow && infowindow.isOpen) {
	    infowindow.close();
	    infowindow.isOpen = false;
	    // update the contents of this marker with new data for the next time it is opened
	    renderMarker(id);
	} else {
	    infowindow.open(map,marker);
	    infowindow.isOpen = true;
	}
    });

    if(newmarker) {
	bounds.extend(marker.position);
	map.fitBounds(bounds);
    }
}
/* }}} */
function handleMessage(msg) { /* {{{ */
    if("cmd" in msg) {
        switch(msg.cmd) {
	    case "renderData":
		updateLocalCache(msg.data.id, msg.data, true);
		renderMarker(msg.data.id);
		break;
	}
    }
}
/* }}} */
function waitForConnection(msg) { /* {{{ */
    // this function will wait for the first message after connection is setup, before sending
    // the getData request. This avoids situations in which messages get lost inside the background page
    if("connected" in msg && msg.connected) {
	port.onMessage.removeListener(waitForConnection);
	port.onMessage.addListener(handleMessage);
	port.postMessage({cmd: "getData"});
    } else {
	console.log("Error: unexpected message:");
	console.log(msg);
    }
}
/* }}} */
function initialize() { /* {{{ */
    port = chrome.runtime.connect({name: "immoweb-popup"});
    // register waitForConnection to receive the first message
    port.onMessage.addListener(waitForConnection);
    bounds = new google.maps.LatLngBounds();

    var mapOptions = {
	mapTypeId: google.maps.MapTypeId.ROADMAP
	//mapTypeId: google.maps.MapTypeId.HYBRID
    }

    map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
}
/* }}} */
function loadScript() { /* {{{ */
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js";
  document.body.appendChild(script);
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://maps.googleapis.com/maps/api/js?sensor=false&callback=initialize";
  document.body.appendChild(script);
}
/* }}} */

window.addEventListener('load', loadScript);

