media-overlays-js
=================

EPUB Media Overlays javascript implementation

This is a partial implementation of EPUB Media Overlays.  

Status: 

 * playback works and backbone events work
 * bug: audible glitch at beginning of audio clips (more noticeable in Chrome than Safari)
 * bug: about a word of audio lost between pause and resume
 * bug: audio sync won't work well when the Chrome tab is in the background. [read more](http://stackoverflow.com/questions/8220976/timing-issues-with-playback-of-the-html5-audio-api
)
 * not yet implemented: see [future additions](#FutureAdditions)

# Run test

(first time)
Get Ruby 1.9.x, install it, and run:

    $ gem install bundler
    $ bundle install

Then (every time), start the local server in the source code directory with 

    $ rake server

Navigate to http://localhost:4000/mo.html and press "play"

# Use

See mo.html for an example of how to use. The main object is a backbone.js model which updates status variables that can be monitored for change:

    isPlaying : is audio playing or not
    currentTextUrl : what's the current text url
    isDocumentDone : indicates whether the entire publication has finished playing or not

# Future additions

 * Start playback from an offset, e.g. file.smil#ID
 * Continue spine playback when one file is finished
 * More sophisticated text-smil lookup; e.g. if text fragment id is not explicitly linked to by a SMIL element, then the player should locate the nearest match.
 * Text renderer toggles CSS class given in package file metadata _(this is probably something Readium will do itself)_
 * Preload audio files - local playback not really affected but remote playback will benefit from this

# Approach to SMIL playback

See smil-player.js

Parse a single SMIL file and annotate the XML DOM as follows:

(All nodes)
Node.render = function to render that node

(All nodes)
Node.notifyChildDone = function called when the node's child is done rendering

(Body and Seq nodes only)
Node.playbackIndex = index of the currently-playing child node

The SMIL tree plays itself, calling

    root->render

which in turn renders its children.

Media nodes are hooked up to renderers for text display and audio clip playback.

Time container nodes (e.g. seq, par, body) are hooked up to internal renderers to manage playback of their child nodes.  For example, seq and body nodes render their children in sequence (often a sequence of pars) whereas par nodes render their children in parallel (e.g. this text with this audio).

When a node is done playing, it must notify its parent via the Node.notifyChildDone method.  This method is also used to communicate from the audio clip player to the audio node that owns that clip.