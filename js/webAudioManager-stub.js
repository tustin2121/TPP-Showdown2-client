/** A stub SoundManager which does nothing, for browsers (*cough*onlyIE*cough*) that don't support WebAudioContext
 * 
 */

/*global window, $ */
(function(window){
    
function SoundManager() {}
SoundManager.prototype = {
    soundBank : null,
    setup : function(options) {
    },
    /** Creates and returns a sound clip. */
    createSound : function(config) {
        console.warn("Could not create sound: no WebAudio context.");
        return new Sound();
    },
    getSoundById : function(id) {
        console.warn("Could not create sound: no WebAudio context.");
        return new Sound();
    },
    destroySound : function(id) {
    },
    onready : function() {
    },
};

function Sound() {}
Sound.prototype = {
    id : null,
    
    distruct : function(){},
    load : function(){ 
        if (window.Promise)
            return Promise.resolve(); 
        else
            return { then : function(fn){ fn(); } };
    },
    unload : function(){},
    play : function(){},
    stop: function(){},
    pause: function(){},
    resume: function(){},
    fadeOut: function(){},
    set onended(evt) {},
    get mute() {},
    set mute(val) { return true; },
    get volume(){},
    set volume(val){ return 0; },
    setVolume : function() { return this; },
    get pan() {},
    set pan(val) { return  0; },
    setPan : function() { return this; },
};

window.SoundManager = SoundManager;
window.soundManager = new SoundManager;
})(window);
