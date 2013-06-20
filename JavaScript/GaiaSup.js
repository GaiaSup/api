/*    

Copyright (C) 2012-2013 Imonology Inc.

Permission is hereby granted, free of charge, to any person obtaining a 
copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to 
the following conditions: 

The above copyright notice and this permission notice shall be included 
in all copies or substantial portions of the Software. 

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
       
*/

/*
gaiaAPI: javascript binding for the GaiaSup LBS Engine

    Usage: please see API documentation 
*/

// create the GaiaSup container
window.GAIASUP = window.GAIASUP || {};
(function () {

//
//  Config
//

// API server's hostname

// production
//var l_APIHost    = "http://api.gaiasup.com/";
//var l_SocketHost = "http://api.gaiasup.com:5000";

// development
//var l_APIHost    = "http://dev.imonology.com:3100/";
//var l_SocketHost = "http://dev.imonology.com:5000";
var l_APIHost    = "http://50.116.11.73:3100/";
var l_SocketHost = "http://50.116.11.73:5000";


// how long a query request is made after subscribed (in millisecond)
var l_defaultQueryInterval = 1000;

// default subscribe nearby radius
var l_defaultRadius = 500;

// 
// helper methods
//

var l_HTTP = function (type, url, obj, onDone, onFail) {

    // TODO: check if dataType should be "json"       
    var request = {
        type: type,
        url: url,        
        dataType: "json",
        crossDomain: true,
        xhrFields: {
            withCredentials: true
        },                        
        success: onDone,
        error: onFail
    };
    
    if (obj !== undefined) {
        request.data = JSON.stringify(obj);
    }
    
    // for DELETE, we'll use POST instead
    if (type === 'DELETE') {
        request.type = 'POST';
        request.url += '?_method=delete';
    }        
    $.ajax(request);
}


// define a position object
GAIASUP.position = function (x, y, z) {

    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    
    this.equals = function (pos) {
        return (this.x === pos.x && this.y === pos.y && this.z === pos.z);
    }
    
    // update the positions from another object
    this.update = function (obj) {
        this.x = obj[0] || this.x;
        this.y = obj[1] || this.y;
        this.z = obj[2] || this.z;
    }
        
    // return distance from self to a given object
    this.distance = function (p) {
    
        var dx = p.x - this.x;
        var dy = p.y - this.y;
        var dz = p.z - this.z;
        
        return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2));
    }
    
} // end of gaia.Node

