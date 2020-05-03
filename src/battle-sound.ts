
type truthy = any;

/** Raw bgm info stored in the bgm index, for all music with simple loops. */
interface BgmInfoLooped {
	loop: [number, number];
	tags: {[string]:truthy};
	info: string;
	url?: string;
	victoryMusic?: string;
}

interface BgmInfo {
	id: string;
	url: string;
	info: string;
	loop?: [number, number];
	isVictory: boolean;
	isHidden: boolean;
	winMusic?: string;
	stateMachine?: any;
}

const BGM_PATH = "audio/bgm/";

const DEFAULT_BGM_STATE_MACHINE = {
	streams: {
		"main": { loop:[0.000, 0.000], trans:'cut' },
		"win":  { loop:[0.000, 0.000], trans:'fade-out' },
	},
	states: {
		main: {
			triggers:['start'],
			streams:['main@100'],
			next:['win'],
			pause:'randstart',
		},
		win: {
			triggers:['win', 'tie'],
			streams:['win@100'],
			next:[],
			pause:'cut',
		},
	},
};


const BattleSound = new class {
	musicMetatable: {[string]:BgmInfo | string};
	
	soundBank: {[string]:Playable};
	musicBank: {[string]:Playable};
	
	randBattleMusic: Array<string> = [];
	randVictoryMusic: Array<string> = [];
	randCategoryMusic = {
		trainer: [],
		gym: [],
		e4: [],
		champ: [],
		hidden: [],
	} as any;
	
	playHidden = false;
	
	private getMusicMeta(id:string): BgmInfo {
		if (!id) return null;
		let meta = this.musicMetatable[id];
		if (meta && meta.url) return meta;
		
		if (typeof meta === 'string') {
			meta = this.musicMetatable[meta];
			if (meta && meta.url) return meta;
		}
		if (id.indexOf('/') === -1) {
			let mid = id.replace('-', '/'); //replaces first dash with a slash
			meta = this.musicMetatable[mid];
			if (meta && meta.url) return meta;
		}
		return null;
	}
	private getRandomBattleMusic(): string {
		return this.randBattleMusic[Math.floor(Math.random() * this.randBattleMusic.length)];
	}
	private getRandomVictoryMusic(): string {
		return this.randVictoryMusic[Math.floor(Math.random() * this.randVictoryMusic.length)];
	}
	
	///////////////////////////////////////////////////////////////////////////
	// Externally referenced functions
	
	playEffect(url: string):void {
		if (soundManager.isMuted) return;
		let sound = this.loadEffect(url);
		if (sound) sound.play();
	}
	
	loadMusic(id:string) {
		let mainMeta, winMeta;
		
		mainMeta = this.getMusicMeta(id);
		winMeta = this.getMusicMeta(mainMeta.winMusic || this.getRandomVictoryMusic());
		
		let sconfig = (meta as BgmInfo).stateMachine;
		if (!sconfig) {
			sconfig = { states:DEFAULT_BGM_STATE_MACHINE.states };
			sconfig.streams = {
				"main": Object.assign({}, DEFAULT_BGM_STATE_MACHINE.streams["main"], mainMeta),
				"win": Object.assign({}, DEFAULT_BGM_STATE_MACHINE.streams["win"], winMeta),
			};
		}
		let music = soundManager.createMusic(meta);
	}
	
	///////////////////////////////////////////////////////////////////////////
	// Added external functions by TPP
	
	registerBGMs(list: {readonly [string]: BgmInfoLooped | string}) {
		for (let key in list) {
			let value = list[key];
			if (typeof value === 'string') {
				this.musicMetatable[key] = value;
				continue;
			}
			if (typeof value !== 'object') continue;
			if (value.tags.hidden && !playHidden) continue;
			let bgmi:BgmInfo = { 
				id: key, 
				url: value.url || BGM_PATH + key + ".mp3",
				info: value.info,
				loop: value.loop,
				isVictory: !!value.tags.victory,
				isHidden: !!value.tags.hidden,
				winMusic: value.victoryMusic,
			};
			if (value.tags.random) {
				if (value.tags.victory) 
					this.randVictoryMusic.push(key);
				else if ((value.tags.hidden && playHidden) || (!value.tags.hidden && !playHidden))
					this.randBattleMusic.push(key);
			}
			for (let cat in this.randCategoryMusic) {
				if (value.tags[cat]) this.randCategoryMusic[cat].push(key);
			}
			this.musicMetatable[key] = bgmi;
		}
	}
	
	registerDynamicBGM(key:string, value:object) {
		let bgmi:BgmInfo = { 
			id: key, 
			url: value.url || BGM_PATH + key + "/",
			info: value.info,
			isVictory: !!value.tags.victory,
			isHidden: !!value.tags.hidden,
			stateMachine: { streams:value.streams, states:value.states },
		};
		// populate url properties for the streams inside
		for (let s in value.streams) {
			let si = bgmi.stateMachine.streams[s];
			si.url = si.url || bgmi.url + s + '.mp3';
		}
	}
	
	///////////////////////////////////////////////////////////////////////////
	// Internally referenced functions
	
	loadEffect(url: string): Sound {
		const id = url;
		let sound:Sound = this.soundBank[id];
		if (!sound) {
			this.soundBank[id] = sound = soundManager.createSound({
				id, url, type:'sound',
			});
		}
		return sound;
	}
	
	setMute(muted: boolean) {
		soundManager.isMuted = !!muted;
	}
	loudnessPercentToAmplitudePercent(loudnessPercent: number) {
		// 10 dB is perceived as approximately twice as loud
		let decibels = 10 * Math.log(loudnessPercent / 100) / Math.log(2);
		return Math.pow(10, decibels / 20) * 100;
	}
	setBgmVolume(bgmVolume: number) {
		soundManager.bgmVolume = this.loudnessPercentToAmplitudePercent(bgmVolume);
	}
	setEffectVolume(effectVolume: number) {
		soundManager.effectVolume = this.loudnessPercentToAmplitudePercent(effectVolume);
	}
};