
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
	stateMachine?: any;
}

const BGM_PATH = "audio/bgm/";

const DEFAULT_BGM_STATE_MACHINE = {
	streams: {
		"main": { loop:[0.000, 0.000], trans:'cut'      pause:'randstart' },
		"win":  { loop:[0.000, 0.000], trans:'fade-out' pause:'cut'},
	},
	states: {
		main: {
			triggers:['start'],
			streams:['main@100'],
			next:['win'],
		},
		win: {
			triggers:['win', 'tie'],
			streams:['win@100'],
			next:[],
		},
	},
};


const BattleSound = new class {
	musicMetatable: {[string]:BgmInfo | string}
	
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
	
	
	///////////////////////////////////////////////////////////////////////////
	// Externally referenced functions, must stay the same for compatiility
	
	playEffect(url: string) {
		if (!this.muted) this.loadEffect(url).setVolume(this.effectVolume).play();
	}
	
	loadBgm(url: string, loopstart: number, loopend: number, replaceBGM?: BattleBGM | null) {
		
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
	
	setMute(muted: boolean) {
		//TODO
	}
	loudnessPercentToAmplitudePercent(loudnessPercent: number) {
		// 10 dB is perceived as approximately twice as loud
		let decibels = 10 * Math.log(loudnessPercent / 100) / Math.log(2);
		return Math.pow(10, decibels / 20) * 100;
	}
	setBgmVolume(bgmVolume: number) {
		this.bgmVolume = this.loudnessPercentToAmplitudePercent(bgmVolume);
		//TODO
	}
	setEffectVolume(effectVolume: number) {
		this.effectVolume = this.loudnessPercentToAmplitudePercent(effectVolume);
	}
};