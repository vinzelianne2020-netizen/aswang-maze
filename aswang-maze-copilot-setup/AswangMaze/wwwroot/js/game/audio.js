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
    this.masterVolume = settings.masterVolume ?? 0.8;
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
      this.sfx.gain.value = 0.8;
      this.ambient.gain.value = 0.55;
      this.heartbeat.gain.value = 0;

      this.sfx.connect(this.master);
      this.ambient.connect(this.master);
      this.heartbeat.connect(this.master);
      this.master.connect(this.context.destination);
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

  update(dt, tension) {
    if (!this.context || !this.unlocked) return;

    this.tension = Math.max(0, Math.min(1, tension));
    const smoothing = Math.min(1, dt * 2);
    this.smoothedTension +=
      (this.tension - this.smoothedTension) * smoothing;

    if (this.smoothedTension < 0.15) {
      this.heartbeat.gain.setTargetAtTime(
        0,
        this.context.currentTime,
        0.08
      );
      this.heartbeatTimer = 0;
      return;
    }

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
