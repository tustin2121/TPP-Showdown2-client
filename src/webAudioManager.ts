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

// const gAudioCtx:AudioContext = window.AudioContext || window.webkitAudioContext;

interface SoundConfig {
	id: string;
	url: string;
	volume?: number;
	pan?: number;
	loopstart?: number;
    loopend?: number;
    type?: 'sound'|'notify'|'music';
}

interface Playable {
    readonly id: string;
    
    /**
	 * Plays this sound.
	 * @param time - How many seconds to wait before starting playback.
	 * @param offset - How far into the song to start, or "true" for random between loop points.
	 * @param playDepth - Used to avoid play-start race conditions.
	 */
	play(time?:number, offset?:number|boolean, playDepth?:number): boolean;
    /**
	 * Stops this sound.
	 * @param time - How many seconds to wait before stopping playback
	 */
    stop(time?:number): boolean;
    /** Dismantles this object and prepares it for garbage collection. */
    destroy(): void;
    /** Returns true if this object is playing. */
    isPlaying: boolean;
}
//*/
abstract class LoadableMedia {
    protected audioCtx:AudioContext;
    readonly url: string;
    protected loadPromise:Promise<AudioBuffer>;
    protected audiobuffer: BufferSource | null = null;
    
    constructor(ctx:AudioContext, config:SoundConfig) {
        this.audioCtx = ctx;
        this.url = config.url;
    }
    
    destroy() {
        this.audioCtx = null;
        this.audiobuffer = null;
        this.loadPromise = null;
    }
    
    load(): Promise<AudioBuffer> {
        this.loadPromise = new Promise((resolve, reject)=>{
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
            return this.audioCtx.decodeAudioData(data);
        }).then((data)=>{
            this.audiobuffer = data;
            this.loadPromise = null;
            return data;
        }).catch((e)=>{
            this.loadPromise = null;
            console.error("Error loading sound: ", e);
        });
        return this.loadPromise;
    }
    
    unload() {
        this.audiobuffer = null;
    }
}

class Sound extends LoadableMedia implements Playable {
    protected playCount = 0;
    
    protected volNode:GainNode;
    protected panNode:StereoPannerNode;
    protected sourceNode:AudioBufferSourceNode;
    
    constructor(ctx:AudioContext, config:SoundConfig, destNode:AudioNode) {
        super(ctx, config);
        this.id = config.id;
        console.debug("♫ CREATE: "+this.id);
        
        this.volNode = this.audioCtx.createGain();
        if (this.audioCtx.createStereoPanner) {
            this.panNode = this.audioCtx.createStereoPanner();
            this.panNode.connect(this.volNode);
		}
        this.volNode.connect(destNode);
        
        this.volume = (config.volume || 50);
        this.pan = (config.pan || 0);
        this.load();
    }
    
    destroy() {
        super.destroy();
        this.volNode.disconnect();
        this.volNode = null;
        this.panNode = null;
        this.sourceNode = null;
    }
    
