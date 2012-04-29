// mo-player.js
// plays a media overlay file

// main object
MediaOverlaysPlayer = function() {
    var smiltree = null;
    var audioRenderer = new AudioRenderer();
    var textRenderer = new TextRenderer();
    var smilUrl = null;
    
    this.playFile = function(url) {
        var self = this;
        smilUrl = url;
        $.ajax({
            type: "GET",
        	url: url,
        	dataType: "xml",
        	success: function(xml) {
                notifyDataLoaded(xml);
        	}
        });
    };
    // this is a simplistic way of hooking up the HTML display to the player
    this.setHtmlBody = function(elm) {
        textRenderer.setHtmlBody(elm);
    };
    this.getSmilUrl = function() {
        return smilUrl;
    };
    this.getAudioPlayer = function() {
        return audioRenderer.getAudioPlayer();
    };
    function notifyDataLoaded (xml) {
        var model = new SmilModel();
        model.setUrl(smilUrl);
        model.setNotifySmilDone(notifySmilDone);
        // use inline functions to pass 'this' (which at runtime will be an xml node) to the renderer
        model.addRenderers({
            "audio": function() {
                    audioRenderer.render(this);
                }, 
            "text": function(){
                    textRenderer.render(this);
                }
        });
        // start the playback tree at <body>
        smiltree = $(xml).find("body")[0]; 
        model.processTree(smiltree);
        smiltree.render();
    }
    
    // gets called when the smil tree is done playing
    function notifySmilDone() {
        // TODO this is temporary
        textRenderer.printStr("DONE");
    }
};

// this doesn't do anything spectacular yet. it just prints the element's text on the screen.
// eventually, it will hook into Readium's text display.
TextRenderer = function() {
    var textUrl = null;
    var htmlBody = null;
    var textDom = null;
    var fragId = null;
    
    this.render = function(node) {
        var src = $(node).attr("src");
        fragId = MOUtils.getFragment(src);
        if (!MOUtils.isSameDocument(textUrl, src)) {
            textUrl = MOUtils.stripFragment(src);
            loadTextDom(src);
        }
        else {
            continueRender();
        }
    };
    
    this.setHtmlBody = function(elm) {
        htmlBody = elm;
    };
    
    function loadTextDom(src) {
        $.ajax({
            type: "GET",
        	url: src,
        	dataType: "xml",
        	success: function(xml) {
                notifyDataLoaded(xml);
        	}
        });
    }
    function notifyDataLoaded(xml) {
        textDom = xml;
        continueRender();
    }
    function continueRender() {
        string = $(textDom).find("#" + fragId).text();
        print(string);
    }
    function print(string) {
        $(htmlBody).append($("<p>"+ string + "</p>"));
    }
    this.printStr = print;
    
};

// sends audio nodes to an AudioClipPlayer
AudioRenderer = function() {
    var audioplayer = new AudioClipPlayer;
    var currentNode = null;
    
    audioplayer.setNotifyClipDone(notifyDone);
    
    this.render = function(node) {
        ready = false;
        currentNode = node;
        audioplayer.play($(node).attr("src"), $(node).attr("clipBegin"), $(node).attr("clipEnd"));
    };
    this.getAudioPlayer = function() {
        return audioplayer;
    };
    function notifyDone() {
        if (currentNode != null) {
            currentNode.notifyChildDone();
        }
    }
};

// SmilModel extends the XML DOM of a SMIL file by annotating it with playback functions
SmilModel = function() {
    
    // these are playback logic functions for SMIL nodes
    // the context of each function is the node itself, as these functions will be attached to the nodes as members
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
        audioNotifyMediaRenderDone: function() {
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
    var notifiers = {"seq": NodeLogic.seqNotifyChildDone, 
                    "par": NodeLogic.parNotifyChildDone, 
                    "body": NodeLogic.seqNotifyChildDone,
                    "audio": NodeLogic.audioNotifyMediaRenderDone,
                    "text": function() {}}
    var url = null;
    var notifySmilDone = null;
    
    // call this first with the media node renderers to add them to the master list
    this.addRenderers = function(rendererList) {
        renderers = $.extend(renderers, rendererList);
    };
    
    // set this so the model can resolve src attributes
    this.setUrl = function(fileUrl) {
        url = fileUrl;
    }
    
    // set the callback for when the tree is done
    this.setNotifySmilDone = function(fn) {
        notifySmilDone = fn;
    }
        
    // main entry point
    this.processTree = function(node) {
        processNode(node);
        var self = this;
        if (node.childNodes.length > 0) {
            $.each(node.childNodes, function(idx, val) {
                self.processTree(val);
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
        }
        
        // connect the appropriate renderer
        if (renderers.hasOwnProperty(node.tagName)) {
            node.render = renderers[node.tagName];
        }
        
        // connect the notifiers
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
        // resolve all srcs
        if ($(node).attr("src") != undefined) {
            $(node).attr("src", MOUtils.resolveUrl($(node).attr("src"), url));
        }
        
        // process audio nodes' clock values
        if (node.tagName == "audio") {
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
        if (value.indexOf(":") != -1) {
            arr = value.split(":");
            secs = parseFloat(arr.pop());
            if (arr.length > 0) {
                mins = parseFloat(arr.pop());
                if (arr.length > 0) {
                    hours = parseFloat(arr.pop());
                }
            }
        }
        // look for unit 's', 'h', 'min', 'ms'
        else {
            if (value.indexOf("min") != -1) {
                mins = parseFloat(value.substr(0, indexOf("min")));
            }
            else if (value.indexOf("ms") != -1) {
                var ms = parseFloat(value.substr(0, indexOf("ms")));
                secs = ms/1000;
            }
            else if (value.indexOf("s") != -1) {
                secs = parseFloat(value.substr(0, indexOf("s")));                
            }
            else if (value.indexOf("h") != -1) {
                hours = parseFloat(value.substr(0, indexOf("h")));                
            }
        }
        var total = hours * 3600 + mins * 60 + secs;
        return total;
    }
};