AudioClipPlayer = function() {
    
    // clip info
    var src = null;
    var clipBegin = null;
    var clipEnd = null;
    
    // true = keep playing the file; false = pause when clip is done
    var playThrough = false;
    
    // force the clip to reset its start time
    var forceReset = false;
    
    // the html audio element created to hold whatever the current file is
    var elm = new Audio();
    
    // callback function
    var notifyClipDone = null;
    
    // send debug statements to the console
    var consoleTrace = false;
    
    // ID of the setInterval timer
    var intervalId = null;
    
    this.setNotifyClipDone = function(notifyClipDoneFn) {
        notifyClipDone = notifyClipDoneFn;
    };
    this.setConsoleTrace =  function(isOn) {
        consoleTrace = isOn;
    };
    
    // clipBeginTime and clipEndTime are in seconds
    // filesrc is an absolute path, local or remote
    this.play = function(filesrc, clipBeginTime, clipEndTime, shouldPlayThrough, shouldForceReset) {
        src = filesrc;
        clipBegin = clipBeginTime;
        clipEnd = clipEndTime;
        playThrough = shouldPlayThrough;
        forceReset = shouldForceReset;
        
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
    };
    
    this.getCurrentTime = function() {
        if (elm != null) {
            return elm.currentTime;
        }
        return 0;
    };
    this.getCurrentSrc = function() {
        return src;
    };
    // volume ranges from 0 to 1.0
    this.setVolume = function(value) {
        if (value < 0) {
            elm.volume = 0;
        }
        else if (value > 1) {
            elm.volume = 1;
        }
        else {
            elm.volume = value;
        }
    };
    function loadData(){
        debugPrint("Loading file " + src);
        elm.setAttribute("src", src);
        
        // wait for 'canplay' before continuing
        elm.addEventListener("canplay", setThisTime);
        function setThisTime() {
            elm.removeEventListener("canplay", setThisTime);
            // TODO put something in here for remote files to make sure the file is buffered
        
            if (clipEnd > elm.duration) {
                debugPrint("File is shorter than specified clipEnd time");
                clipEnd = elm.duration;
            }
            debugPrint("Audio data loaded");
            continueRender();        
        }
        
        elm.addEventListener("ended", function() {
            // cancel the timer, if any
            if (intervalId != null) {
                clearInterval(intervalId);
            }
            if (notifyClipDone != null) {
                notifyClipDone();
            }
        });
    }
    
    function continueRender() {
        // if the current time is already somewhere within the clip that we want to play, then just let it keep playing
        if (forceReset == false && elm.currentTime > clipBegin && elm.currentTime < clipEnd) {
            startClipTimer();
            elm.play();    
        }
        else {
            elm.addEventListener("seeked", seeked);
            console.log("setting currentTime from " + elm.currentTime + "to " + clipBegin);
            elm.currentTime = clipBegin;
            function seeked() {
                elm.removeEventListener("seeked", seeked);
                startClipTimer();
                elm.play();
            }
        }
    }
    
    function startClipTimer() {
        
        // cancel the old timer, if any
        if (intervalId != null) {
            clearInterval(intervalId);
        }
        
        // we're using setInterval instead of monitoring the timeupdate event because timeupdate fires, at best, every 200ms, which messes up playback of short phrases.
        // 11ms seems to be chrome's finest allowed granularity for setInterval (and this is for when the tab is active; otherwise it fires about every second)
        intervalId = setInterval(function() {
            if (elm.currentTime >= clipEnd) {
                clearInterval(intervalId);
                debugPrint("clip done");
                // if we shouldn't play through, then pause the element and wait for our next instruction
                if (playThrough == false) {
                    elm.pause();
                }
                if (notifyClipDone != null) {
                    notifyClipDone();
                }
            }
        }, 11);   
    }
    
    function debugPrint(str) {
        if (consoleTrace) {
            console.log(str);
        }
    }
};
