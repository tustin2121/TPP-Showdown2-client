/**
 * Web Audio SoundManager Implementation
 * 
 * Drop-in replacement for the sound manager that Showdown uses, while
 * allowing more functionality to be produced for our own purposes.
 * 
 * @author Tustin2121
 */
 
declare var require: any;
declare var global: any;

const audioCtx:AudioContext = new (window.AudioContext || window.webkitAudioContext)();

interface SoundConfig {
	id: string;
	url: string;
	volume?: number;
	pan?: number;
	loopstart?: number;
	loopend?: number;
	musicReact?: Function | string;
}

interface Media {
	play(): boolean;
	pause(): boolean;
	stop(): boolean;
	
	distruct();
}

//TODO: Reduce Sound to the basics of playing non-looping sound, with basic volume control
// and stereo panner, and use it for sfx only. Drop mute node in favor of the global mute.
// Drop resume and fade out functionality and nodes.
class Sound extends Media {
	id: string;
	url: string;
	loop: [number, number] | null = null;
	audiobuffer: BufferSource | null = null;
	
	playCount = 0;
	startTime = 0;
	pauseOffset = null;
	
	__loadPromise:Promise<AudioBuffer>
	__muteNode:GainNode;
	__panNode:StereoPannerNode;
	__volNode:GainNode;
	__fadeNode:GainNode;
	__sourceNode:AudioBufferSourceNode;
	
	constructor(config:SoundConfig) {
		this.id = opts.id;
		this.url = opts.url;
		console.debug("♫ CREATE: "+this.id);
		
		this.__muteNode = audioCtx.createGain();
		if (audioCtx.createStereoPanner) {
			this.__panNode = audioCtx.createStereoPanner();
		}
		this.__volNode = audioCtx.createGain();
		this.__fadeNode = audioCtx.createGain();
		
		if (this.__panNode) {
			this.__muteNode.connect(this.__panNode);
			this.__panNode.connect(this.__volNode);
		} else {
			this.__muteNode.connect(this.__volNode);
		}
		this.__volNode.connect(this.__fadeNode);
		this.__fadeNode.connect(audioCtx.destination);
		
		this.__fadeNode.gain.setValueAtTime(1, 0);
		
		this.volume = (opts.volume || 50) / 100;
		this.pan = (opts.pan || 0) / 100;
		if (opts.loopstart && opts.loopend && opts.loopstart != opts.loopend) {
			// If the loop start and end are given in milliseconds, convert to seconds.
			if (opts.loopstart > 1000 && opts.loopend > 2000) {
				opts.loopstart /= 1000;
				opts.loopend /= 1000;
			}
			this.loop = [opts.loopstart, opts.loopend];
		}
		
		this.load();
	}
	
	distruct() {
		this.__fadeNode.disconnect();
        this.loop = null;
        this.audiobuffer = null;
        this.__loadPromise = null;
        this.__muteNode = null;
        this.__panNode = null;
        this.__sourceNode = null;
        this.__volNode = null;
        this.__fadeNode = null;
	}
	
