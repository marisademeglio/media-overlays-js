// number-clips.js
// edge case test of audio clip playback
// these short clips are out of order in the audio file
// this sequence puts them in the correct order; however, if the player's tab loses focus, then you hear the file
// just continue playing itself and you can hear how it goes out of order
// not sure if there is a way around this given the browser limitations

baseurl = "http://localhost:4000/testdata/numbers/";

clips = [["numbers.mp3", 0.0, 0.751, "0"]
,["numbers.mp3", 3.262, 3.865, "1"]
,["numbers.mp3", 0.751, 1.387, "2"]
,["numbers.mp3", 3.865, 4.518, "3"]
,["numbers.mp3", 1.387, 2.034, "4"]
,["numbers.mp3", 4.518, 5.252, "5"]
,["numbers.mp3", 2.034, 2.747, "6"]
,["numbers.mp3", 5.252, 6.036, "7"]
,["numbers.mp3", 2.747, 3.262, "8"]
,["numbers.mp3", 6.036, 6.661, "9"]
];