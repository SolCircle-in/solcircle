"use client";

import { useEffect, useRef } from "react";

export default function BgMusic({ src = "/ambient.mp3", volume = 0.1 }: { src?: string; volume?: number }) {
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReduced) return;

		const audio = new Audio(src);
		audio.loop = true;
		audio.preload = "auto";
		audio.volume = Math.min(Math.max(volume, 0), 1);
		audioRef.current = audio;

		const start = () => {
			audio.play().catch(() => {});
			window.removeEventListener("click", start);
			window.removeEventListener("touchstart", start);
			window.removeEventListener("keydown", start);
		};

		window.addEventListener("click", start);
		window.addEventListener("touchstart", start);
		window.addEventListener("keydown", start);

		return () => {
			window.removeEventListener("click", start);
			window.removeEventListener("touchstart", start);
			window.removeEventListener("keydown", start);
			try { audio.pause(); } catch {}
			audioRef.current = null;
		};
	}, [src, volume]);

	return null;
}