    /**
	 * Plays this sound.
	 * @param time - How many seconds to wait before starting playback.
	 * @param offset - How far into the song to start, or "true" for random between loop points.
	 * @param playDepth - Used to avoid play-start race conditions.
	 */
	play(time?:number, offset?:number|boolean, playDepth?:number): boolean {
        // console.debug("♫ PLAY: "+this.id+" [count:"+(this.playCount+1)+"][depth:"+playDepth+"]");
        this.playCount++;
        if (this.sourceNode) return true; //Don't double-play
        if (!this.audiobuffer) { //not loaded yet, can't play yet
            if (this.loadPromise) {
                this.loadPromise.then( this.play.bind(this, time, offset, this.playCount+1) ); //try again after things loads
            }
            return false;
        }
        if (playDepth !== undefined && playDepth !== this.playCount) return false;
        
        time = (time || 0) + this.audioCtx.currentTime;
        offset = ((typeof offset === "number")?offset : 0)
        
        this.sourceNode = this.audioCtx.createBufferSource();
        this.sourceNode.buffer = this.audiobuffer;
        this.sourceNode.onended = ()=>{
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        this.sourceNode.connect(this.panNode || this.volNode);
        this.sourceNode.start(time, offset);
        return true;
    }
    
    /**
	 * Stops this sound.
	 * @param time - How many seconds to wait before stopping playback
	 */
    stop(time?:number): boolean {
        // console.debug("♫ STOP: "+this.id+" [count:"+(this.playCount-1)+"]");
        this.playCount--;
        if (!this.sourceNode) return true; //Can't double-stop
        
        time = (time || 0) + this.audioCtx.currentTime;
        let srcNode = this.sourceNode;
        this.sourceNode.onended = function(){
            srcNode.disconnect();
        };
        this.sourceNode.stop(time);
        this.sourceNode = null;
        return true;
    }
    
	set onended(evt:Event) {
		if (!this.sourceNode) return; //can't assign when not playing
        this.sourceNode.onended = evt;
    }
    
	get isPlaying() { return !!this.sourceNode; }
    
    get volume(){ return this.volNode.gain.value * 100; }
    set volume(val){ this.volNode.gain.value = val / 100; }
    setVolume(vol:number):this {
        this.volume = vol;
        return this; //compatability chaining
    }
    
	get pan() {
        if (!this.panNode) return 0;
        return this.panNode.pan.value * 100;
    }
    set pan(val) {
        if (!this.panNode) return;
        this.panNode.pan.value = val / 100;
    }
    setPan(pan:number):this {
        this.pan = pan;
        return this; //compatability chaining
    }
}

class MusicStream extends LoadableMedia implements Playable {
    protected loop: [number, number] | null = null;
    protected playCount = 0;
	protected startTime = 0;
    protected pauseOffset:number | null = null;
    
    protected volNode:GainNode;
    protected fadeNode:GainNode;
    protected sourceNode:AudioBufferSourceNode;
    
    transition:string = null;
    beat:number = 0;
    beatOffset:number = 0;
    
    constructor(ctx:AudioContext, config:SoundConfig, destNode:AudioNode) {
        super(ctx, config);
        this.id = config.id;
        console.debug("♫ CREATE: "+this.id);
        
        this.volNode = this.audioCtx.createGain();
        this.fadeNode = this.audioCtx.createGain();
        this.volNode.connect(this.fadeNode);
        this.fadeNode.connect(destNode);
        this.fadeNode.gain.setValueAtTime(1, 0);
        
        this.volume = (config.volume || 50);
        if (config.loopstart && config.loopend && config.loopstart != config.loopend) {
			// If the loop start and end are given in milliseconds, convert to seconds.
			if (config.loopstart > 1000 && config.loopend > 2000) {
				config.loopstart /= 1000;
				config.loopend /= 1000;
			}
			this.loop = [config.loopstart, config.loopend];
		}
        this.load();
    }
    
    destroy() {
        super.destroy();
        this.loop = null;
        this.fadeNode.disconnect();
        this.fadeNode = null;
        this.volNode = null;
        this.sourceNode = null;
    }
    
