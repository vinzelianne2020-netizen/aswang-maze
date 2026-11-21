export class HorrorAudio {
  constructor(settings = {}) {
    this.context = null;
    this.master = null;
    this.sfx = null;
    this.ambient = null;
    this.heartbeat = null;
    this.unlocked = false;
    this.tension = 0;
    this.smoothedTension = 0;
    this.heartbeatTimer = 0;
    this.ambientEventTimer = 10 + Math.random() * 8;
    this.enemyCueTimer = 4;
    this.ambienceNodes = null;
    this.masterVolume = settings.masterVolume ?? 0.8;
    this.effectsVolume = settings.effectsVolume ?? 0.8;
    this.ambienceVolume = settings.ambienceVolume ?? 0.55;
  }

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;

      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.sfx = this.context.createGain();
      this.ambient = this.context.createGain();
      this.heartbeat = this.context.createGain();

      this.master.gain.value = this.masterVolume;
      this.sfx.gain.value = this.effectsVolume;
      this.ambient.gain.value = this.ambienceVolume;
      this.heartbeat.gain.value = 0;

      this.sfx.connect(this.master);
      this.ambient.connect(this.master);
      this.heartbeat.connect(this.master);
      this.master.connect(this.context.destination);
      this.createAmbience();
    }

    if (this.context.state === "suspended") {
      this.context.resume();
    }

    this.unlocked = this.context.state === "running";
    return this.unlocked;
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.masterVolume,
        this.context.currentTime,
        0.05
      );
    }
  }

  setEffectsVolume(volume) {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
    if (this.sfx && this.context) {
      this.sfx.gain.setTargetAtTime(this.effectsVolume, this.context.currentTime, 0.05);
    }
  }

  setAmbienceVolume(volume) {
    this.ambienceVolume = Math.max(0, Math.min(1, volume));
    if (this.ambient && this.context) {
      this.ambient.gain.setTargetAtTime(this.ambienceVolume, this.context.currentTime, 0.05);
    }
  }

  update(dt, tension, player = null, enemies = [], active = true) {
    if (!this.context || !this.unlocked) return;

    this.tension = Math.max(0, Math.min(1, tension));
    const smoothing = Math.min(1, dt * 2);
    this.smoothedTension +=
      (this.tension - this.smoothedTension) * smoothing;
    this.updateAmbience();
    if (player) this.updateListener(player);

    if (this.smoothedTension < 0.15) {
      this.heartbeat.gain.setTargetAtTime(
        0,
        this.context.currentTime,
        0.08
      );
      this.heartbeatTimer = 0;
    } else {
      const interval =
        1.1 + (0.35 - 1.1) * this.smoothedTension;
      const volume =
        0.9 * this.smoothedTension;

      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.playHeartbeat(volume);
        this.heartbeatTimer = interval;
      }
    }

    if (!active || !player) return;

    this.ambientEventTimer -= dt;
    if (this.ambientEventTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 9 + Math.random() * 12;
      const sounds = ["creak", "knock", "whisper", "scrape", "screech"];
      this.playSpatialCue(
        player.x + Math.cos(angle) * distance,
        player.y + Math.sin(angle) * distance,
        sounds[Math.floor(Math.random() * sounds.length)]
      );
      this.ambientEventTimer = 10 + Math.random() * 17;
    }

    const nearest = enemies
      .filter((enemy) => enemy.state !== "DEAD")
      .map((enemy) => ({
        enemy,
        distance: Math.hypot(enemy.x - player.x, enemy.y - player.y)
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    this.enemyCueTimer -= dt;
    if (nearest && nearest.distance < 10 && this.enemyCueTimer <= 0) {
      const cue = nearest.enemy.state === "CHASE"
        ? Math.random() < 0.35 ? "footstep" : "breath"
        : "growl";
      this.playSpatialCue(nearest.enemy.x, nearest.enemy.y, cue, this.sfx);
      this.enemyCueTimer = 5 + Math.random() * 7;
    }
  }

  createAmbience() {
    const now = this.context.currentTime;
    const drone = this.context.createOscillator();
    const droneGain = this.context.createGain();
    const droneFilter = this.context.createBiquadFilter();
    drone.type = "sine";
    drone.frequency.value = 42;
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 95;
    droneGain.gain.value = 0.0001;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.ambient);
    drone.start(now);

    const windBuffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 2,
      this.context.sampleRate
    );
    const windSamples = windBuffer.getChannelData(0);
    for (let index = 0; index < windSamples.length; index++) {
      windSamples[index] = (Math.random() * 2 - 1) * 0.35;
    }
    const wind = this.context.createBufferSource();
    const windFilter = this.context.createBiquadFilter();
    const windGain = this.context.createGain();
    wind.buffer = windBuffer;
    wind.loop = true;
    windFilter.type = "lowpass";
    windFilter.frequency.value = 360;
    windGain.gain.value = 0.0001;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambient);
    wind.start(now);
    this.ambienceNodes = { droneGain, droneFilter, windGain };
  }

  updateAmbience() {
    const now = this.context.currentTime;
    const tension = this.smoothedTension;
    this.ambienceNodes.droneGain.gain.setTargetAtTime(
      0.012 + tension * 0.045,
      now,
      0.8
    );
    this.ambienceNodes.droneFilter.frequency.setTargetAtTime(
      75 + tension * 110,
      now,
      0.6
    );
    this.ambienceNodes.windGain.gain.setTargetAtTime(
      0.018 + tension * 0.025,
      now,
      1
    );
  }

  updateListener(player) {
    const listener = this.context.listener;
    const now = this.context.currentTime;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(player.x, now, 0.05);
      listener.positionY.setTargetAtTime(1.6, now, 0.05);
      listener.positionZ.setTargetAtTime(player.y, now, 0.05);
      listener.forwardX.setTargetAtTime(player.dirX, now, 0.05);
      listener.forwardY.setTargetAtTime(0, now, 0.05);
      listener.forwardZ.setTargetAtTime(player.dirY, now, 0.05);
      listener.upX.setTargetAtTime(0, now, 0.05);
      listener.upY.setTargetAtTime(1, now, 0.05);
      listener.upZ.setTargetAtTime(0, now, 0.05);
    } else {
      listener.setPosition(player.x, 1.6, player.y);
      listener.setOrientation(player.dirX, 0, player.dirY, 0, 1, 0);
    }
  }

  playSpatialCue(x, z, kind, output = this.ambient) {
    if (!this.context || !this.unlocked) return;
    const cues = {
      creak: { frequency: 185, duration: 0.75, volume: 0.11, type: "sawtooth" },
      knock: { frequency: 92, duration: 0.28, volume: 0.18, type: "triangle" },
      whisper: { frequency: 330, duration: 0.85, volume: 0.12, type: "sawtooth" },
      scrape: { frequency: 145, duration: 0.62, volume: 0.12, type: "square" },
      breath: { frequency: 115, duration: 0.52, volume: 0.15, type: "triangle" },
      growl: { frequency: 72, duration: 0.72, volume: 0.2, type: "sawtooth" },
      scream: { frequency: 260, duration: 0.8, volume: 0.3, type: "sawtooth" },
      screech: { frequency: 740, duration: 0.46, volume: 0.24, type: "sawtooth" },
      footstep: { frequency: 64, duration: 0.22, volume: 0.14, type: "triangle" }
    };
    const cue = cues[kind];
    if (!cue) return;
    const now = this.context.currentTime;
    const panner = this.context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = 30;
    panner.rolloffFactor = 1.35;
    panner.setPosition(x, 1.2, z);

    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = cue.type;
    const startFrequency = cue.frequency * (0.88 + Math.random() * 0.24);
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(25, startFrequency * (kind === "scream" ? 1.7 : 0.62)),
      now + cue.duration
    );
    filter.type = "lowpass";
    filter.frequency.value = kind === "whisper" ? 950 : 1400;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(cue.volume, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(output);
    oscillator.start(now);
    oscillator.stop(now + cue.duration + 0.02);

    const noiseDuration = Math.min(0.3, cue.duration);
    const noiseBuffer = this.context.createBuffer(
      1,
      Math.floor(this.context.sampleRate * noiseDuration),
      this.context.sampleRate
    );
    const samples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
    }
    const noise = this.context.createBufferSource();
    const noiseGain = this.context.createGain();
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(cue.volume * 0.3, now + 0.03);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration);
    noise.connect(noiseGain);
    noiseGain.connect(panner);
    noise.start(now);
  }

  playEnemyCue(x, z, kind) {
    this.playSpatialCue(x, z, kind, this.sfx);
  }

  playGunshot() {
    if (!this.context || !this.unlocked) return;
    const now = this.context.currentTime;
    const duration = 0.16;
    const buffer = this.context.createBuffer(
      1,
      Math.floor(this.context.sampleRate * duration),
      this.context.sampleRate
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
      const envelope = Math.exp(-index / (samples.length * 0.17));
      samples[index] = (Math.random() * 2 - 1) * envelope;
    }
    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 2100;
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    noise.start(now);
    this.playTone(84, 0.11, 0.42);
  }

  playReload() {
    if (!this.context || !this.unlocked) return;
    this.playTone(720, 0.055, 0.16);
    window.setTimeout(() => this.playTone(410, 0.09, 0.22), 420);
    window.setTimeout(() => this.playTone(890, 0.065, 0.18), 1180);
  }

  playBatterySwap() {
    this.playTone(540, 0.08, 0.18);
    window.setTimeout(() => this.playTone(760, 0.12, 0.22), 120);
  }

  playFlashlightPowerDown() {
    this.playTone(190, 0.18, 0.16);
  }

  playHeartbeat(volume) {
    if (!this.context || !this.unlocked) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(62, now);
    oscillator.frequency.exponentialRampToValueAtTime(38, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    oscillator.connect(gain);
    gain.connect(this.heartbeat);
    oscillator.start(now);
    oscillator.stop(now + 0.15);

    const secondBeat = now + 0.18;
    const secondOscillator = this.context.createOscillator();
    const secondGain = this.context.createGain();
    secondOscillator.type = "sine";
    secondOscillator.frequency.setValueAtTime(58, secondBeat);
    secondOscillator.frequency.exponentialRampToValueAtTime(36, secondBeat + 0.1);
    secondGain.gain.setValueAtTime(0.0001, secondBeat);
    secondGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * 0.7),
      secondBeat + 0.01
    );
    secondGain.gain.exponentialRampToValueAtTime(0.0001, secondBeat + 0.12);
    secondOscillator.connect(secondGain);
    secondGain.connect(this.heartbeat);
    secondOscillator.start(secondBeat);
    secondOscillator.stop(secondBeat + 0.13);
  }

  playFootstep(sprinting = false) {
    if (!this.context || !this.unlocked) return;

    const duration = sprinting ? 0.07 : 0.09;
    const frameCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(
      1,
      frameCount,
      this.context.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index++) {
      const envelope = 1 - index / frameCount;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = (sprinting ? 1.12 : 1) * (0.95 + Math.random() * 0.1);
    gain.gain.value = sprinting ? 0.35 : 0.22;
    source.connect(gain);
    gain.connect(this.sfx);
    source.start();
  }

  playTone(frequency, duration, volume = 0.2) {
    if (!this.context || !this.unlocked) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.sfx);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  getSmoothTension() {
    return this.smoothedTension;
  }
}
