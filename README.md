media-overlays-js
=================

EPUB Media Overlays javascript implementation

This is a partial implementation of EPUB Media Overlays.  

See [the API](https://github.com/marisademeglio/media-overlays-js/wiki/api) for more details

# Run test

(first time)
Get Ruby 1.9.x, install it, and run:

    $ gem install bundler
    $ bundle install

Then (every time), start the local server in the source code directory with 

    $ rake server

Navigate to http://localhost:4000/tests/test-index.html and select a test to run.

# Future additions

 * Special handling when encountering a text node by itself. This means that the text node is pointing to timed media in the HTML file.

# Approach to SMIL playback

See smil-model.js . 

Parse a single SMIL file and create a tree structure with the following functions:

 * Node.render = function to render that node
 * Node.notifyChildDone = function called when the node's child is done rendering
 
The SMIL tree plays itself, calling

    root->render

which in turn renders its children.

The tree may be played starting from any node by simply calling 

    node->render

All nodes are hooked up to renderers to manage how they should be played.  Each node's render function is described briefly below.

 * Audio nodes trigger the audio clip player
 * Text node @srcs get broadcast via observable properties
 * Seq and body nodes render by calling their children's render functions in sequence 
 * Par nodes render their children in parallel (e.g. this text with this audio).

When a node is done playing, it must notify its parent via the Node.notifyChildDone method.  This method is also used to communicate from the audio clip player to the audio node that owns that clip.

In addition to the functions, nodes may also pick up this property:

 * Node.isJumpTarget = the node is the start of playback in the middle of the tree.  

This property is necessary because of this use case: the user clicks "footnote 5" and the player jumps there.  Footnote 5 is in the middle of a SMIL file and therefore in the middle of a playback tree.  The first clip of footnote 5 is 4 seconds long.  After 1 second, the user clicks "footnote 5" again.  Normally, the audio player would see that it is already playing that clip and would just continue doing so.  However, in this case, we want to force it to re-start, so we identify the node as a jump target.  The audio player's behavior has been optimized for smooth playback so this type of interruption is the exception.


## Audio playback

An issue with audio playback is that we have to use a timer to monitor for the end of a clip.  This timer fires about once every 11ms when the tab is in focus, which is sufficient.  However, when the tab loses focus, it fires only once every second.  [Read more](https://github.com/marisademeglio/media-overlays-js/wiki/audio#wiki-issue) about this issue.