	load() {
		this.__loadPromise = new Promise((resolve, reject)=>{
            let xhr = new XMLHttpRequest();
            xhr.open("GET", this.url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = (e)=>{
                resolve(xhr.response);
            };
            xhr.onerror = (e)=>{
                reject(e);
            };
            xhr.send();
        }).then((data:ArrayBuffer)=>{
            return audioCtx.decodeAudioData(data);
        }).then((data)=>{
            this.audiobuffer = data;
            this.__loadPromise = null;
            return data;
        }).catch((e)=>{
            this.__loadPromise = null;
            console.error("Error loading sound: ", e);
        });
        return this.__loadPromise;
	}
	
	unload() {
		this.audiobuffer = null;
	}
	
	/**
	 * Plays this sound.
	 * @param time - How many seconds to wait before starting playback.
	 * @param offset - How far into the song to start, or "true" for random between loop points.
	 * @param playDepth - Used to avoid play-start race conditions.
	 */
	play(time?:number, offset?:number|boolean, playDepth?:number) : boolean {
		// console.debug("♫ PLAY: "+this.id+" [count:"+(this.playCount+1)+"][depth:"+playDepth+"]");
		this.playCount++;
        if (this.__sourceNode) return true; //Don't double-play
        if (!this.audiobuffer) { //not loaded yet, can't play yet
            if (this.__loadPromise) {
                this.__loadPromise.then( this.play.bind(this, time, offset, this.playCount+1) ); //try again after things loads
            }
            return false;
        }
        if (playDepth !== undefined && playDepth !== this.playCount) return false;
		
		time = (time || 0) + audioCtx.currentTime;
		if (this.loop && offset === true) {
            offset = (Math.random() * (this.loop[1] - this.loop[0])) + this.loop[0];
        } else {
            offset = ((typeof offset === "number")?offset : 0);
		}
		
		this.__sourceNode = audioCtx.createBufferSource();
        this.__sourceNode.buffer = this.audiobuffer;
        if (this.loop) {
            this.__sourceNode.loop = true;
            this.__sourceNode.loopStart = this.loop[0];
            this.__sourceNode.loopEnd = this.loop[1];
        }
        this.__sourceNode.onended = ()=>{
            this.__sourceNode.disconnect();
            this.__sourceNode = null;
        };
        this.__sourceNode.connect(this.__muteNode);
        this.__sourceNode.start(time, offset);
        this.__fadeNode.gain.setValueAtTime(1, time+0.1);
        this.startTime = time - offset;
        this.pauseOffset = null;
        return true;
	}
	
	/**
	 * Stops this sound.
	 * @param time - How many seconds to wait before stopping playback
	 */
	stop(time?:number): boolean {
		// console.debug("♫ STOP: "+this.id+" [count:"+(this.playCount-1)+"]");
		this.playCount--;
        if (!this.__sourceNode) return true; //Can't double-stop
        
        time = (time || 0) + audioCtx.currentTime;
        
        this.__fadeNode.gain.setValueAtTime(1, time+0.1);
        let srcNode = this.__sourceNode;
        this.__sourceNode.onended = function(){
            srcNode.disconnect();
        };
        this.__sourceNode.stop(time);
        this.__sourceNode = null;
        return true;
	}
	
	pause(): boolean {
		// console.debug("♫ PAUSE: "+this.id);
        if (!this.__sourceNode) return false; //can't pause while not playing
        
        this.pauseOffset = audioCtx.currentTime - this.startTime;
        if (this.loop) {
            this.pauseOffset -= this.loop[0];
            this.pauseOffset %= (this.loop[1] - this.loop[0]);
        }
        this.__sourceNode.stop();
        this.__sourceNode.disconnect();
        this.__sourceNode = null;
        return true;
	}
	
	resume(): boolean {
		// console.debug("♫ RESUME: "+this.id);
        if (this.__sourceNode) return false; //can't resume while playing
        if (this.pauseOffset === null) return false; //can't resume if not paused
        
        var offset = this.pauseOffset + (this.loop)?this.loop[0]:0;
        return this.play(0, offset);
	}
	
	fadeOut(time?:number, delay?:number) {
		// console.debug("♫ FADE: "+this.id);
        this.playCount--;
        if (!this.__sourceNode) return; //can't fade if we aren't playing
        delay = delay || 0;
        time = time || 2;
        this.__fadeNode.gain.setValueAtTime(1, audioCtx.currentTime+delay);
        this.__fadeNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime+delay+time);
        this.__fadeNode.gain.setValueAtTime(1, audioCtx.currentTime+delay+time+0.5);
        this.__sourceNode.stop(audioCtx.currentTime+delay+time+0.1);
        // this.__sourceNode = null;
	}
	
	set onended(evt:Event) {
		if (!this.__sourceNode) return; //can't assign when not playing
        this.__sourceNode.onended = evt;
	}
	
	get playing() {
        return !!this.__sourceNode;
	}
	
	get muted() {
        return this.__muteNode.gain.value < 0.5;
	}
	set muted(val) {
        this.__muteNode.gain.value = (val)?0.0:1.0;
	}
	
	get volume(){
        return this.__volNode.gain.value;
    }
    set volume(val){
        this.__volNode.gain.value = val;
    }
    setVolume(vol:number):Sound {
        this.volume = (vol/100);
        return this; //compatability chaining
    }
	
	get pan() {
        if (!this.__panNode) return 0;
        return this.__panNode.pan.value;
    }
    set pan(val) {
        if (!this.__panNode) return;
        this.__panNode.pan.value = val;
    }
    setPan(pan:number):Sound {
        this.pan = (pan/100);
        return this; //compatability chaining
    }
}


// TODO: possibly use something similar to what Sound is right now as the basis for a MusicStream
// class which the state machine uses to control the music states. (Drop the panner node and mute node)
class MusicStream {
	
}

//TODO: Parse the example music state machines into something usable
class MusicStateMachine {
	
}


//TODO: Make the soundmanager own global volume nodes for sound, music, notifivation, and mute,
// which will  be the destinations of all the above objects, and use those nodes for the
// global volume levels.
//TODO: When the user adjusts the volume level, play a sound related to it. Play the notification sound
// when adjusting the notification sound level. Play a bulbasaur cry when adjusting sfx. Play the item
// pick up jingle when adjusting the music volume.
class SoundManager {
	audioCtx: AudioContext;
	soundBank: {[k:string]:Sound};
	
	constructor() {
		this.audioCtx = audioCtx; //for debug visability
		this.soundBank = {};
	}
	
	setup(options: object) {
		// compatibility, not used
	}
	
	createSound(config: SoundConfig|string) {
		if (!config) throw new Error("No configuration given for sound!");
		if (typeof config === "string") {
			config = { id: config, url: config };
		}
		if (config.url === undefined) throw new Error("No url given for sound!");
        if (config.id === undefined) config.id = config.url;
        return (this.soundBank[config.id] = new Sound(config));
	}
	
	getSoundById(id) {
        return this.soundBank[id];
    }
    
    destroySound(id) {
        this.soundBank[id].stop();
        this.soundBank[id].unload();
        this.soundBank[id].distruct();
        delete this.soundBank[id];
        return true;
    }
    
    onready(fn:Function) {
        $(fn);
    }
}

const soundManager = new SoundManager();


if (typeof require === 'function') {
	// in Node
	(global as any).SoundManager = SoundManager;
}
