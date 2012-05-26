/* This is a version of SmilModel which uses custom objects instead of annotating the DOM. It was created to analyze memory usage.*/

SmilNode = function() {
    this.model = null;
    this.parent = null;
    this.setModel = function(m) {
        this.model = m;
    }
};

TimeContainerNode = function() {
  this.epubtype = "";
  this.children = [];  
};
TimeContainerNode.prototype = new SmilNode();

MediaNode = function() {
    this.src = "";
};
MediaNode.prototype = new SmilNode();

SeqNode = function() {
	this.children = [];
    this.textref = "";
    // render starting at the given node; if null, start at the beginning
    this.render = function(node) {
        // if this node should be skipped, then fast-forward through it
        if (this.model.mustSkip(this)) {
            this.parent.notifyChildDone(this);
            return;
        }
        this.model.setCurrentTimeContainer(this);
        
        if (node == null) {
            this.children[0].render();
        }
        else {
            node.render();
        }
    };
            
    // receive notice that a child node has finished playing
    this.notifyChildDone = function(node) {
        if (node.nextSibling == null) {
            if (this.parent == null) {
                this.model.notifySmilDone(this);
            }
            else {
                this.parent.notifyChildDone(this);
            }
        }
        else {
            // prepare to play the next child node
            this.render(node.nextSibling);
        }
    };
};
SeqNode.prototype = new TimeContainerNode();

ParNode = function() {
    this.children = [];
    this.render = function() {
        // if this node should be skipped, then fast-forward through it
        if (this.model.mustSkip(this)) {
            this.parent.notifyChildDone(this);
            return;
        }
        this.model.setCurrentTimeContainer(this);
        
        $.each(this.children, function(idx, val) {
            if (val.hasOwnProperty("render")) {
                val.render();
            }
        });
    };
    // receive notice that a child node has finished playing
    this.notifyChildDone = function(node) {
        // we're only expecting one audio node child that we have to wait for
        // in the case of a more complex SMIL document (i.e. not media overlays), 
        // we might have to wait for more children to finish playing
        if (node instanceof AudioNode) {
            this.parent.notifyChildDone(this);
        }
    };
};
ParNode.prototype = new TimeContainerNode();

TextNode = function() {
    this.notifyChildDone = function(){};
};
TextNode.prototype = new MediaNode();

AudioNode = function() {
    this.clipBegin = "";
    this.clipEnd = "";
    // called when the clip has completed playback
    this.notifyChildDone = function() {
        this.parent.notifyChildDone(this);
    };
};
AudioNode.prototype = new MediaNode();    

SmilModel = function() {
    var notifySmilDoneFn = null;
    var notifyCanEscapeFn = null;
    
    var currentTimeContainer = null;
    
    var mustSkipTypes = [];
    var mayEscapeTypes = [];
    
    var root = null;
    
    this.setRoot = function(rootNode) {
        root = rootNode;
    };
    
    // set the callback for when the tree is done
    this.setNotifySmilDone = function(fn) {
        notifySmilDoneFn = fn;
    };
    
    // set the callback for notifying about escapability
    this.setNotifyCanEscape = function(fn) {
        notifyCanEscapeFn = fn;
    };
    
    // prepare the tree to start rendering from a node
    this.render = function(node) {
        if (node == null || node == root) {
            root.render(null);
        }
        else {
            // if we're jumping to a point in the middle of the tree, then mark the first audio clip as a jump target
            // because it affects audio playback
            var jumpToNode = node;
            // start our search from the parent element
            if (node instanceof TextNode) {
                jumpToNode = node.parent;
            }
            var audioNode = findFirstInSubtree(jumpToNode, AudioNode);
            audioNode.isJumpTarget = true;
            node.parent.render(node);
        }
    };
    // must specify at least nodetype or attributes or both
    // attributes is a name-value list {"attrname": value, ... }
    this.findNode = function(nodetype, attributes) {
        return findFirstInSubtree(root, nodetype, attributes);
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
            // time containers always have an epubtype property
            while(mayEscapeTypes.indexOf(node.epubtype) == -1 && node != root) {
                node = node.parent;
            }
            
            // special case: escaping the root of the document
            if (node == root) {
                notifySmilDone();
            }
            else {
                node.parent.notifyChildDone(node);
            }
        }
    };
    
    // let the model know what node is playing
    this.setCurrentTimeContainer = function(node) {
        if (node instanceof TimeContainerNode) {
            currentTimeContainer = node;
            var canEscapeNode = this.canEscape(node);
            notifyCanEscapeFn(canEscapeNode);
        }
    };
    
    // the root is done with playback
    this.notifySmilDone = function(node) {
        notifySmilDoneFn();
    };
    
    // see if this node or any of its ancestors is of a type that is currently set to be skipped
    this.mustSkip = function(node) {
        var isInList = node.hasOwnProperty("epubtype") && mustSkipTypes.indexOf(node.epubtype) != -1;
        
        if (node == root) {
            return isInList;
        }
        return isInList || this.mustSkip(node.parent);
    };
    
    // simple debugging function
    this.smilNodeToString = function(node) {
        var str = "<";
        if (node instanceof SeqNode) {
            str += "seq";
        }
        else if (node instanceof ParNode) {
            str += "par";
        }
        else if (node instanceof AudioNode) {
            str += "audio";
        }
        else if (node instanceof TextNode) {
            str += "text";
        }
    
        var properties = ["id", "epubtype", "textref", "src", "clipBegin", "clipEnd"];
    
        for (var i = 0; i<properties.length; i++) {
            var p = properties[i];
            if (node.hasOwnProperty(p) && node[p] != "" && node[p] != null) {
                str += " " + p + "='" + node[p] + "'";
            }
        }
        str += ">";
        return str;
    };
    
    this.canEscape = function(node) {
        var isInList = node.hasOwnProperty("epubtype") && mayEscapeTypes.indexOf(node.epubtype) != -1;
        
        if (node == root) {
            return isInList;
        }
        return isInList || this.canEscape(node.parent);
    };
    
    
    // find the first occurrence of the node of the given type with the given property name/value pair(s)
    // you must specify at least nodetype or properties
    function findFirstInSubtree(node, nodetype, properties) {
        if (nodetype == undefined && properties == undefined) {
            return null;
        }
        
        // if nodetype is not specified, or if it's specified and we have a match
        var isRightType = (nodetype == undefined || nodetype == null || nodetype == "") || node instanceof nodetype;
        
        var hasProps = true;
        // look at the properties to see if they match
        if (properties != undefined && properties != null) {
            var propkeys = Object.keys(properties);
            
            $.each(propkeys, function(idx, val) {
                var hasProp = node.hasOwnProperty(val) && node[val] == properties[val];
                hasProps = hasProps && hasProp;
            });
        }
        if (hasProps && isRightType) {
            return node;
        }
        
        var res = null;
        if (node.hasOwnProperty("children")) {
            $.each(node.children, function(idx, val) {
                res = findFirstInSubtree(val, nodetype, properties);
                if (res != null) {
                    return false; // break out of $.each
                }
            });
        }
        return res;
    }
};