    /**
	 * Plays this sound.
	 * @param time - How many seconds to wait before starting playback.
	 * @param offset - How far into the song to start, or "true" for random between loop points.
	 * @param playDepth - Used to avoid play-start race conditions.
	 */
	play(time?:number, offset?:number|boolean, playDepth?:number): boolean {
        // console.debug("♫ PLAY: "+this.id+" [count:"+(this.playCount+1)+"][depth:"+playDepth+"]");
        this.playCount++;
        if (this.sourceNode) return true; //Don't double-play
        if (!this.audiobuffer) { //not loaded yet, can't play yet
            if (this.loadPromise) {
                this.loadPromise.then( this.play.bind(this, time, offset, this.playCount+1) ); //try again after things loads
            }
            return false;
        }
        if (playDepth !== undefined && playDepth !== this.playCount) return false;
        
        time = (time || 0) + this.audioCtx.currentTime;
        if (this.loop && offset === true) {
            offset = (Math.random() * (this.loop[1] - this.loop[0])) + this.loop[0];
        } else {
            offset = ((typeof offset === "number")?offset : 0);
		}
        
        this.sourceNode = this.audioCtx.createBufferSource();
        this.sourceNode.buffer = this.audiobuffer;
        if (this.loop) {
            this.sourceNode.loop = true;
            this.sourceNode.loopStart = this.loop[0];
            this.sourceNode.loopEnd = this.loop[1];
        }
        this.sourceNode.onended = ()=>{
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        this.sourceNode.connect(this.panNode || this.volNode);
        this.sourceNode.start(time, offset);
        this.fadeNode.gain.setValueAtTime(1, time+0.1);
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
        if (!this.sourceNode) return true; //Can't double-stop
        
        time = (time || 0) + this.audioCtx.currentTime;
        this.fadeNode.gain.setValueAtTime(1, time+0.1);
        let srcNode = this.sourceNode;
        this.sourceNode.onended = function(){
            srcNode.disconnect();
        };
        this.sourceNode.stop(time);
        this.sourceNode = null;
        return true;
    }
    
	pause(): boolean {
		// console.debug("♫ PAUSE: "+this.id);
        if (!this.sourceNode) return false; //can't pause while not playing
        
        this.pauseOffset = this.audioCtx.currentTime - this.startTime;
        if (this.loop) {
            this.pauseOffset -= this.loop[0];
            this.pauseOffset %= (this.loop[1] - this.loop[0]);
        }
        this.sourceNode.stop();
        this.sourceNode.disconnect();
        this.sourceNode = null;
        return true;
    }
    
	resume(): boolean {
		// console.debug("♫ RESUME: "+this.id);
        if (this.sourceNode) return false; //can't resume while playing
        if (this.pauseOffset === null) return false; //can't resume if not paused
        
        var offset = this.pauseOffset + (this.loop)?this.loop[0]:0;
        return this.play(0, offset);
	}
    
	fadeOut(time?:number, delay?:number) {
		// console.debug("♫ FADE: "+this.id);
        this.playCount--;
        if (!this.sourceNode) return; //can't fade if we aren't playing
        delay = delay || 0;
        time = time || 2;
        this.fadeNode.gain.setValueAtTime(1, this.audioCtx.currentTime+delay);
        this.fadeNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime+delay+time);
        this.fadeNode.gain.setValueAtTime(1, this.audioCtx.currentTime+delay+time+0.5);
        this.sourceNode.stop(this.audioCtx.currentTime+delay+time+0.1);
    }
    
    /**
     * Schedules a transition out of this stream.
     * @returns The delay before this stream ends.
     */
    transitionOut():number {
        this.playCount--;
        if (!this.sourceNode) return; //can't transition out if we aren't playing
        
        let timeLeft = 0;
        let playTime = this.audioCtx.currentTime - this.startTime;
        if (this.loop) {
            playTime -= this.loop[0];
            playTime %= this.loop[1] - this.loop[0];
            playTime += this.loop[0];
        }
        switch (this.transition) {
            case 'cut':
                timeLeft = 0; break;
            case 'wait-end':
                if (this.loop) {
                    timeLeft = this.loop[0] - playTime;
                } else {
                    timeLeft = this.audiobuffer.duration - playTime;
                }
                break;
            case 'cut-on-beat':
                timeLeft = (playTime - this.beatOffset) % this.beat;
                break;
            case 'fade-out':
                timeLeft = 10.1;
                this.fadeOut(10, 0);
                break;
        }
        this.stop(timeLeft);
        return timeLeft;
    }
    
	set onended(evt:Event) {
		if (!this.sourceNode) return; //can't assign when not playing
        this.sourceNode.onended = evt;
    }
    
	get isPlaying(): boolean { return !!this.sourceNode; }
    
    get volume(){ return this.volNode.gain.value * 100; }
    set volume(val){
        this.volNode.gain.cancelScheduledValues(0);
        this.volNode.gain.setValueAtTime(val / 100, this.audioCtx.currentTime);
    }
    setVolume(vol:number, duration:number) {
        let curr = this.volNode.gain.value;
        this.volNode.gain.cancelScheduledValues(0);
        this.volNode.gain.setValueAtTime(this.volNode.gain.value, this.audioCtx.currentTime);
        this.volNode.gain.linearRampToValueAtTime(vol/100, this.audioCtx.currentTime+duration);
    }
}

///////////////////////////////////////////////////////////////////////////////

interface StateMachineConfig_LoopConfig {
    readonly url: string;
    readonly loop: [number, number];
    readonly trans?: 'cut'|'wait-end'|'cut-on-beat'|'fade-out';
    readonly beat?: number;
}
interface StateMachineConfig_StateConfig {
    readonly triggers: string[];
    readonly streams: string[];
    readonly next: string[];
    readonly pause?: 'cut'|'pause'|'lowpass';
    readonly disableInReplay?: boolean;
}

interface StateMachineConfig extends SoundConfig {
    readonly streams: {[string]:StateMachineConfig_LoopConfig};
    readonly states: {[string]:StateMachineConfig_StateConfig};
}

/** A state in the Music State Machine. */
interface MSMState {
    /** The id of this state */
    readonly id: string;
    /** The battle events that will trigger this state next. */
    readonly triggers: string[];
    /** The streams that should be playing (simultaniously) when this state is active. */
    readonly streams: string[];
    /** The volumes of the above streams, crossfaded to when this state becomes active. */
    readonly streamVols: number[];
    /** A list of state ids which are legally allowed to be transitioned into. */
    readonly next: string[];
    /** The method used to pause music in this state. */
    readonly pause?: string;
    /** If this state should be disabled during replays. */
    readonly disableInReplay?: boolean;
}


//TODO: Parse the example music state machines into something usable
class MusicStateMachine implements Playable {
    states: {[id:string]:MSMState} = {};
    streams: {[id:string]:MusicStream} = {};
    
