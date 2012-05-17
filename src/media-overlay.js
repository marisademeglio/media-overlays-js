// loads and plays a single SMIL document
MediaOverlay = Backbone.Model.extend({
    audioplayer: null,
    smilModel: null,
    
    // observable properties
    defaults: {
        is_ready: false,
        is_document_done: false,
        is_playing: false,
        should_highlight: true,
        current_text_document_url: null,
        current_text_element_id: null,
        can_escape: false      
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
        // initialize the model so we can set its settings, for ex. skippability, before loading a file
        this.smilModel = new SmilModel();
    },
    // load a file; must provide a 'url' option
    fetch: function(options) {
        this.set({is_ready: false});
        this.smilModel.setUrl(options.url);
        options || (options = {});
        options.dataType="xml";
        Backbone.Model.prototype.fetch.call(this, options);
    },
    // backbone fetch() callback
    parse: function(xml) {
        var self = this;
        
        this.smilModel.setNotifySmilDone(function() {
            if (self.get("is_playing")) {
                self.audioplayer.pause();
            }
            self.set({is_document_done: true});
        });
        
        this.smilModel.setNotifyCanEscape(function(canEscape) {
           self.set({can_escape: canEscape}); 
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
                var isJumpTarget = false;
                if (this.hasOwnProperty("isJumpTarget")) {
                    isJumpTarget = this.isJumpTarget;
                    // reset the node's property
                    this.isJumpTarget = false;
                }
                
                // play the node
                self.audioplayer.play($(this).attr("src"), parseFloat($(this).attr("clipBegin")), parseFloat($(this).attr("clipEnd")), isJumpTarget);
            }, 
            "text": function(){
                var src = $(this).attr("src");
                // broadcast the text properties so that any listeners can do the right thing wrt loading/highlighting text
                self.set({
                    current_text_document_url: stripFragment(src), 
                    current_text_element_id: getFragment(src)
                });
                                
                function getFragment(url) {
                    if (url.indexOf("#") != -1 && url.indexOf("#") < url.length -1) {
                        return url.substr(url.indexOf("#")+1);
                    }
                    return "";
                }
                function stripFragment(url) {
                    if (url.indexOf("#") == -1) {
                        return url;
                    }
                    else {
                        return url.substr(0, url.indexOf("#"));
                    }
                }
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
    escape: function() {
        this.smilModel.escape();
    },
    findNodeByTextSrc: function(src) {
        var elm = this.smilModel.findNodeByAttrValue("text", "src", src);
        if (elm == null){
            elm = this.smilModel.findNodeByAttrValue("seq", "epub:textref", src);
        }    
        return elm;
    },
    // volume is a floating-point number between 0 and 1
    setVolume: function(volume) {
        this.audioplayer.setVolume(volume);
    },
    
    // add an epub:type value to the list of things that playback must skip
    addSkipType: function(name) {
        this.smilModel.addSkipType(name);
    },
    
    // remove an epub:type value from the list of things that playback must skip
    removeSkipType: function(name) {
        this.smilModel.removeSkipType(name);
    },
    
    // add an epub:type value to the list of things that users may escape
    addEscapeType: function(name) {
        this.smilModel.addEscapeType(name);
    },
    // remove an epub:type value from the list of things that users may escape
    removeEscapeType: function(name) {
        this.smilModel.removeEscapeType(name);
    }
    
    
});