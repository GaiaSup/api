
/*    
    gaiaAPI: javascript binding for the GaiaSup spatial pub/sub service
    
    Usage: please see API documentation        
*/


// create the gaia container
window.GAIASUP = window.GAIASUP || {};
(function () {

//
//  Config
//

// API server's hostname
var l_APIhost = "http://api.gaiasup.com/";              

// how long a query request is made after subscribed (in millisecond)
var l_defaultQueryInterval = 1000;

// default subscribe nearby radius
var l_queryRadius = 500;

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
    
    if (obj !== undefined)
        request.data = JSON.stringify(obj);
        
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
    var _pos_CB = undefined;  
    
    // message callback
    var _msg_CB = undefined;
    
    // unique ident composing of apikey:layer:name
    var _ident = undefined;
    
    // radius for subscribing nearby messages / shop
    var _radius = undefined;
    
    // current position for node
    var _pos = new GAIASUP.position();   

    // interval to query for nearby neighbors
    var _queryInterval = l_defaultQueryInterval;
    
    // query radius (for subscribeNearby)
    var _queryRadius = l_queryRadius;
    
    // periodic query interval ID
    // TODO: remove this? (change to long-polling)
    var _queryIntervalID = undefined;
    
    // whether we've registered layer & node name
    var _isJoined = false;	
    
    // a list of neighbors
    var _neighbors = {};
    
    
    //
    // public method
    //
    
    // initialize a node
    this.init = function (info, done_CB) {
        
        // check if required fields exist
        if (typeof info.apikey !== 'string' ||
            typeof info.layer  !== 'string' ||
            typeof info.name   !== 'string') {
        
            console.log('cannot init a node: apikey / layer / name missing');
            done_CB("error: missing apikey / layer/ name");
            return;
        }
        
        // store required info to initialize
        _apikey = info.apikey;
        
        // store optional callback when updates are available
        _pos_CB = info.pos_CB;
        _msg_CB = info.msg_CB;

        // store optional API host, if available
        if (info.hasOwnProperty('APIhost') === true)
            l_APIhost = info.APIhost;
        
        // perform registeration of layer & node
        l_registerLayer(info.layer, function () {
            //console.log('register layer done');
            l_registerNode(info.name, function () {
            
                //console.log('register node done');
                done_CB();
            });        
        });
    }
    
    // close down a node
    this.shut = function (done_CB) {
        l_revokeNode(done_CB);
    }
                  
    // subscribe area/nearby/cube/node
    this.subscribe = function (para, done_CB, interval) {

        done_CB = done_CB || function () {};
    
        // check if radius exists
        if (typeof para.radius !== 'undefined') {
        
            // case 1: subscribe area
            if (typeof para.center !== 'undefined') {
            
            }
            // case 2: subscribe nearby
            else {
                _queryRadius = para.radius;
                
                // we use periodic query to achieve the effect of subscribe nearby for now
                // NOTE: if periodic query is already in motion, don't do anything
                if (_queryIntervalID === undefined)
                    _queryIntervalID = setInterval(_periodicQuery, _queryInterval);	
                                
                // TODO: need to establish a second data channel for subscribeNearby to work
                //l_subscribeNearby(_queryRadius, done_CB);
            }
        }
        // case 3: subscribe node
        else if (typeof para.node !== 'undefined') {
        
            done_CB();
        }
        else {
            console.log('unrecognize subscribe type');
            return done_CB();
        }
                    
        // store query interval, if available
        if (interval !== undefined)
            _queryInterval = interval;	
    }

    // publish position/node/message 
    //  para = 
    //  {
    //      pos,        // position update
    //      msg         // message publication at current position
    //  }
    this.publish = function (para, done_CB) {
    
        done_CB = done_CB || function () {};
        
        // case 1: point publication (send a message at a position but do not change node position
        if (typeof para.pos !== 'undefined' && typeof para.msg !== 'undefined') {
            //console.log('point publication..');
            done_CB();
            return;
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
            }, done_CB);
        
            return;
        }
        
        // case 3: message publication
        if (typeof para.msg !== 'undefined') {
            //console.log('publish message..'); 
            done_CB();
            return;
        }        
    }
    
    // output method
    this.toString = function () {
        
        return '[' + _ident + '] (' + _pos.x + ', ' + _pos.y + ', ' + _pos.z + ')';
    }
    
    // whether we've joined successfully (registered finished)
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

    // register the layer to be used for this gaiaNode
    var l_registerLayer = this.registerLayer = function (layer, onDone) {
                
        var url = l_APIhost + 'apikey/' + _apikey + '/layers';
                              
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
    
    // revoke a registered layer
    var l_revokeLayer = this.revokeLayer = function (onDone) {
        
        if (_layer === undefined) {
            onDone('layer does not exist');
            return;
        }
        
        var url = l_APIhost + 'layer/' + _apikey + ':' + _layer;
               
        l_HTTP("DELETE", url, undefined, 
            function (data) {
                _layer = '';
                console.log('revoke layer success called');
                onDone();
            }
        );       
    }
        
    // register a new node with the service
    var l_registerNode = this.registerNode = function (name, onDone) {
        
        var url = l_APIhost + 'layer/' + _apikey + ':' + _layer + '/nodes';
                                           
        var obj = [];
        obj.push(name);
        
        l_HTTP("POST", url, obj, 
            function (data){
                _name = name;				                
                _isJoined = true;
                
                // build shortcut
                _ident = _apikey + ':' + _layer + ':' + _name;
                //console.log('register node called, ident: ' + _ident);
                onDone(_ident); 
            }
        );        
    }
    
    // update the meta data info for a node
    var l_updateNode = this.updateNode = function (info, onDone) {
        
        var url = l_APIhost + 'node/' + _ident;
                                           
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
        
        var url = l_APIhost + 'node/' + _ident;
                                                   
        l_HTTP("GET", url, undefined, 
            function (data){
                onDone(data);
            }
        );
    }        
    
    // unregister a node
    var l_revokeNode = this.revokeNode = function (onDone) {
    
        if (_ident === undefined)
            return onDone('node not yet registered');
                
        var url = l_APIhost + 'node/' + _ident;
        
        l_HTTP("DELETE", url, undefined, 
            function (data){
                _name  = undefined;
                _ident = undefined;
                onDone('success');
            }
        );     
    }
        
    // get a list of subscribers for a node
    var l_getNodeSubscribers = this.getNodeSubscribers = function (onDone) {
        
        var url = l_APIhost + 'node/' + _ident + '/subscribers';
                                                   
        l_HTTP("GET", url, undefined, 
            function (data){
                // return array of subscribers, plus error values, if any
                onDone(data[0], data[1]);
            }
        );
    }        
    
    // subscribe updates from a particular node
    var l_subscribeNode = this.subscribeNode = function (ident, onDone) {
        
        var url = l_APIhost + 'node/' + ident + '/subscribers';
        
        // NOTE: we're adding self to the node-to-be-subscribed's subscriber list        
        var obj = [];
        obj.push(_ident);
        
        l_HTTP("POST", url, obj, 
            function (data){
                // return ok or error
                onDone(data[0], data[1]);
            }
        );
    }

    // subscribe updates from a particular node
    var l_unsubscribeNode = this.unsubscribeNode = function (ident, onDone) {
        
        var url = l_APIhost + 'node/' + ident + '/subscribers/' + _ident;
                
        l_HTTP("DELETE", url, undefined, 
            function (data){
                // return ok or error
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
    
        var url = l_APIhost + "spatial/cube/" + _ident + '/' + xmin + "," + ymin + "," + zmin + "," + xmax + "," + ymax + "," + zmax + '/nodes';
                           
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
            console.log('not yet joined, cannot subscribe nearby');
            return;
        }
        
        var url = l_APIhost + 'spatial/nearby/' + _ident + '/' + radius + '/subscribers';
        
        // NOTE: necessary to pass in self ident? 
        var obj = [];
        obj.push(_ident);
        
        l_HTTP("POST", url, obj, 
            function (data){
                _radius = radius;
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
        
        var url = l_APIhost + 'spatial/nearby/' + _ident + '/' + _radius + '/subscribers';
                
        l_HTTP("DELETE", url, undefined, 
            function (data){
                onDone(data[0], data[1]);
            }
        );	
    }	         
        
        
    /*               
    // send message
    this.sendMessage = function (msg, onDone) {
            
        if (_id === undefined || _layer === undefined) {
            onDone('node not yet registered');
            return;
        }
                
        var url = l_APIhost + "msg/send/";

        // prepare targets
        var targets = [];
        
        for (var key in _neighbors) {
           
            //alert('neighbor: ' + _neighbors[key].id);
            var node = _neighbors[key];
            
            // skip self
            if (node.id === _id)
                continue;
                
            console.log('sendmsg to: ' + node.id);
            targets.push(
                {
                    "layer": _layer,
                    "ident": node.id,
                    "apikey": _apikey
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
                onDone('success'); 
            }
        });
    }

    // receive message
    this.recvMessage = function (onReceived) {
    
        if (_id === undefined || _layer === undefined) {
            onReceived('node not yet registered');
            return;
        }
                
        var url = l_APIhost + "msg/recv/";
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
                        onReceived(obj.msg);
                    }); 
                }
            }
        });
    }

    // query message
    // input: no. of messages to query
    this.queryMessage = function (msg_size, onReceived) {
    
        if (_id === undefined || _layer === undefined) {
            onReceived(null);
            return;
        }
                
        var url = l_APIhost + "query/msg/" + _apikey + "/" + _layer + "/" + _id + "/" + msg_size;
        //alert('register node: ' + url);        
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
                
    var _periodicQuery = function () {
            
        var xmin = _pos.x - _queryRadius;
        var ymin = _pos.y - _queryRadius;
        var zmin = _pos.z - _queryRadius;
        var xmax = _pos.x + _queryRadius;
        var ymax = _pos.y + _queryRadius;
        var zmax = _pos.z + _queryRadius;
        
        // do not query if node is not yet registered		
        l_queryCube(xmin, ymin, 0, xmax, ymax, 0, 
            function (nodes, error) {
                
                if (error.length > 0)
                    console.log(error);
                
                //console.log('neighbor size: ' + Object.keys(neighbors).length);
                // update to neighbor list                
                var updated_list = {};
                var updated = false;
                
                for (var i=0; i < nodes.length; i++) {

                    var node = new GAIASUP.position(
                        nodes[i].loc[0],
                        nodes[i].loc[1],
                        nodes[i].loc[2]);
                                        
                    // filter out of radius neighbors 
                    if (_pos.distance(node) > _queryRadius)
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
                if (updated && typeof _pos_CB === 'function')
                    _pos_CB(_neighbors);
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
            
    var url = l_APIhost + 'node/' + ident + '/exist';
    
    l_HTTP("GET", url, undefined, 
        function (data){
            // return result of existence check, plus potential error
            onDone(data[0], data[1]);
        }
    );     
}    

    
})();


