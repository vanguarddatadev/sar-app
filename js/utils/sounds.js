// Sound Effects System
// Generates procedural sound effects using Web Audio API

export const AppSounds = {
    audioContext: null,
    enabled: true,
    volume: 0.3, // Default volume 30%

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🔊 Sound system initialized');
        } catch (error) {
            console.warn('Sound system not available:', error);
            this.enabled = false;
        }
    },

    play(soundType) {
        if (!this.enabled || !this.audioContext) return;

        switch(soundType) {
            case 'shuffle':
                this.playCardShuffle();
                break;
            case 'click':
                this.playSoftClick();
                break;
        }
    },

    playCardShuffle() {
        // Create a realistic riffle shuffle sound with multiple layers
        try {
            const now = this.audioContext.currentTime;

            // Layer 1: Rapid clicking sounds (cards hitting each other)
            for (let i = 0; i < 12; i++) {
                setTimeout(() => {
                    // Create click sound
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    const filter = this.audioContext.createBiquadFilter();

                    // Bandpass filter for crisp click
                    filter.type = 'bandpass';
                    filter.frequency.value = 2000 + Math.random() * 1000;
                    filter.Q.value = 10;

                    osc.type = 'square';
                    osc.frequency.value = 200 + Math.random() * 100;

                    // Very short envelope for click
                    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain.gain.linearRampToValueAtTime(this.volume * 0.05, this.audioContext.currentTime + 0.001);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.01);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.audioContext.destination);

                    osc.start();
                    osc.stop(this.audioContext.currentTime + 0.01);
                }, i * 15); // Rapid succession
            }

            // Layer 2: Swoosh sounds (cards sliding)
            for (let i = 0; i < 2; i++) {
                setTimeout(() => {
                    const bufferSize = this.audioContext.sampleRate * 0.15;
                    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
                    const output = buffer.getChannelData(0);

                    // Generate filtered noise
                    for (let j = 0; j < bufferSize; j++) {
                        output[j] = (Math.random() * 2 - 1) * Math.exp(-j / bufferSize * 2);
                    }

                    const noise = this.audioContext.createBufferSource();
                    noise.buffer = buffer;

                    // Lowpass for swoosh
                    const filter = this.audioContext.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.value = 800 + (i * 300);
                    filter.Q.value = 1;

                    const gain = this.audioContext.createGain();
                    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gain.gain.linearRampToValueAtTime(this.volume * 0.08, this.audioContext.currentTime + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.audioContext.destination);

                    noise.start();
                    noise.stop(this.audioContext.currentTime + 0.15);
                }, 50 + (i * 100));
            }

            // Layer 3: Flutter effect (cards settling)
            setTimeout(() => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                const lfo = this.audioContext.createOscillator();
                const lfoGain = this.audioContext.createGain();

                // LFO for flutter
                lfo.frequency.value = 25;
                lfoGain.gain.value = 50;
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);

                osc.type = 'triangle';
                osc.frequency.value = 400;

                gain.gain.setValueAtTime(this.volume * 0.03, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

                osc.connect(gain);
                gain.connect(this.audioContext.destination);

                lfo.start();
                osc.start();
                lfo.stop(this.audioContext.currentTime + 0.3);
                osc.stop(this.audioContext.currentTime + 0.3);
            }, 180);

        } catch (error) {
            console.log('Shuffle sound failed:', error);
        }
    },

    playSoftClick() {
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = 800;

            gain.gain.setValueAtTime(this.volume * 0.1, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.05);
        } catch (error) {
            console.log('Click sound failed:', error);
        }
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        AppSounds.init();
    });
}
