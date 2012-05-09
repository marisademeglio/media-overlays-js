// loads and plays a single SMIL document
MediaOverlaysModel = Backbone.Model.extend({
    audioplayer: null,
    smilModel: null,
    smilUrl: null,
    
    // observable properties
    defaults: {
        is_ready: false,
        is_document_done: false,
        is_playing: false,
        should_highlight: true,
        current_text_document: null,
        current_text_fragment: null        
    },
    
    initialize: function() {
        var self = this;
        this.audioplayer = new AudioClipPlayer();

        // always know whether we're playing or paused
        this.audioplayer.setNotifyOnPause(function() {
            self.set({is_playing: self.audioplayer.isPlaying()});
        });
        this.audioplayer.setNotifyOnPlay(function(){
           self.set({is_playing: self.audioplayer.isPlaying()});
        });
        
    },
    // load a file; must provide a 'url' option
    fetch: function(options) {
        this.set({is_ready: false});
        this.smilUrl = options.url;
        options || (options = {});
        options.dataType="xml";
        Backbone.Model.prototype.fetch.call(this, options);
    },
    // backbone fetch() callback
    parse: function(xml) {
        var self = this;
        this.smilModel = new SmilModel();
        this.smilModel.setUrl(this.smilUrl);
        this.smilModel.setNotifySmilDone(function() {
            self.set({is_document_done: true});
        });
        
        // very important piece of code: attach render functions to the model
        // at runtime, 'this' is the node in question
        self.smilModel.addRenderers({
            "audio": function() {
                // have the audio player inform the node directly when it's done playing
                var thisNode = this;
                self.audioplayer.setNotifyClipDone(function() {
                    thisNode.notifyChildDone();
                });
                // play the node
                self.audioplayer.play($(this).attr("src"), $(this).attr("clipBegin"), $(this).attr("clipEnd"));
            }, 
            "text": function(){
                var src = $(this).attr("src");
                // broadcast the text properties so that any listeners can do the right thing wrt loading/highlighting text
                self.set({
                    current_text_document: MOUtils.stripFragment(src), 
                    current_text_fragment: MOUtils.getFragment(src)
                });
            }
        });
        
        // start the playback tree at <body>
        var smiltree = $(xml).find("body")[0]; 
        self.smilModel.build(smiltree);
        self.set({is_ready: true});
    },
    // start playback
    // node is a SMIL node that indicates the starting point
    // if node is null, playback starts at the beginning
    play: function(node) {
        this.set({is_document_done: false});
        if (this.get("is_ready") == false) {
            return;
        }
        this.smilModel.render(node);        
    },
    pause: function() {
        this.audioplayer.pause();
    },
    resume: function() {
        this.audioplayer.resume();        
    },
    findNodeByTextSrc: function(src) {
        return this.smilModel.findNodeByAttrValue("text", "src", src);
    }   
});

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
            $.each(this.childNodes, function(index, value) {
                if (value.hasOwnProperty("render")) {
                    value.render();
                } 
            });
        },
    
        seqRender: function() {
            var idx = this.playbackIndex;
            
            // we have to test for this here as well as in seqNotifyChildDone
            // because the index could have been increased for nodes that aren't being played (e.g. xml text nodes)
            if (idx >= this.childNodes.length - 1) {
                // the top of our playback tree is <body>, not <smil>
                if (this.parentNode != null && this.parentNode.tagName != "smil") {
                    this.parentNode.notifyChildDone(this);
                }
                else {
                    notifySmilDone();
                }                
            }
            else {
                if (this.childNodes[idx].hasOwnProperty("render")) {
                    this.childNodes[idx].render();
                }
                // some child nodes, e.g. xml text nodes, won't have a 'render' property, so we can skip them
                else {
                    this.playbackIndex++;
                    this.render();
                }
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
            var idx = this.playbackIndex;
            if (idx >= this.childNodes.length - 1) {
                // the top of our playback tree is <body>, not <smil>
                if (this.parentNode != null && this.parentNode.tagName != "smil") {
                    this.parentNode.notifyChildDone(this);
                }
                else {
                    notifySmilDone();
                }
            }
            else {
                // prepare to play the next child node
                this.playbackIndex++;
                this.render();
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
    
    var root = null;
    
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
    
    // build the model
    // node is the root of the SMIL tree, for example the body node of the DOM
    this.build = function(node) {
        root = node;
        processTree(node);
    };
    
    // prepare the tree to start rendering from a node
    this.render = function(node) {
        if (node == null || node == root) {
            // set the playback index to 0 on all the seqs
            $(root).find("seq").playbackIndex = 0;   
        }
        else {
            createPathToNode(node);
        }
        root.render();
    };
    
    this.findNodeByAttrValue = function(nodename, attr, val) {
        return $(root).find(nodename + "[" + attr + "='" + val + "']")[0];
    };
    
    
    // recursively process a SMIL XML DOM
    function processTree(node) {
        processNode(node);
        if (node.childNodes.length > 0) {
            $.each(node.childNodes, function(idx, val) {
                processTree(val);
            });
        }
    };       
    
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
        }
        
        // connect the appropriate renderer
        if (renderers.hasOwnProperty(node.tagName)) {
            node.render = renderers[node.tagName];
        }
        
        // connect the appropriate notifier
        if (notifiers.hasOwnProperty(node.tagName)) {
            node.notifyChildDone = notifiers[node.tagName];
        }
        
        scrubAttributes(node);
        
        // one bit of non-tagname-agnostic code in here
        if (node.tagName == "seq" || node.tagName == "body") {
            node.playbackIndex = 0;
        }
    }
    
    // make sure the attributes are to our liking
    function scrubAttributes(node) {
        // TODO do we need to resolve the text srcs too, or does Readium want relative paths?
        
        // process audio nodes' clock values
        if (node.tagName == "audio") {
            if ($(node).attr("src") != undefined) {
                $(node).attr("src", MOUtils.resolveUrl($(node).attr("src"), url));
            }    
            if ($(node).attr("clipBegin") != undefined) {
                $(node).attr("clipBegin", MOUtils.resolveClockValue($(node).attr("clipBegin")));
            }
            else {
                $(node).attr("clipBegin", 0);
            }
            if ($(node).attr("clipEnd") != undefined) {
                $(node).attr("clipEnd", MOUtils.resolveClockValue($(node).attr("clipEnd")));
            }
            else {
                // TODO check if this is reasonable
                $(node).attr("clipEnd", 9999999);
            }
        }
    }
    
    function createPathToNode(node) {
        // go from the node to the top of the tree and make sure the playbackIndex on the seqs points to the right child
        
        // top of the tree
        if (node.tagName == "body") {
            return;
        }
        
        if (node.parentNode.tagName == "par") {
            createPathToNode(node.parentNode);
        }
        else if (node.parentNode.tagName == "seq" || node.parentNode.tagName == "body") {
            if (node.hasOwnProperty("nodeIndex") == false) {
                // find the node's position amongst its siblings and save this info to make future searches a bit faster
                var idx = 0;
                $.each(node.parentNode.childNodes, function(i, val) {
                    if (val == node) {
                        node.nodeIndex = idx;
                        return false;
                    }
                    else
                    {
                        // just count the non-text-node nodes
                        if (val.nodeType == val.ELEMENT_NODE) {
                            idx++;
                        } 
                    }
                });
            }
            node.parentNode.playbackIndex = node.nodeIndex;
            createPathToNode(node.parentNode);
        }
    }
};


// utility functions
MOUtils = {
    // assume both are full paths
    isSameDocument: function(url1, url2) {
        if (url1 == null || url2 == null) {
            return false;
        }
        return MOUtils.stripFragment(url1) == MOUtils.stripFragment(url2);
    },
    getFragment: function(url) {
        if (url.indexOf("#") != -1 && url.indexOf("#") < url.length -1) {
            return url.substr(url.indexOf("#")+1);
        }
        return "";
    },
    stripFragment: function(url) {
        if (url.indexOf("#") == -1) {
            return url;
        }
        else {
            return url.substr(0, url.indexOf("#"));
        }
    },
    resolveUrl: function(url, baseUrl) {
        if (url.indexOf("://") != -1) {
            return url;
        }
        
        var base = baseUrl;
        if (baseUrl[baseUrl.length-1] != "/") {
            base = baseUrl.substr(0, baseUrl.lastIndexOf("/") + 1);
        }
        return base + url;
    },
    // parse the timestamp and return the value in seconds
    // supports this syntax: http://idpf.org/epub/30/spec/epub30-mediaoverlays.html#app-clock-examples
    resolveClockValue: function(value) {        
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