// define a node object
GAIASUP.node = function () {
        
    //
    // public variables
    //    
    var _apikey = this.apikey = undefined;
    var _layer = this.layer = undefined;
    var _name  = this.name  = undefined;    	
    
    //
    // prviate variables
    //
        
    // position callback
    var _onPosition = undefined;  
    
    // message callback
    var _onMessage = undefined;
    
    // unique ident composing of apikey:layer:name
    var _ident = undefined;
    
    // radius for subscribing nearby updates and messages
    var _radius = undefined;
    
    // current position for node
    var _pos = new GAIASUP.position();   

    // interval to query for nearby neighbors
    var _queryInterval = l_defaultQueryInterval;
        
    // periodic query interval ID
    // TODO: remove this? (change to long-polling)
    var _queryIntervalID = undefined;
    
    // whether we've created a layer & node name
    var _isJoined = false;	
    
    // whether a data channel is established
    var _isConnected = false;
    
    // a list of neighbors
    var _neighbors = {};
    
    
    //
    // public method
    //
    
    // initialize a node
    this.init = function (info, onDone) {
        
        // check if required fields exist
        if (typeof info.apikey !== 'string' ||
            typeof info.layer  !== 'string' ||
            typeof info.name   !== 'string') {
        
            console.log('cannot init a node: apikey / layer / name missing');
            onDone("error: missing apikey / layer/ name");
            return;
        }
        
        // store required info to initialize
        _apikey = info.apikey;
        
        // store optional callback when updates are available
        _onPosition = info.onPosition;
        _onMessage  = info.onMessage;

        // store optional API host, if available
        if (info.hasOwnProperty('APIhost') === true)
            l_APIHost = info.APIhost;
        
        // perform creation of layer & node
        l_createLayer(info.layer, function () {
        
            l_createNode(info.name, function () {
             
                _initSocket(function (result) {
                    
                    console.log('socket init done, result: ' + result + ', perform initial publishPos...');
                    
                    // check if initial position exist, then do initial publishPos
                    if (typeof info.pos !== 'undefined') {
                    
                        l_updateNode({
                            loc:  [info.pos.x || 0, 
                                   info.pos.y || 0,
                                   info.pos.z || 0]
                            //move:   [["55","55","55","123","34","56"],"77"], 
                            //orien:  ["78","87"]
                        }, onDone);                                          
                    }
                    else
                        onDone();                                                   
                });
            });        
        });
    }
    
    // close down a node
    this.shut = function (onDone) {
        l_deleteNode(onDone);
    }
                  
    // subscribe area/nearby/cube/node
    this.subscribe = function (para, onDone, interval) {

        onDone = onDone || function () {};
    
        // check if radius exists
        if (typeof para.radius !== 'undefined') {
        
            // case 1: subscribe area
            if (typeof para.center !== 'undefined') {
            
            }
            // case 2: subscribe nearby
            else {
                                                
                l_subscribeNearby(para.radius, onDone);
            }
        }
        // case 3: subscribe node
        else if (typeof para.node !== 'undefined') {
            l_subscribeNode(para.node, onDone);
        }
        else {
            console.log('unrecognize subscribe type');
            return onDone();
        }
                    
        // store query interval, if available
        _queryInterval = interval || _queryInterval;
    }

    // publish position/node/message 
    //  para = 
    //  {
    //      pos,        // position update
    //      msg         // message publication at current position
    //  }
    this.publish = function (para, onDone) {
    
        onDone = onDone || function () {};
        
        // case 1: point publication (send a message at a position but do not change node position
        if (typeof para.pos !== 'undefined' && typeof para.msg !== 'undefined') {
            //console.log('point publication..');
            return onDone();
        }
        
        // case 2: update node position
        if (typeof para.pos !== 'undefined') {
            
            //console.log('publish position..');
            
            // update self position
            _pos.update(para.pos);
            
            // publish position update
            l_updateNode({
                loc:  para.pos
                //move:   [["55","55","55","123","34","56"],"77"], 
                //orien:  ["78","87"]
            }, onDone);
        
            return;
        }
        
        // case 3: message publication
        if (typeof para.msg !== 'undefined') {
            //console.log('publish message..'); 
            return onDone();
        }        
    }
    
    // output method
    this.toString = function () {
        
        return '[' + _ident + '] (' + _pos.x + ', ' + _pos.y + ', ' + _pos.z + ')';
    }
    
    // whether we've joined successfully (node creation finished)
    this.isJoined = function () {
        return _isJoined;
    }
    
    // get a list of currently known neighbors
    this.getNeighbors = function () {
        return _neighbors;
    }
                               
    //
    // API methods (one-to-one mapping to backend API)
    //       

    // create the layer to be used for this gaiaNode
    var l_createLayer = this.createLayer = function (layer, onDone) {
                
        var url = l_APIHost + 'apikey/' + _apikey + '/layers';
                              
        var obj = [];
        obj.push(layer);
        
        l_HTTP("POST", url, obj, 
            function (data){
                // TODO: check response
                _layer = layer;
                onDone();
            }
        );              
    }
    
    // delete a created layer
    var l_deleteLayer = this.deleteLayer = function (onDone) {
        
        if (_layer === undefined) {
            return onDone('layer does not exist');
        }
        
        var url = l_APIHost + 'layer/' + _apikey + ':' + _layer;
               
        l_HTTP("DELETE", url, undefined, 
            function (data) {
                _layer = '';
                console.log('delete layer success called');
                onDone();
            }
        );
    }
        
    // create a new node with the service
    var l_createNode = this.createNode = function (name, onDone) {
        
        var url = l_APIHost + 'layer/' + _apikey + ':' + _layer + '/nodes';
                                           
        var obj = [];
        obj.push(name);
        
        l_HTTP("POST", url, obj, 
            function (data){
                _name = name;				                
                _isJoined = true;
                
                // build shortcut
                _ident = _apikey + ':' + _layer + ':' + _name;
                //console.log('create node success, ident: ' + _ident);
                onDone(_ident); 
            }
        );        
    }
    
    // update the meta data info for a node
    var l_updateNode = this.updateNode = function (info, onDone) {
        
        var url = l_APIHost + 'node/' + _ident;
                                           
        //var obj = [];
        //obj.push(info);
        
        //l_HTTP("POST", url, obj, 
        l_HTTP("POST", url, info, 
            function (data){
                if (typeof onDone === 'function')
                    onDone();
            }
        );        
    }    
    
    // get node metadata
    var l_getNode = this.getNode = function (onDone) {
        
        var url = l_APIHost + 'node/' + _ident;
                                                   
        l_HTTP("GET", url, undefined, 
            function (data){
                onDone(data);
            }
        );
    }        
    
    // delete a node
    var l_deleteNode = this.deleteNode = function (onDone) {
    
        if (_ident === undefined)
            return onDone('node not yet created');
                
        var url = l_APIHost + 'node/' + _ident;
        
        console.log('deleteNode: ' + url);
        l_HTTP("DELETE", url, undefined, 
            function (data){
                _name  = undefined;
                _ident = undefined;
				if (typeof onDone === 'function')
					onDone('success');
            }
        );     
    }
        
    // get a list of subscribers for a node
    var l_getNodeSubscribers = this.getNodeSubscribers = function (onDone) {
        
        var url = l_APIHost + 'node/' + _ident + '/subscribers';
                                                   
        l_HTTP("GET", url, undefined, 
            function (data){
                // return array of subscribers, plus error values, if any
                onDone(data[0], data[1]);
            }
        );
    }        
    
    // subscribe updates from a particular node
    var l_subscribeNode = this.subscribeNode = function (ident, onDone) {
        
        var url = l_APIHost + 'node/' + ident + '/subscribers';
        
        // NOTE: we're adding self to the node-to-be-subscribed's subscriber list        
        var obj = [];
        obj.push(_ident);
        
        l_HTTP("POST", url, obj, 
            function (data){
                // return ok or error
				if (typeof onDone === 'function')
					onDone(data[0], data[1]);
            }
        );
    }

    // subscribe updates from a particular node
    var l_unsubscribeNode = this.unsubscribeNode = function (ident, onDone) {
        
        var url = l_APIHost + 'node/' + ident + '/subscribers/' + _ident;
                
        l_HTTP("DELETE", url, undefined, 
            function (data){
                // return ok or error
				if (typeof onDone === 'function')
					onDone(data[0], data[1]);
            }
        );
    }
    
    // query cube
    var l_queryCube = this.queryCube = function (xmin, ymin, zmin, xmax, ymax, zmax, onDone) {

        // check if we've joined
        if (_isJoined === false) {
            console.log('cannot queryCube, not yet joined');
            return onDone([]);
        }
    
        var url = l_APIHost + "spatial/cube/" + _ident + '/' + xmin + "," + ymin + "," + zmin + "," + xmax + "," + ymax + "," + zmax + '/nodes';
                           
        l_HTTP("GET", url, undefined, 
            function (data){
        
                var nodes = [];
                
                // go through each item & update neighbor list
                $.each(data[0], function (idx, msg) {                    
                
                    //console.log(idx + ': ' + msg.ident + ' ' + msg.loc.x + ' ' + msg.loc.y + ' ' + msg.loc.z);
                    // store this neighbor
                    nodes.push(msg);                    
                });
                               
                // notify callback of new neighbors if callback exists
                onDone(nodes, data[1]);            
            }
        );                           
    }
        
    // subscribe nearby
    var l_subscribeNearby = this.subscribeNearby = function (radius, onDone) {
            
        // check if we've joined
        if (_isJoined === false) {
            var msg = 'not yet joined, cannot subscribe nearby';
            console.log(msg);
            return onDone([], [msg]);
        }
        
        // set to default radius if one is not given
        _radius = radius || l_defaultRadius;
        
        console.log('subscribeNearby, radius: ' + radius);
        
        // check if data channel exist or we fallback to periodic query
        if (_isConnected === false) {
        
            // we use periodic query to achieve the subscribe effect if data channel doesn't exist 
            // NOTE: if periodic query is already in motion, don't do anything
            if (_queryIntervalID === undefined)
                _queryIntervalID = setInterval(_periodicQuery, _queryInterval);	
            return onDone([], ['use query']);
        }
                
        var url = l_APIHost + 'spatial/nearby/' + _ident + '/' + _radius + '/subscribers';
        
        // NOTE: necessary to pass in self ident? (duplicate info?)
        var obj = [];
        obj.push(_ident);
        
        l_HTTP("POST", url, obj, 
            function (data){
                if (typeof onDone === 'function')
                    onDone(data[0], data[1]);
            }
        );	
    }	        
        
    // unsubscribe nearby
    var l_unsubscribeNearby = this.unsubscribeNearby = function (onDone) {

        // check if we've joined
        if (_isJoined === false) {
            console.log('not yet joined, cannot subscribe nearby');
            return;
        }
        
        // check if we've subscribed previously
        if (_radius === undefined) {
            console.log('not yet subscribed');
            return;        
        }
        
        var url = l_APIHost + 'spatial/nearby/' + _ident + '/' + _radius + '/subscribers';
                
        l_HTTP("DELETE", url, undefined, 
            function (data){
                onDone(data[0], data[1]);
            }
        );	
    }	         
               
                   
    // send message
    var l_sendMessage = this.sendMessage = function (ident, msg, onDone) {
            
        if (_isJoined === false)
            return onDone('node not yet created, cannot send message');
                
        var url = l_APIHost + "msg/" + ident;
        
        var obj = {
            "msg":  msg,
            "from": _ident
        };
        
        l_HTTP("POST", url, obj, 
            function (data){
                onDone(data[0], data[1]);
            }
        );        
    }

    /*
    // receive message
    this.recvMessage = function (onDone) {

        if (_isJoined === false)
            return onDone('node not yet created, cannot receive message');
                    
        var url = l_APIHost + 'msg/' + _ident + '/new';

        l_HTTP("GET", url, undefined, 
            function (data){
                onDone(data[0], data[1]);
            }
        );        

        success: function (data) {
            
                // if some message exists
                if (data[0].length != 0) {
                
                    // go through each item & update neighbor list
                    $.each(data[0], function (idx, msg) {
                        //console.log('idx: ' + idx + 'msg: ' + msg);
                        var obj = jQuery.parseJSON(msg);
                        onReceived(obj.msg);
                    }); 
                }
            }
    }
    
    
    // query message
    // input: no. of messages to query
    this.queryMessage = function (msg_size, onReceived) {
    
        if (_id === undefined || _layer === undefined) {
            onReceived(null);
            return;
        }
                
        var url = l_APIHost + "query/msg/" + _apikey + "/" + _layer + "/" + _id + "/" + msg_size;

        $.ajax({ 
            type: "GET",
            dataType: "json",
            url: url,
            success: function (data){
                onReceived(data); 
            }
        });
    }
    */
    
    //
    // private helper methods & flags
    //
    
    // format
    /*
        [[{"move":[[55,55,55,123,34,56],"77"],
           "orien":[78,87],
           "loc":[130,33,0],
           "ident":"eb5be55f1975d42a4d7b4ea9e0e74417f7b5a2be:theWOWlayer:wtfName1"},
          {"move":[[55,55,55,123,34,56],"77"],
           "orien":[78,87],
           "loc":[130,33,0],
           "ident":"eb5be55f1975d42a4d7b4ea9e0e74417f7b5a2be:theWOWlayer:wtfName"}
         ],
         []
        ]    
    
    */
    
    // process returned position update results from either Query Cube or Subscribe Nearby/Node
    var _processNodeList = function (nodes) {
    
        // update to neighbor list                
        var updated_list = {};
        
        // whether any update is made (to determine if we should call callback)
        var updated = false;
        
        for (var i=0; i < nodes.length; i++) {

            var node = new GAIASUP.position(
                nodes[i].loc[0],
                nodes[i].loc[1],
                nodes[i].loc[2]);
                                
            // filter out of radius neighbors 
            if (_pos.distance(node) > _radius)
                continue;
                
            node.ident = nodes[i].ident;
            updated_list[node.ident] = node;
            
            // check if this is new or changed neighbor
            if (_neighbors.hasOwnProperty(node.ident)) {
                if (_neighbors[node.ident].equals(node))
                    continue;
            }
            updated = true;
        }
        
        if (Object.keys(_neighbors).length !== Object.keys(updated_list).length)
            updated = true;
                       
        _neighbors = updated_list;
        
        // only notify if neighbors have updated in some way               
        if (updated && typeof _onPosition === 'function')
            _onPosition(_neighbors); 
    }
    
    var _initSocket = function (onDone) {
        
        // first check if socket host is specified, if not then no socket.io support is used
        if (typeof l_SocketHost === 'undefined' && typeof io !== 'undefined') {
            console.log('no SocketHost provided or socket.io not installed');
            return onDone(false);
        }

        console.log('init socket.io connection to: ' + l_SocketHost);            
        var socket = io.connect(l_SocketHost);
        
        // deal with connection once ready
        socket.on('connect', function () {
        
            console.log('socket.io connected...');
            
            // first send handshake
            //socket.emit('USER_LOGIN', {ident: _ident});
        
            // handle when connection to data channel is lost
            socket.on('disconnect', function () {
                console.log('socket.io disconnected...');
                _isConnected = false;                               
            });

            // node update, para is array of updated node info
            socket.on('update', function (entity_type, data) {
                console.log('UPDATE');
				console.log(entity_type + ' ' + JSON.stringify(data));
				                
                var updates = [];
                for (var i=0; i < data.length; i++) {
				
					console.log('payload ' + i);					
					var payload = data[i];
					console.log(payload);
					
					console.log('type: ' + payload.type);
						
                    var item = {
                        type: 'UPDATED',
                        node: payload
                    };
                    updates.push(item);
                }
                
                // use callback to notify changes
                _onPosition(updates); 
            });
            
            // neighbor leaving, para is array of leaving nodes' ident
            socket.on('left', function (entity_type, data) {
                console.log('LEFT');
				console.log(entity_type + ' ' + JSON.stringify(data));				
				                
                var updates = [];
                for (var i=0; i < data.length; i++) {
					console.log('payload ' + i);		
					var payload = data[i];
					console.log(payload);
										
                    var item = {
                        type: 'LEFT',
                        node: {
                            ident: payload
                        }
                    };
                    updates.push(item);
                }
                
                // use callback to notify changes
                _onPosition(updates);                 
            }); 

            // node entering, para is array of node info
            socket.on('entered', function (entity_type, data) {
                console.log('ENTERED');
				console.log(entity_type + ' ' + JSON.stringify(data));				
				                				 
                var updates = [];
                for (var i=0; i < data.length; i++) {
					console.log('payload ' + i);					
					var payload = data[i];
					console.log(payload);
										
                    var item = {
                        type: 'ENTERED',
                        node: payload
                    };
                    updates.push(item);
           
                }
                
                // use callback to notify changes
                _onPosition(updates);               
            });            

            // send initial registeration request to server
            socket.emit('register', _apikey, _layer, _name, function (result, id) {
                console.log('register result: ' + result + ' id: ' + id);
                _isConnected = true;
                
                // connect success
                onDone(true);                
            });            
        });

        socket.on('error', function (err) {
            console.log('socket init error:');
            console.log(err);
            onDone(false);
        });
    }
    
    // if socket mode is not supported, then periodically query for nodes in subscribed area
    var _periodicQuery = function () {
            
        var xmin = _pos.x - _radius;
        var ymin = _pos.y - _radius;
        var zmin = _pos.z - _radius;
        var xmax = _pos.x + _radius;
        var ymax = _pos.y + _radius;
        var zmax = _pos.z + _radius;
        
        // do not query if node is not yet created		
        l_queryCube(xmin, ymin, 0, xmax, ymax, 0, 
            function (nodes, error) {
                
                if (error.length > 0)
                    console.log(error);
                
                _processNodeList(nodes);               
            }
        );
    }	  	
                                    
} // end of node
    
GAIASUP.create = function () {
    return new GAIASUP.node();
} // end of create    

// check the existence of a node
GAIASUP.existNode = function (ident, onDone) {

    if (ident === undefined)
        return onDone('error', 'ident is not specified');
            
    var url = l_APIHost + 'node/' + ident + '/exist';
    
    l_HTTP("GET", url, undefined, 
        function (data){
            // return result of existence check, plus potential error
            onDone(data[0], data[1]);
        }
    );     
}    

    
})();