    protected audioCtx:AudioContext;
    protected filterNode:BiquadFilterNode;
    activeState:MSMState = null;
    
	constructor(ctx:AudioContext, config:StateMachineConfig, destNode:AudioNode) {
        this.audioCtx = ctx;
        this.filterNode = this.audioCtx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = this.audioCtx.sampleRate; //min:40, max:sampleRate
        this.filterNode.Q.value = 0;
        this.filterNode.connect(destNode);
        
        for (let id in config.streams) {
            const sc:StateMachineConfig_LoopConfig = config.streams[id];
            let stream = new MusicStream(ctx, { id, loopstart:sc.loop[0], loopend:sc.loop[1], url:sc.url }, this.filterNode);
            stream.transition = sc.trans || 'cut';
            stream.beat = sc.beat || 0;
            this.streams[id] = stream;
        }
        for (let id in config.states) {
            const sc:StateMachineConfig_StateConfig = config.states[id];
            let streams = [], streamVols = [];
            for (let streamId of sc.streams) {
                let s = streamId.split('@',2);
                streams.push(s[0]);
                streamVols.push(Number.parseInt(s[1], 10));
            }
            this.states[id] = {
                id, streams, streamVols,
                triggers:sc.triggers.slice(), next:sc.next.slice(), pause:sc.pause,
                disableInReplay:sc.disableInReplay,
            }
        }
    }
    
    play(time?:number, offset?:number|boolean, playDepth?:number): boolean {
        this.handleEvent('start');
    }
    
    stop(time?:number): boolean {
        Object.values(this.streams).forEach((s)=>s.stop(time));
        this.activeState = null;
    }
    
    destroy() {
        this.filterNode.disconnect();
        Object.values(this.streams).forEach((s)=>s.destroy());
        this.filterNode = null;
        this.audioCtx = null;
        this.states = null;
        this.streams = null;
    }
    
    get isPlaying(): boolean {
        return Object.values(this.streams).reduce((prev, x)=>prev || x.isPlaying(), false);
    }
    
    /** Gets an array of states that are legally allowed to be next. */
    private getNextStates(): MSMState[] {
        if (this.activeState === null) {
            return Object.values(this.states);
        } else {
            return this.activeState.next.map(x=>this.states[x]);
        }
    }
    
