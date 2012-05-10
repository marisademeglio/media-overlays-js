AudioClipPlayer = function() {
    
    var src = null;
    var clipBegin = null;
    var clipEnd = null;
    var elm = new Audio();
    var notifyClipDone = null;
    var consoleTrace = false;
    // the audio clip boundary margin
    var margin = .150;
    var infocus = true;
    var intervalId = null;
    var playThrough = false;
    
    this.setNotifyClipDone = function(notifyClipDoneFn) {
        notifyClipDone = notifyClipDoneFn;
    };
    this.setConsoleTrace =  function(isOn) {
        consoleTrace = isOn;
    };
    
    // use this setting for more precise synchronization
    /*this.useNarrowClipMargin = function() {
        margin = .100;
    };*/
    // use this setting to relax the synchronization a bit, for example if the window goes into the background and setInterval doesn't fire as often
    /*this.useWideClipMargin = function() {
        margin = 1;
    };*/
    
    // clipBeginTime and clipEndTime are in seconds
    // filesrc is an absolute path, local or remote
    this.play = function(filesrc, clipBeginTime, clipEndTime, shouldPlayThrough) {
        src = filesrc;
        clipBegin = clipBeginTime;
        clipEnd = clipEndTime;
        playThrough = shouldPlayThrough;
        
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
    
    // this is necessary in case we lost our place in the file due to setInterval timing problems
    this.updateTimer = function(clipBeginTime, clipEndTime) {
        clipBegin = clipBeginTime;
        clipEnd = clipEndTime;
        startClipTimer();
    }
    
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
        // be a bit flexible because otherwise you hear a bit of a glitch when you initially move the currentTime counter
        if (elm.currentTime < clipBegin - margin || elm.currentTime > clipBegin + margin) {
            elm.addEventListener("seeked", seeked);
            console.log("setting currentTime from " + elm.currentTime + "to " + clipBegin);
            elm.currentTime = clipBegin;
            function seeked() {
                elm.removeEventListener("seeked", seeked);
                startClipTimer();
                elm.play();
            }
        }
        else {
            startClipTimer();
            elm.play();
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
