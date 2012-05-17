// SmilModel both creates and plays the model
// Right now, the model extends the SMIL XML DOM; 
// if this becomes too heavy, we could use a custom lightweight tree instead
SmilModel = function() {
    
    // these are playback logic functions for SMIL nodes
    // the context of each function is the node itself, as these functions will be attached to the nodes as members
    // e.g. 
    // parNode.render = parRender
    // seqNode.render = seqRender
    // etc
    NodeLogic = {
        
        parRender: function() {
            // if this node should be skipped, then fast-forward through it
            if (mustSkip(this)) {
                this.parentNode.notifyChildDone(this);
                return;
            }
            currentTimeContainer = this;
            notifyCanEscape(canEscape(this));
            $.each(this.childNodes, function(index, value) {
                if (value.hasOwnProperty("render")) {
                    value.render();
                }
            });
        },
    
        // render starting at the given node; if null, start at the beginning
        seqRender: function(node) {
            // if this node should be skipped, then fast-forward through it
            if (mustSkip(this)) {
                this.parentNode.notifyChildDone(this);
                return;
            }
            currentTimeContainer = this;
            notifyCanEscape(canEscape(this));
            if (node == null) {
                this.firstElementChild.render();
            }
            else {
                node.render();
            }
        },
    
        // called when the clip has completed playback
        audioNotifyChildDone: function() {
            this.parentNode.notifyChildDone(this);
        },
    
        // receive notice that a child node has finished playing
        parNotifyChildDone: function(node) {
            // we're only expecting one audio node child that we have to wait for
            // in the case of a more complex SMIL document (i.e. not media overlays), 
            // we might have to wait for more children to finish playing
            if (node.tagName == "audio") {
                this.parentNode.notifyChildDone(this);
            }
        },
    
        // receive notice that a child node has finished playing
        seqNotifyChildDone: function(node) {
            if (node.nextElementSibling == null) {
                if (this == root) {
                    notifySmilDone();
                }
                else {
                    this.parentNode.notifyChildDone(this);
                }
            }
            else {
                // prepare to play the next child node
                this.render(node.nextElementSibling);
            }
        }
    };
    
    
    // default renderers for time container playback
    // treat <body> like <seq>
    var renderers = {"seq": NodeLogic.seqRender, 
                    "par": NodeLogic.parRender, 
                    "body": NodeLogic.seqRender};
                    
    // each node type has a notification function associated with it
    // the notifiers get called when a child of the node has finished playback
    var notifiers = {"seq": NodeLogic.seqNotifyChildDone, 
                    "par": NodeLogic.parNotifyChildDone, 
                    "body": NodeLogic.seqNotifyChildDone,
                    "audio": NodeLogic.audioNotifyChildDone,
                    "text": function() {}}
    var url = null;
    var notifySmilDone = null;
    var notifyCanEscape = null;
    
    var root = null;
    var currentTimeContainer = null;
    
    var mustSkipTypes = [];
    var mayEscapeTypes = [];
    
    // call this first with the media node renderers to add them to the master list
    this.addRenderers = function(rendererList) {
        renderers = $.extend(renderers, rendererList);
    };
    
    // set this so the model can resolve src attributes
    this.setUrl = function(fileUrl) {
        url = fileUrl;
    };
    
    // set the callback for when the tree is done
    this.setNotifySmilDone = function(fn) {
        notifySmilDone = fn;
    };
    
    // set the callback for notifying about escapability
    this.setNotifyCanEscape = function(fn) {
        notifyCanEscape = fn;
    };
    
    // build the model
    // node is the root of the SMIL tree, for example the body node of the DOM
    this.build = function(node) {
        root = node;
        processTree(node, 0);
    };
    
    // prepare the tree to start rendering from a node
    this.render = function(node) {
        if (node == null || node == root) {
            root.render(null);
        }
        else {
            // if we're jumping to a point in the middle of the tree, then mark the first audio clip as a jump target
            // because it affects audio playback
            var audioNode = this.peekNextAudio(node, false);
            audioNode.isJumpTarget = true;
            node.parentNode.render(node);
        }
    };
    
    this.findNodeByAttrValue = function(nodename, attr, val) {
        return $(root).find(nodename + "[" + attr + "='" + val + "']")[0];
    };
    
    this.addSkipType = function(name) {
       if (mustSkipTypes.indexOf(name) == -1) {
           mustSkipTypes.push(name);
       }
    };
    
    this.removeSkipType = function(name) {
        mustSkipTypes = jQuery.grep(mustSkipTypes, function(val) {
            return val != name;
        });
    };
    
    this.addEscapeType = function(name) {
        if (mayEscapeTypes.indexOf(name) == -1) {
            mayEscapeTypes.push(name);
        }
    };
    
    this.removeEscapeType = function(name) {
        mustEscapeTypes = jQuery.grep(mustEscapeTypes, function(val) {
            return val != name;
        });
    };
    
    this.escape = function() {
        if (canEscape(currentTimeContainer)) {
            // find the nearest epub:type
            var node = currentTimeContainer;
            
            while(mayEscapeTypes.indexOf($(node).attr("epub:type")) == -1 && node != root) {
                node = node.parentNode;
            }
            
            // special case: escaping the root of the document
            if (node == root) {
                notifySmilDone();
            }
            else {
                node.parentNode.notifyChildDone(node);
            }
        }
    };
    
    // see what the next audio node is going to be
    // TODO take skippability into consideration
    this.peekNextAudio = function(node) {
        
        // these first 2 cases are arguably just here for convenience: if we're near an audio node, then return it
        // TODO this does not consider that audio elements are actually optional children of <par>
        if (node.tagName == "par") {
            return $(node).find("audio")[0];
        }
        // TODO same as above
        if (node.tagName == "text") {
            return $(node.parentNode).find("audio")[0];
        }
        
        // if we aren't near an audio node, then keep looking
        var tmpnode = node.parentNode;
        // go up the tree until we find a relative
        while(tmpnode.nextElementSibling == null) {
            tmpnode = tmpnode.parentNode;
            if (tmpnode == root) {
                return null;
            }
        }
        // find the first audio node
        return $(tmpnode.nextElementSibling).find("audio")[0];
    };
    
    // recursively process a SMIL XML DOM
    function processTree(node) {
        processNode(node);
        if (node.childNodes.length > 0) {
            $.each(node.childNodes, function(idx, val) {
                processTree(val);
            });
        }
    }       
    
    // process a single node and attach render and notify functions to it
    function processNode(node) {
        // add a toString method for debugging
        node.toString = function() {
            var string = "<" + this.nodeName;
        	for (var i = 0; i < this.attributes.length; i++) {
        		string += " " + this.attributes.item(i).nodeName + "=" + this.attributes.item(i).nodeValue;
        	}
        	string += ">";
            return string;
        };
        
        // connect the appropriate renderer
        if (renderers.hasOwnProperty(node.tagName)) {
            node.render = renderers[node.tagName];
        }
        
        // connect the appropriate notifier
        if (notifiers.hasOwnProperty(node.tagName)) {
            node.notifyChildDone = notifiers[node.tagName];
        }
        
        scrubAttributes(node);
    }
    
    // make sure the attributes are to our liking
    function scrubAttributes(node) {
        // TODO do we need to resolve the text srcs too, or does Readium want relative paths?
        
        // process audio nodes' clock values
        if (node.tagName == "audio") {
            if ($(node).attr("src") != undefined) {
                $(node).attr("src", resolveUrl($(node).attr("src"), url));
            }    
            if ($(node).attr("clipBegin") != undefined) {
                $(node).attr("clipBegin", resolveClockValue($(node).attr("clipBegin")));
            }
            else {
                $(node).attr("clipBegin", 0);
            }
            if ($(node).attr("clipEnd") != undefined) {
                $(node).attr("clipEnd", resolveClockValue($(node).attr("clipEnd")));
            }
            else {
                // TODO check if this is reasonable
                $(node).attr("clipEnd", 9999999);
            }
        }
    }
    
    // see if this node or any of its ancestors is of a type that is currently set to be skipped
    function mustSkip(node) {
        var isInList = mustSkipTypes.indexOf($(node).attr("epub:type")) != -1;
        
        if (node == root) {
            return isInList;
        }
        return isInList || mustSkip(node.parentNode);
    }
    
    function canEscape(node) {
        var isInList = mayEscapeTypes.indexOf($(node).attr("epub:type")) != -1;
        
        if (node == root) {
            return isInList;
        }
        return isInList || canEscape(node.parentNode);
    }
    
    function resolveUrl(url, baseUrl) {
        if (url.indexOf("://") != -1) {
            return url;
        }
        
        var base = baseUrl;
        if (baseUrl[baseUrl.length-1] != "/") {
            base = baseUrl.substr(0, baseUrl.lastIndexOf("/") + 1);
        }
        return base + url;
    }
    
    // parse the timestamp and return the value in seconds
    // supports this syntax: http://idpf.org/epub/30/spec/epub30-mediaoverlays.html#app-clock-examples
    function resolveClockValue(value) {        
        var hours = 0;
        var mins = 0;
        var secs = 0;
        
        // parse as hh:mm:ss.fraction
        // this also works for seconds-only, e.g. 12.345
        arr = value.split(":");
        secs = parseFloat(arr.pop());
        if (arr.length > 0) {
            mins = parseFloat(arr.pop());
            if (arr.length > 0) {
                hours = parseFloat(arr.pop());
            }
        }
        // look for unit 's', 'h', 'min', 'ms'
        else {
            if (value.indexOf("min") != -1) {
                mins = parseFloat(value.substr(0, value.indexOf("min")));
            }
            else if (value.indexOf("ms") != -1) {
                var ms = parseFloat(value.substr(0, value.indexOf("ms")));
                secs = ms/1000;
            }
            else if (value.indexOf("s") != -1) {
                secs = parseFloat(value.substr(0, value.indexOf("s")));                
            }
            else if (value.indexOf("h") != -1) {
                hours = parseFloat(value.substr(0, value.indexOf("h")));                
            }
        }
        var total = hours * 3600 + mins * 60 + secs;
        return total;
    }
};