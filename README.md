media-overlays-js
=================

EPUB Media Overlays javascript implementation

This is a partial implementation of EPUB Media Overlays.  

See [the API](https://github.com/marisademeglio/media-overlays-js/wiki/api) for more details

Status: 

 * jump-to-position doesn't work reliably if you are already beyond the target point
 * highlights don't get unhighlighted (though this is not a problem with the MO implementation but rather the lame front end)
 * audio sync won't work perfectly when the Chrome tab is in the background. [Read more](https://github.com/marisademeglio/media-overlays-js/wiki/audio#wiki-issue) about audio.
 * not yet implemented: see [future additions](#future-additions)

# Run test

(first time)
Get Ruby 1.9.x, install it, and run:

    $ gem install bundler
    $ bundle install

Then (every time), start the local server in the source code directory with 

    $ rake server

Navigate to http://localhost:4000/mo-player.html and press "play"

# Future additions

 * Skippability
 * Escapability
 * Audio playback optimization

# Approach to SMIL playback

See SmilModel in mo-player.js 

Parse a single SMIL file and annotate the XML DOM as follows:

(All nodes)
Node.render = function to render that node

(All nodes)
Node.notifyChildDone = function called when the node's child is done rendering

The SMIL tree plays itself, calling

    root->render

which in turn renders its children.

All nodes are hooked up to renderers to manage how they should be played.

 * Audio nodes trigger the audio clip player
 * Text node @srcs get broadcast via observable properties
 * Seq and body nodes render by calling their children's render functions in sequence 
 * Par nodes render their children in parallel (e.g. this text with this audio).

When a node is done playing, it must notify its parent via the Node.notifyChildDone method.  This method is also used to communicate from the audio clip player to the audio node that owns that clip.