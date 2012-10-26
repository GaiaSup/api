
/*    
    Usage:
        join (gateway, x-coord, y-coord, AOI-radius)        join into the gaia network at a given (x,y)
        gaiaMove (x, y)                                         move to a new location at (x, y)
        gaiaSend (target, message)                              send a string to a target
        
    Other global variables that can be used or accessed
        gaiaNeighbors       - a list of neighbors, accessible by the neighbors's ID, content is a gaiaNode structure
*/

// create the gaia container
window.gaia = window.gaia || {};
(function () {

// define a gaia.Position object
gaia.Position = function (x, y, z) {

    if (z === undefined)
        z = 0;

	this.x = x;
	this.y = y;
	this.z = z;
    
    this.equals = function (pos) {
        return (this.x === pos.x && this.y === pos.y && this.z === pos.z);
    }
    
} // end of gaia.Node

// define gaia.Node object
gaia.Node = function (api_key, id, layer, pos) {
    
	// check for API key
	if (api_key === undefined)
		return null;
	
	//
	// public variables
    //
	var _id = this.id = id;
    var _layer = this.layer = layer;
	var _pos = this.pos = pos;
	
    //alert('init node id: ' + _id + ' layer: ' + _layer + ' pos: ' + _pos);
		
	//
	// private variables
    //    	
	var gaiaNeighbors = {};     // list of currently known neighbors
    var gaiaCallbacks = [];     // mapping from command to callbacks

    var gaiaUpdateHandler = null;       // external handler neighbor join / leave / position change updates
    var gaiaMessageHandler = null;      // external handler for incoming messages

	// API server's hostname
    var gaiaAPIHost = "http://api.gaiasup.com/";
    //var gaiaAPIHost = "http://dev.imonology.com:3001/";
	
	// API key for this node
    var gaiaAPIKey = api_key;
	
	// interval to query for nearby neighbors
	var gaiaQueryInterval = 1000;
	
	// query radius (for subscribeNearby)
	var _queryRadius = 500;
		    	    
	//
	// API methods (one-to-one mapping to backend API)
	//

	// register the layer to be used for this gaiaNode
    var l_registerLayer = this.registerLayer = function (layer, done_callback) {

        //alert('reg layer id: ' + id + ' layer: ' + layer + ' pos: ' + pos);        		
        var url = gaiaAPIHost + "register/" + gaiaAPIKey + "/" + layer;
        //alert('register layer: ' + url);        
        
        $.ajax({ 
			type: "GET",
			dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },                        
            success: function (data){
				_layer = layer;			
				done_callback(); 
            }
        });
    }
    
	// register a new node with the service
    var l_registerNode = this.registerNode = function (node_id, done_callback) {
    	
        var url = gaiaAPIHost + "register/" + gaiaAPIKey + "/" + _layer + "/" + node_id;
        //alert('register node: ' + url);        
        $.ajax({ 
            type: "GET",
            dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },                        
            success: function (data){
				_id = node_id;
				
				is_joined = true;
				done_callback(); 
            }
        });
    }
	
	// revoke a registered layer
    this.revokeLayer = function (done_callback) {
		
		if (_layer === undefined) {
			done_callback('layer does not exist');
			return;
		}
		
        var url = gaiaAPIHost + "revoke/" + gaiaAPIKey + "/" + _layer;
		        
        $.ajax({
			type: "GET",
			dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },                        
            success: function (data){
				_layer = '';
				done_callback('success'); 
            }
        });
    }

    
	// unregister a node
    this.revokeNode = function (done_callback) {
    
		if (_id === undefined || _layer === undefined) {
			done_callback('node not yet registered');
			return;
		}
				
        var url = gaiaAPIHost + "revoke/node/";
        $.ajax({ 
            type: "GET",
            dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },                        
            success: function (data){
				_id = '';
                done_callback('success'); 
            }
        });        
             
        //alert('revoke node: ' + url);                
    }

	
    // query square 
    var l_querySquare = this.querySquare = function (lower_x, lower_y, lower_z, upper_x, upper_y, upper_z, callback) {

		// check if we've joined
		if (is_joined === false) {
			if (typeof callback === 'function')
				callback([]);
			return;
		}
	
        var url = gaiaAPIHost + "query/square/" + lower_x + "/" + lower_y + "/" + lower_z + "/" + upper_x + "/" + upper_y + "/" + upper_z;
                    
        //alert('url: ' + url);
        
        // send to API
        $.ajax({ 
            type: "GET",
            dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },                        
            success: function (data) {        
                    
                // create a list of new neighbors
                // TODO: cleaner method
                var curr_neighbors = [];
                var new_neighbors = [];
        
                // get a list of current neighbors
				for (var key in gaiaNeighbors) {
                    //alert('neighbor: ' + gaiaNeighbors[key].id);
                    curr_neighbors[gaiaNeighbors[key].id] = true;
                }
                                 
                // go through each item & update neighbor list
                $.each(data[0], function (idx, msg) {
                    
                    //alert('idx: ' + idx + ' id: ' + msg.ident + ' x: ' + msg.x + ' y:' + msg.y);
                    
					// store this neighbor
                    var pos = new gaia.Position(msg.x, msg.y);
                    var node = new gaia.Node(gaiaAPIKey, msg.ident, msg.layer, pos);                    
                    new_neighbors[msg.ident] = node;
                    
                    // update existing neighbor info
                    if (gaiaNeighbors.hasOwnProperty(msg.ident)) {
                        gaiaNeighbors[msg.ident].pos = pos;
						
						if (typeof gaiaUpdateHandler === 'function') {
							gaiaUpdateHandler('update', gaiaNeighbors[msg.ident]) 
                            //gaiaUpdateHandler('print', data[0]);
                        }
                    }
                    // or insert a new neighbor entry
                    else {
                        gaiaNeighbors[msg.ident] = node;
						
						//alert('joining node: ' + node.toString());
						
						if (typeof gaiaUpdateHandler === 'function') {
							gaiaUpdateHandler('join', gaiaNeighbors[msg.ident])
                            gaiaUpdateHandler('print', data[0]);
                        }
                    }
                });
                                 
                // check if there's any neighbor being deleted
                // (exist before but not now)
                for (var key in curr_neighbors) {
                    // an current neighbor that doesn't appear in new neighbor list, remove it
                    if (new_neighbors.hasOwnProperty(key) === false) {
                                                
                        // remove from current neighbor list                        
						if (typeof gaiaUpdateHandler === 'function') {
							gaiaUpdateHandler('leave', gaiaNeighbors[key]);
                            gaiaUpdateHandler('print', data[0]);
                        }
							
                        delete gaiaNeighbors[key];
                    }
                }

                // notify callback of new neighbors if callback exists
				if (typeof callback === 'function')
					callback(new_neighbors);
            }
        });    
    }
	
	
    // publish pos 
    this.publishPos = function (new_pos) {
		_pos = new_pos;
	
        //alert('pubpos: ' + new_pos.x + ' ' + new_pos.y + ' ' + new_pos.z);
        var orien = ["0", "0"];
    
        var obj = {};
        obj.orien = orien;
        obj.move  = [["0","0","0","0","0","0"],"0"];
        obj.loc   = [new_pos.x + '', new_pos.y + '', new_pos.z + ''];
    
        //alert('obj: ' + JSON.stringify(obj));
    
        var url = gaiaAPIHost + "publish/pos/" + new_pos.x + '/' + new_pos.y + '/' + new_pos.z; 
            
        // send to API
        $.ajax({ 
            type: "POST",
            dataType: "json",
            //data: JSON.stringify(obj),
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },            
            success: function (data){        
				//alert('pubpos result: ' + data);
            },
            error: function(e) {
                alert('pubpos fail: ' + e);
            }
        });
    }
	
    // query for neighbors
    var l_queryNearby = this.queryNearby = function (radius, neighbor_CB) {
	        
		// check if we've joined
		if (is_joined === false || _pos === undefined) {
			if (typeof neighbor_CB === 'function')
				neighbor_CB([]);
			return;
		}
		
        // do only integer query
        var x = Math.floor(_pos.x);
        var y = Math.floor(_pos.y);
		
		var lower_x = (x-radius);
		var lower_y = (y-radius);
        var upper_x = (x+radius);
		var upper_y = (y+radius);
		
        l_querySquare(lower_x, lower_y, 0, upper_x, upper_y, 0, neighbor_CB);
    }	
   		
	// check if a particular node at a layer is valid
    this.valid = function (layer, id, done_callback) {

        var url = gaiaAPIHost + "valid/" + gaiaAPIKey + "/" + layer + "/" + id;
        
        $.ajax({ 
			type: "GET",
			dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },            
            success: function (data){
				done_callback(data); 
            }
        });
    }	
	   
	// send message
    this.sendMessage = function (msg, done_callback) {
            
		if (_id === undefined || _layer === undefined) {
			done_callback('node not yet registered');
			return;
		}
				
        var url = gaiaAPIHost + "msg/send/";

        // prepare targets
        var targets = [];
        
		for (var key in gaiaNeighbors) {
           
            //alert('neighbor: ' + gaiaNeighbors[key].id);
            var node = gaiaNeighbors[key];
            
            // skip self
            if (node.id === _id)
                continue;
                
            console.log('sendmsg to: ' + node.id);
            targets.push(
                {
                    "layer": _layer,
                    "ident": node.id,
                    "apikey": gaiaAPIKey
                }
            );
        }
        
        var obj = {
            "msg": msg,
            "to": targets
        };
        
        $.ajax({
            type: "POST",
            dataType: "json",
            data: JSON.stringify(obj),
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },            
            success: function (data){        
                done_callback('success'); 
            }
        });
    }

	// receive message
    this.recvMessage = function (done_callback) {
    
		if (_id === undefined || _layer === undefined) {
			done_callback('node not yet registered');
			return;
		}
				
        var url = gaiaAPIHost + "msg/recv/";
        //alert('register node: ' + url);        
        $.ajax({ 
            type: "GET",
            dataType: "json",
            url: url,
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },            
            success: function (data) {
            
                // if some message exists
                if (data[0].length != 0) {
                
                    // go through each item & update neighbor list
                    $.each(data[0], function (idx, msg) {
                        //console.log('idx: ' + idx + 'msg: ' + msg);
                        var obj = jQuery.parseJSON(msg);
                        done_callback(obj.msg);
                    }); 
                }
            }
        });
    }

	// query message
    // input: no. of messages to query
    this.queryMessage = function (msg_size, done_callback) {
    
		if (_id === undefined || _layer === undefined) {
			done_callback('node not yet registered');
			return;
		}
				
        var url = gaiaAPIHost + "query/msg/" + gaiaAPIKey + "/" + _layer + "/" + _id + "/" + msg_size;
        //alert('register node: ' + url);        
        $.ajax({ 
            type: "GET",
            dataType: "json",
            url: url,
            success: function (data){
                done_callback(data); 
            }
        });
    }
   
	//
	// private helper methods & flags
	//
		
    // whether we've registered layer & node name
    var is_joined = false;	
		
	var periodic_query = function () {
			
	    // do not query if node is not yet registered
		l_queryNearby(_queryRadius);
			
		setTimeout(periodic_query, gaiaQueryInterval);
	}	  	
	
	//
	// public methods (convenient methods)
	//
	
	// whether we've joined successfully (registered finished)
	this.isJoined = function () {
		return is_joined;
	}
    
    // get a list of currently known neighbors
    this.getNeighbors = function () {
        return gaiaNeighbors;
    }
    
    // join to the gaia network given a layer name and nodeID
    this.join = function (layer, id) {
    
        //alert('gaia.Node.join called');
        
        // call api to init key & layer
        l_registerLayer(layer, function() {
            l_registerNode(id, function() {
                
                //alert('init success');
                is_joined = true;
            }); 
        });
    }
	  
    // register call to be notify when there's neighbor join/leave/update
    this.subscribeNearby = function (radius, notify_CB, interval) {
	
		_queryRadius = radius;
	
		// store handler
        gaiaUpdateHandler = notify_CB;
		
		if (interval !== undefined)
			gaiaQueryInterval = interval;
	
		// periodic query
		setTimeout(periodic_query, gaiaQueryInterval);	
    }
    
    // output method
    this.toString = function () {
		if (_pos === null)
			return '[' + _id + ']';
		
        return '[' + _id + '] (' + _pos.x + ', ' + _pos.y + ')';
    }
	
    		                
} // end of gaia.Node
    
})();

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    