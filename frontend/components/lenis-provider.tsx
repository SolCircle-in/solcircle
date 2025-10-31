"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export default function LenisProvider({ children }: { children: React.ReactNode }) {
	const rafRef = useRef<number | null>(null);
	const lenisRef = useRef<Lenis | null>(null);

	useEffect(() => {
		// Respect user's reduced motion preference
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReducedMotion) return;

		const lenis = new Lenis({
			smoothWheel: true,
			duration: 0.6,  // Much faster for more responsive scroll
			wheelMultiplier: 1,  // Normal wheel scroll speed
			easing: (x: number) => x  // Linear easing - no acceleration
		});
		lenisRef.current = lenis;

		const raf = (time: number) => {
			lenis.raf(time);
			rafRef.current = requestAnimationFrame(raf);
		};
		rafRef.current = requestAnimationFrame(raf);

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			lenis.destroy();
		};
	}, []);

	return children as React.ReactElement;
}
