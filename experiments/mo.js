// Media Overlays
// Backbone wrapper for smil-player.js
// handles audio internally, and broadcasts the url for the current text src
MediaOverlaysModel = Backbone.Model.extend({
    
    defaults: {
        current_text_document_url: null,
        current_text_element_id: null,
        is_playing: false,
        should_highlight: true,
        is_playback_complete: false,
    },
    
    smilplayer: null,
    audioplayer: null,
    
    initialize: function() {
        
        this.smilplayer = new SmilFilePlayer();
        this.audioplayer = this.smilplayer.getAudioPlayer();
        
        var self = this;
        
        // register for callbacks with the smil and audio players
        this.audioplayer.setNotifyOnPause(function() {
            self.set({is_playing: self.audioplayer.isPlaying()});
        });
        this.audioplayer.setNotifyOnPlay(function(){
           self.updateIsPlaying(); 
        });
        this.smilplayer.setNotifySmilDone(function() {
            self.set({is_playback_complete: true});
        });
        this.smilplayer.setNotifyTextRender(function(src) {
            self.set({
                current_text_document_url: stripFragment(src), 
                current_text_element_id: getFragment(src)
            });
        });
    },
    // url: full path to a SMIL file
    playFile: function(url) {
        this.set({is_playback_complete: false});
        this.smilplayer.playFile(url);        
    },
    // pause the audio
    pause: function() {
        this.audioplayer.pause();
    },
    // resume audio where left off
    resume: function() {
        this.audioplayer.resume();
    }
});
