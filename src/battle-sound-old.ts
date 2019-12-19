
interface SMSound {
	play(): this;
	pause(): this;
	stop(): this;
	resume(): this;
	setVolume(volume: number): this;
	setPosition(position: number): this;
	onposition(position: number, callback: (this: this) => void): this;
	position: number;
	readonly paused: boolean;
	playState: 0 | 1;
	isSoundPlaceholder?: boolean;
}
class BattleBGM {
	/**
	 * May be shared with other BGM objects: every battle has its own BattleBGM
	 * object, but two battles with the same music will have the same SMSound
	 * object.
	 */
	sound: SMSound;
	isPlaying = false;
	constructor(sound: SMSound) {
		this.sound = sound;
	}
	play() {
		if (this.isPlaying) return;
		this.isPlaying = true;
		if (BattleSound.muted || !BattleSound.bgmVolume) return;
		let thisIsFirst = false;
		for (const bgm of BattleSound.bgm) {
			if (bgm === this) {
				thisIsFirst = true;
			} else if (bgm.isPlaying) {
				if (!thisIsFirst) return;
				bgm.sound.pause();
				break;
			}
		}
		this.sound.setVolume(BattleSound.bgmVolume);
		// SoundManager bugs out if you call .play() while it's already playing
		if (!this.sound.playState || this.sound.paused) {
			this.sound.play();
		}
	}
	pause() {
		this.isPlaying = false;
		this.sound.pause();
		BattleBGM.update();
	}
	stop() {
		this.isPlaying = false;
		this.sound.stop();
	}
	destroy() {
		this.isPlaying = false;
		this.sound.stop();
		const soundIndex = BattleSound.bgm.indexOf(this);
		if (soundIndex >= 0) BattleSound.bgm.splice(soundIndex, 1);
		BattleBGM.update();
	}
	static update() {
		for (const bgm of BattleSound.bgm) {
			if (bgm.isPlaying) {
				if (BattleSound.muted || !BattleSound.bgmVolume) {
					bgm.sound.pause();
				} else {
					bgm.sound.setVolume(BattleSound.bgmVolume);
					// SoundManager bugs out if you call .play() while it's already playing
					if (!bgm.sound.playState || bgm.sound.paused) {
						bgm.sound.play();
					}
				}
				break;
			}
		}
	}
}
const BattleSound = new class {
	effectCache: {[url: string]: SMSound} = {};

	// bgm
	bgmCache: {[url: string]: SMSound} = {};
	bgm: BattleBGM[] = [];

	// misc
	soundPlaceholder: SMSound = {
		play() { return this; },
		pause() { return this; },
		stop() { return this; },
		resume() { return this; },
		setVolume() { return this; },
		onposition() { return this; },
		isSoundPlaceholder: true,
	} as any;

	// options
	effectVolume = 50;
	bgmVolume = 50;
	muted = false;

	loadEffect(url: string) {
		if (this.effectCache[url] && !this.effectCache[url].isSoundPlaceholder) {
			return this.effectCache[url];
		}
		try {
			this.effectCache[url] = soundManager.createSound({
				id: url,
				url: Dex.resourcePrefix + url,
				volume: this.effectVolume,
			}) as SMSound;
		} catch {}
		if (!this.effectCache[url]) {
			this.effectCache[url] = this.soundPlaceholder;
		}
		return this.effectCache[url];
	}
	playEffect(url: string) {
		if (!this.muted) this.loadEffect(url).setVolume(this.effectVolume).play();
	}

	addBgm(sound: SMSound, replaceBGM?: BattleBGM | null) {
		if (replaceBGM) {
			replaceBGM.sound.stop();
			replaceBGM.sound = sound;
			BattleBGM.update();
			return replaceBGM;
		}
		const bgm = new BattleBGM(sound);
		this.bgm.push(bgm);
		return bgm;
	}

	/** loopstart and loopend are in milliseconds */
	loadBgm(url: string, loopstart: number, loopend: number, replaceBGM?: BattleBGM | null) {
		let sound = this.bgmCache[url];
		if (sound) {
			if (!sound.isSoundPlaceholder) {
				return this.addBgm(sound, replaceBGM);
			}
		}
		try {
			sound = soundManager.createSound({
				id: url,
				url: Dex.resourcePrefix + url,
				volume: this.bgmVolume,
			});
		} catch {}
		if (!sound) {
			// couldn't load
			// suppress crash
			return this.addBgm(this.bgmCache[url] = this.soundPlaceholder, replaceBGM);
		}
		sound.onposition(loopend, function () {
			this.setPosition(this.position - (loopend - loopstart));
		});
		this.bgmCache[url] = sound;
		return this.addBgm(sound, replaceBGM);
	}

	// setting
	setMute(muted: boolean) {
		muted = !!muted;
		if (this.muted === muted) return;
		this.muted = muted;
		BattleBGM.update();
	}

	loudnessPercentToAmplitudePercent(loudnessPercent: number) {
		// 10 dB is perceived as approximately twice as loud
		let decibels = 10 * Math.log(loudnessPercent / 100) / Math.log(2);
		return Math.pow(10, decibels / 20) * 100;
	}
	setBgmVolume(bgmVolume: number) {
		this.bgmVolume = this.loudnessPercentToAmplitudePercent(bgmVolume);
		BattleBGM.update();
	}
	setEffectVolume(effectVolume: number) {
		this.effectVolume = this.loudnessPercentToAmplitudePercent(effectVolume);
	}
};
