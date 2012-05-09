// brief experiments with webaudio .. buffering takes too long
// found what is hopefully a better way with html5 audio element
AudioClipPlayer = function() {
    
    // clip info
    var src = null;
    var clipBegin = null;
    var clipEnd = null;
    
    // callbacks
    var notifyClipDone = null;
    var notifyDebugPrint = null;
    
    // options
    var consoleTrace = false;
    
    // data and audio context
    var context = new webkitAudioContext();
    var audiobuffer = null;
    var audiosource = null;
    
    this.setNotifyClipDone = function(notifyClipDoneFn) {
        notifyClipDone = notifyClipDoneFn;
    };
    // useful for having the calling page print things in the browser.
    this.setNotifyDebugPrint = function(notifyDebugPrintFn) {
        notifyDebugPrint = notifyDebugPrintFn;
    };
    
    this.setConsoleTrace =  function(isOn) {
        consoleTrace = isOn;
    };
    
    // clipBeginTime and clipEndTime are in seconds
    // filesrc is an absolute path, local or remote
    this.play = function(filesrc, clipBeginTime, clipEndTime) {
        clipBegin = clipBeginTime;
        clipEnd = clipEndTime;
        
        debugPrint("playing " + src + " from " + clipBegin + " to " + clipEnd);
        
        // if this is a new file
        if (src != filesrc) {
            src = filesrc;
            loadData();
        }
        // the element is already loaded; just need to continue playing at the right point
        else {
            continuePlayback();
        }
    };
    
    this.isPlaying = function() {
        // TODO
    };
    
    this.resume = function() {
        // TODO
    };
    
    this.pause = function() {
        // TODO
    };
    
    this.setNotifyOnPause = function(notifyOnPause) {
        // TODO hook up to the context
    };
    
    this.setNotifyOnPlay = function(notifyOnPlay) {
        // TODO hook up to the context
    }
    
    function loadData(){
        debugPrint("Loading file " + src);
        
        var request = new XMLHttpRequest();
        request.open('GET', src, true);
        // use arraybuffer for binary data
        request.responseType = 'arraybuffer';
        request.onload = function() {
            context.decodeAudioData(request.response, function(buffer) {
                audiobuffer = buffer;
                continueLoadData();
            }, function() {
                console.log("error...");
            });
        }
        request.send();
    }
    
    function continueLoadData() {
        audionode = context.createJavascriptNode
        audiosource = context.createBufferSource();
        audiosource.buffer = audiobuffer;
        audiosource.connect(context.destination);
          
        // TODO adjust for when the clipEnd is greater than the total file duration
        // audiobuffer.duration = total duration
        debugPrint("Audio data loaded");
        
        continuePlayback();
    }
    
    function continuePlayback() {
        
        
        var intervalId = setInterval(function() {
            if (audiosource.context.currentTime >= clipEnd-clipBegin) {
                clearInterval(intervalId);
                stopElement();
            }
        }, 100);
        
        audiosource.noteGrainOn(0, clipBegin, clipEnd-clipBegin);
        
    }
    
    function stopElement() {
        debugPrint("clip done");
        // call the callback
        if (notifyClipDone != null) {
            notifyClipDone();
        }
    }
    
    function debugPrint(str) {
        if (consoleTrace) {
            console.log(str);
        }
        // call the callback
        if (notifyDebugPrint != null) {
            notifyDebugPrint(str);
        }
    }
};
