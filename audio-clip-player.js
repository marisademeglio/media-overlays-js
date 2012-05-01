AudioClipPlayer = function() {
    
    var src = null;
    var clipBegin = null;
    var clipEnd = null;
    var elm = new Audio();
    var notifyClipDone = null;
    var notifyDebugPrint = null;
    var consoleTrace = false;
    
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
        src = filesrc;
        clipBegin = clipBeginTime;
        clipEnd = clipEndTime;
        
        debugPrint("playing " + src + " from " + clipBegin + " to " + clipEnd);
        
        // make sure we haven't already created an element for this audio file
        if (elm == null || elm.getAttribute("src") != src) {
            loadData();
        }
        // the element is already loaded; just need to continue playing at the right point
        else {
            continueRender();
        }
    };
    
    this.isPlaying = function() {
        if (elm == null) {
            return false;
        }
        return !elm.paused;
    };
    
    this.resume = function() {
        if (elm != null) {
            elm.play();
        }
    };
    
    this.pause = function() {
        if (elm != null) {
            elm.pause();
        }
    };
    
    this.setNotifyOnPause = function(notifyOnPause) {
        elm.addEventListener("pause", function() {
            notifyOnPause();
        });
    };
    
    this.setNotifyOnPlay = function(notifyOnPlay) {
        elm.addEventListener("play", function() {
            notifyOnPlay();
        });
    }
    
    function loadData(){
        debugPrint("Loading file " + src);
        elm.setAttribute("src", src);
        
        // wait for 'canplay' before continuing
        elm.addEventListener("canplay", setThisTime);
        function setThisTime() {
            debugPrint("canplay event fired");
            elm.removeEventListener("canplay", setThisTime);
            continueLoadData();        
        }
    }
    
    function continueLoadData() {
        // TODO put something in here for remote files to make sure the file is buffered
        
        if (clipEnd > elm.duration) {
            debugPrint("File is shorter than specified clipEnd time");
            clipEnd = elm.duration;
        }
        debugPrint("Audio data loaded");
        continueRender();
    }
    
    function continueRender() {
        var duration = clipEnd - clipBegin;
        
        if (elm.currentTime != clipBegin) {
            elm.addEventListener("seeked", seeked);
            elm.currentTime = clipBegin;
            function seeked() {
                elm.removeEventListener("seeked", seeked);
                playElement(duration);
            }
        }
        else {
            playElement(duration);
        }      
    }
    
    function playElement(duration) {
        // we're using setInterval instead of monitoring the timeupdate event because timeupdate fires, at best, every 200ms, which messes up playback of short phrases.
        // a 5ms interval gives pretty fine control over the audio
        var intervalId = setInterval(function() {
            if (elm.currentTime >= clipEnd) {
                clearInterval(intervalId);
                stopElement();
            }
        }, 5);
        elm.play();
    }
    
    function stopElement() {
        // experiment with not pausing the element at the end of a clip. when the next clip plays, it will set currentTime to where it needs to be.
        // if we pause in between, it doesn't really accomplish anything, and make any listening UI look funny with play/pause toggling all the time.
        //elm.pause();
        debugPrint("clip done");
        // call the callback
        if (notifyClipDone != null) {
            notifyClipDone();
        }
    }
    
    function debugPrint(str) {
        if (consoleTrace == true) {
            console.log(str);
        }
        // call the callback
        if (notifyDebugPrint != null) {
            notifyDebugPrint(str);
        }
    }
};