    handleEvent(evt:string) {
        let nextState = null;
        for (let state of this.getNextStates()) {
            if (state.triggers.includes(evt)) {
                nextState = state;
                break;
            }
        }
        if (nextState === null) return; //do nothing
        if (nextState === this.activeState) return; //do nothing
        if (this.activeState !== null) {
            let rem = nextState.streams.filter(x=>!this.activeState.streams.includes(x));
            let add = this.activeState.streams.filter(x=>!nextState.streams.includes(x));
            let same= this.activeState.streams.filter(x=> nextState.streams.includes(x));
            let latest = 0;
            
            //For every stream that does not occur in the next state:
            for (let i of rem) {
                //  Check the stream for how it will transition out
                //  Schedule the transition out
                //  Keep track of the latest stream that will transition out
                let stream = this.streams[i];
                latest = Math.max(latest, stream.transitionOut());
            }
            //For every stream that is shared in the next state
            for (let i of same) {
                //  Schedule the volume change
                let stream = this.streams[i];
                let vol = nextState.streamVols[nextState.streams.indexOf(i)];
                stream.setVolume(vol, 2.0);
            }
            //For every stream that is new in the next state
            for (let i of add) {
                //  Schedule the stream's start for the latest stream's ending
                let stream = this.streams[i];
                let vol = nextState.streamVols[nextState.streams.indexOf(i)];
                stream.volume = vol;
                stream.play(latest);
            }
        } else {
            for (let i of nextState.streams) {
                //  Schedule the stream's start for the latest stream's ending
                let stream = this.streams[i];
                let vol = nextState.streamVols[nextState.streams.indexOf(i)];
                stream.volume = vol;
                stream.play(latest);
            }
        }
        this.activeState = nextState;
    }
}


//TODO: Make the soundmanager own global volume nodes for sound, music, notifivation, and mute,
// which will  be the destinations of all the above objects, and use those nodes for the
// global volume levels.
//TODO: When the user adjusts the volume level, play a sound related to it. Play the notification sound
// when adjusting the notification sound level. Play a bulbasaur cry when adjusting sfx. Play the item
// pick up jingle when adjusting the music volume.
class SoundManager {
	audioCtx: AudioContext;
    // soundBank: {[k:string]:Playable};
    
    protected soundVolNode:GainNode;
    protected musicVolNode:GainNode;
    protected notifyVolNode:GainNode;
    protected globalMuteNode:GainNode;
	
	constructor() {
		this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.soundBank = {};
        
        this.soundVolNode = this.audioCtx.createGain();
        this.musicVolNode = this.audioCtx.createGain();
        this.notifyVolNode = this.audioCtx.createGain();
        this.globalMuteNode = this.audioCtx.createGain();
        
        this.soundVolNode.gain.value = 1;
        this.musicVolNode.gain.value = 1;
        this.notifyVolNode.gain.value = 1;
        this.globalMuteNode.gain.value = 1;
        
        this.soundVolNode.connect(this.globalMuteNode);
        this.musicVolNode.connect(this.globalMuteNode);
        this.notifyVolNode.connect(this.globalMuteNode);
        this.globalMuteNode.connect(this.audioCtx.destination);
	}
	
	setup(options: object) {
		// compatibility, not used
    }
    
    onready(fn: Function) {
        $(fn);
    }
	
	createSound(config: SoundConfig): Sound {
        let sound;
        switch (config.type) {
            default:
            case 'sound':
                sound = new Sound(this.audioCtx, config, this.soundVolNode);
                break;
            case 'notify':
                sound = new Sound(this.audioCtx, config, this.notifyVolNode);
                break;
            case 'music':
                throw new TypeError('Use createMusic() instead to create music.');
        }
        return sound;
        
		// if (!config) throw new Error("No configuration given for sound!");
		// if (typeof config === "string") {
		// 	config = { id: config, url: config };
		// }
		// if (config.url === undefined) throw new Error("No url given for sound!");
        // if (config.id === undefined) config.id = config.url;
        // return (this.soundBank[config.id] = new Sound(config));
    }
    
    createMusic(config: StateMachineConfig): MusicStateMachine {
        if (config.type && config.type !== 'music')
            throw new TypeError('Use createSound() instead to create sounds.');
        
        let music = new MusicStateMachine(this.audioCtx, config, this.musicVolNode);
        return music;
    }
	
	// getSoundById(id) {
    //     return this.soundBank[id];
    // }
    
    // destroySound(id) {
        // this.soundBank[id].stop();
        // this.soundBank[id].unload();
        // this.soundBank[id].destroy();
        // delete this.soundBank[id];
        // return true;
    // }
    
    // onready(fn:Function) {
    //     $(fn);
    // }
    
    get effectVolume() { return this.soundVolNode.gain.value; }
    set effectVolume(val) { this.soundVolNode.gain.value = val; }
    
    get bgmVolume() { return this.musicVolNode.gain.value; }
    set bgmVolume(val) { this.musicVolNode.gain.value = val; }
    
    get notifyVolume() { return this.notifyVolNode.gain.value; }
    set notifyVolume(val) { this.notifyVolNode.gain.value = val; }
    
    get isMuted() { return this.globalMuteNode.gain.value < 0.5; }
    set isMuted(val) { this.globalMuteNode.gain.value = val? 0 : 1; }
}

const soundManager = new SoundManager();


if (typeof require === 'function') {
	// in Node
	(global as any).SoundManager = SoundManager;
}
