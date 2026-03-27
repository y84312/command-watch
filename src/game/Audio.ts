export class AudioManager {
  ctx: AudioContext | null = null;
  enabled: boolean = false;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.enabled = true;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration: number, vol: number = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  playClick() { this.playTone(800, 'sine', 0.1, 0.1); }
  playError() { this.playTone(150, 'sawtooth', 0.3, 0.1); }
  playPlace() { this.playNoise(0.3, 0.2); this.playTone(100, 'square', 0.2, 0.2); }
  playShoot() { this.playNoise(0.1, 0.1); }
  playExplosion() { this.playNoise(0.5, 0.3); this.playTone(50, 'sawtooth', 0.5, 0.2); }
  playAck() { 
    this.playTone(600, 'square', 0.05, 0.05); 
    setTimeout(() => this.playTone(800, 'square', 0.05, 0.05), 50);
  }
  playReady() {
    this.playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(600, 'sine', 0.2, 0.1), 100);
  }
}

export const audio = new AudioManager();
