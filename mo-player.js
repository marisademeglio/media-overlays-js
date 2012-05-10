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
        current_text_document_url: null,
        current_text_element_id: null        
    },
    
    initialize: function() {
        var self = this;
        this.audioplayer = new AudioClipPlayer();
        this.audioplayer.setConsoleTrace(true);
        
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
        this.smilModel.addRenderers({
            "audio": function() {
                // have the audio player inform the node directly when it's done playing
                var thisNode = this;
                self.audioplayer.setNotifyClipDone(function() {
                    thisNode.notifyChildDone();
                });
                var nextNode = self.smilModel.peekNextAudio(this);
                var nextCB = $(nextNode).attr("clipBegin");
                var thisCE = $(this).attr("clipEnd");
                var playThrough = false;
                // if the next clip starts within a few milliseconds of this clip's end, then tell the audio player to just keep playing
                if (nextCB >= thisCE && nextCB <= thisCE + .050) {
                    playThrough = true;
                }
                // play the node
                // TODO 
                self.audioplayer.play($(this).attr("src"), parseFloat($(this).attr("clipBegin")), parseFloat($(this).attr("clipEnd")), playThrough);
            }, 
            "text": function(){
                var src = $(this).attr("src");
                // broadcast the text properties so that any listeners can do the right thing wrt loading/highlighting text
                self.set({
                    current_text_document_url: MOUtils.stripFragment(src), 
                    current_text_element_id: MOUtils.getFragment(src)
                });
            }
        });
        
        // start the playback tree at <body>
        var smiltree = $(xml).find("body")[0]; 
        this.smilModel.build(smiltree);
        this.set({is_ready: true});
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
            currentPar = this;
            $.each(this.childNodes, function(index, value) {
                if (value.hasOwnProperty("render")) {
                    value.render();
                }
            });
        },
    
        // render starting at the given node; if null, start at the beginning
        seqRender: function(node) {
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
        //removeTextNodes(node);
        processTree(node, 0);
    };
    
    // prepare the tree to start rendering from a node
    this.render = function(node) {
        if (node == null || node == root) {
            root.render(null);
        }
        else {
            node.parentNode.render(node);
        }
    };
    
    this.findNodeByAttrValue = function(nodename, attr, val) {
        return $(root).find(nodename + "[" + attr + "='" + val + "']")[0];
    };
    
    // see what the next audio node is going to be
    // TODO take skippability into consideration
    this.peekNextAudio = function(audioNode) {
        var node = audioNode.parentNode;
        // go up the tree until we find a relative
        while(node.nextElementSibling == null) {
            node = node.parentNode;
            if (node == root) {
                return null;
            }
        }
        // find the first audio node
        return $(node.nextElementSibling).find("audio")[0];
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
    
    // remove the non-element nodes from the tree
    // these nodes are not used in SMIL and are likely just whitespace garbage
    // it's a little funky traversing a tree while removing nodes, so for now, we are doing this as a separate visit
    // rather than during our other processing. 
    function removeTextNodes(node) {
        if (node.nodeType != node.ELEMENT_NODE) {
            node.parentNode.removeChild(node);
            return true;
        }
        else {
            var len = node.childNodes.length;
            var idx = 0;
            for (var i = 0; i<len; i++) {
                var wasRemoved = removeTextNodes(node.childNodes[idx]);
                // stop if we're at the last one
                if (idx == node.childNodes.length -1) {
                    break;
                }
                if (wasRemoved == false) {
                    // increment the counter if we haven't removed anything from childNodes
                    idx++; 
                }
            }
            return false;
        }
    }
    
    // in the future, this will act as a skippability filter
    function canPlaySeq(node) {
        return true;
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