// build a SmilModel from a DOM
SmilModelBuilder = function() {
    var audioRender = null;
    var textRender = null;
    var url = "";
    var model = null;
        
    // build the model
    // node is the body node of the SMIL DOM
    this.build = function(node, audioRenderFn, textRenderFn, baseUrl) {
        audioRender = audioRenderFn;
        textRender = textRenderFn;
        url = baseUrl;
        model =  new SmilModel();
        var root = processTree(node); // TODO
        model.setRoot(root);
        return model;
    };
    
    // recursively process a SMIL XML DOM
    function processTree(elm) {
        var smilnode = nodeFactory(elm);
        var prevnode = null;
        $.each(elm.childNodes, function(idx, val) {
            if (val.nodeType == val.ELEMENT_NODE) {
                var child = processTree(val);
                child.parent = smilnode;
                if (prevnode != null) {
                    prevnode.nextSibling = child;
                }
                prevnode = child;
                smilnode.children.push(child);
            }
        });
        
        return smilnode;
    }       
        
    // create a node and process its attributes
    // TODO do we resolve text@src and seq@epub:textref or does Readium want relative paths?
    function nodeFactory(elm) {    
        var node  = null;
        return new TimeContainerNode();
        if (elm.tagName == "seq" || elm.tagName == "body") {
            node = new SeqNode();
            var epubtype = elm.getAttribute("epub:type");
            var textref = elm.getAttribute("epub:textref");
            if (textref != null) {
                node.textref = textref;
            }
            if (epubtype != null) {
                node.epubtype = epubtype;
            }
        }
        
        else if (elm.tagName == "par") {
            node = new ParNode();
            var epubtype = elm.getAttribute("epub:type");
            if (epubtype != null) {
                node.epubtype = epubtype;
            }
        }
        
        else if (elm.tagName == "text") {
            node = new TextNode();
            node.render = textRender;
            var src = elm.getAttribute("src");
            if (src != null) {
                node.src = src;
            }
        }
        
        else if (elm.tagName == "audio") {
            node = new AudioNode();
            node.render = audioRender;
            var src = elm.getAttribute("src");
            var clipBegin = elm.getAttribute("clipBegin");
            var clipEnd = elm.getAttribute("clipEnd");
            if (src != null) {
                node.src = resolveUrl(src, url);
            }
            if (clipBegin != null) {
                node.clipBegin = resolveClockValue(clipBegin);
            }
            else {
                node.clipBegin = 0;
            }
            if (clipEnd != null) {
                node.clipEnd = resolveClockValue(clipEnd);
            }
            else {
                // TODO check if this is reasonable
                node.clipEnd = 9999999;
            }
        }
        
        if (node != null) {
            var id = elm.getAttribute("id");
            if (id != null) {
                node.id = id;
            }
            node.setModel(model);
        }
        return node;
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
        else {
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
        }
        
        var total = hours * 3600 + mins * 60 + secs;
        return total;
    }
};
