// the main object
MediaOverlaysModel = Backbone.Model.extend({
    smilplayer: null,
    packageDocument: null,
    audioplayer: null,
    packageUrl: null,
    
    initialize: function() {
        
        this.smilplayer = new SmilFilePlayer();
        this.packageDocument = null;
        this.audioplayer = this.smilplayer.getAudioPlayer();
    
        
        // use these properties to communicate status
        this.set({
            currentTextUrl: null,
            isPlaying: false,
            isDocumentDone: true
        });
        var self = this;
        
        // register for callbacks with the smil and audio players
        this.audioplayer.setNotifyOnPause(function() {
            self.updateIsPlaying();
        });
        this.audioplayer.setNotifyOnPlay(function(){
           self.updateIsPlaying(); 
        });
        this.smilplayer.setNotifySmilDone(function() {
            // TODO fetch the next SMIL document and start playing it
            // for now we'll skip all that and just say we're done with everything
            self.set({isDocumentDone: true});
        });
        this.smilplayer.setNotifyTextRender(function(src) {
            self.set({currentTextUrl: src});
        });
    },
    
    setPackageFile: function(url) {
        this.packageUrl = url;
        var self = this;
        // TODO can we load this synchronously? doing it for now because it makes life easier.
        $.ajax({
            type: "GET",
        	url: url,
        	dataType: "xml",
            async: false,
        	success: function(xml) {
                self.packageDocument = xml;
        	}
        });
    },
    
    playTextUrl: function(url) {
        this.isDocumentDone = false;
        smilUrl = MOUtils.lookupSmil(url, this.packageDocument);
        fullSmilUrl = MOUtils.resolveUrl(smilUrl, this.packageUrl);
        this.smilplayer.playFile(fullSmilUrl);        
    },
    
    pause: function() {
        this.audioplayer.pause();
    },
    
    resume: function() {
        this.audioplayer.resume();
    },
    
    updateIsPlaying: function() {
        this.set({isPlaying: this.audioplayer.isPlaying()});
    }
    
});
