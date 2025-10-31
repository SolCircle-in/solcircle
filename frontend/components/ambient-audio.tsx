"use client";

import { useEffect, useRef } from "react";

export default function AmbientAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const stopRef = useRef<() => void>(() => {});

	useEffect(() => {
		const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReduced) return;

		// Lazily create context on first interaction
		const start = async () => {
			if (ctxRef.current) return;
			const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
			ctxRef.current = ctx;

			// Master gain
			const master = ctx.createGain();
			master.gain.value = 0.0; // fade in
			master.connect(ctx.destination);

			// Gentle lowpass to soften highs
			const lowpass = ctx.createBiquadFilter();
			lowpass.type = "lowpass";
			lowpass.frequency.value = 1800;
			lowpass.Q.value = 0.3;
			lowpass.connect(master);

			// Subtle delay for space
			const delay = ctx.createDelay();
			delay.delayTime.value = 0.28;
			const feedback = ctx.createGain();
			feedback.gain.value = 0.25;
			delay.connect(feedback);
			feedback.connect(delay);
			delay.connect(lowpass);

			// LFO to slowly move filter and volume
			const lfo = ctx.createOscillator();
			lfo.type = "sine";
			lfo.frequency.value = 0.07; // very slow
			const lfoGain = ctx.createGain();
			lfoGain.gain.value = 400; // mod amount for filter
			lfo.connect(lfoGain);
			lfoGain.connect(lowpass.frequency);

			// Create a soft chord using multiple detuned oscillators
			const freqs = [220.0, 261.63, 329.63]; // A minor triad-ish
			const oscGains: GainNode[] = [];
			const oscs: OscillatorNode[] = [];
			for (const f of freqs) {
				const o = ctx.createOscillator();
				o.type = "sine";
				o.frequency.value = f;
				o.detune.value = (Math.random() * 8 - 4); // gentle detune
				const g = ctx.createGain();
				g.gain.value = 0.0; // per-osc fade in
				o.connect(g);
				g.connect(delay);
				oscs.push(o);
				oscGains.push(g);
			}

			// Start nodes
			oscs.forEach(o => o.start());
			lfo.start();

			// Fade in master and per-osc gains
			const now = ctx.currentTime;
			master.gain.linearRampToValueAtTime(0.07, now + 3.0);
			oscGains.forEach((g, i) => {
				g.gain.linearRampToValueAtTime(0.05 + i * 0.01, now + 2.0 + i * 0.3);
			});

			stopRef.current = () => {
				const t = ctx.currentTime;
				master.gain.linearRampToValueAtTime(0.0, t + 1.0);
				setTimeout(() => {
					try { oscs.forEach(o => o.stop()); } catch {}
					ctx.close().catch(() => {});
					ctxRef.current = null;
				}, 1100);
			};
		};

		window.addEventListener("click", start, { once: false });
		window.addEventListener("touchstart", start, { once: false });
		window.addEventListener("keydown", start, { once: false });

		return () => {
			window.removeEventListener("click", start);
			window.removeEventListener("touchstart", start);
			window.removeEventListener("keydown", start);
			stopRef.current?.();
		};
	}, []);

	return null;
}
