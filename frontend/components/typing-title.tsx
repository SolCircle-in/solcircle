"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TypingTitleProps = {
	className?: string;
	words?: string[];
	typeMs?: number;
	deleteMs?: number;
	pauseMs?: number;
};

export default function TypingTitle({
	className,
	words = ["Vote", "Invest", "Win"],
	typeMs = 260,
	deleteMs = 200,
	pauseMs = 1500,
}: TypingTitleProps) {
	const [text, setText] = useState("");
	const [index, setIndex] = useState(0);
	const [deleting, setDeleting] = useState(false);
	const [reduced, setReduced] = useState(false);
	const timerRef = useRef<number | null>(null);
	const textRef = useRef("");

	const current = useMemo(() => words[index % words.length], [index, words]);
	const maxLen = useMemo(() => Math.max(...words.map((w) => w.length)) + 1 /* cursor */ , [words]);

	useEffect(() => {
		textRef.current = text;
	}, [text]);

	// Detect reduced motion once
	useEffect(() => {
		setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
	}, []);

	useEffect(() => {
		const clearTimer = () => {
			if (timerRef.current) window.clearTimeout(timerRef.current);
			timerRef.current = null;
		};

		clearTimer();

		if (reduced) {
			// No typing animation: instantly show the word, but still rotate every pauseMs
			setText(current);
			textRef.current = current;
			timerRef.current = window.setTimeout(() => {
				setIndex((i) => (i + 1) % words.length);
			}, pauseMs);
			return () => clearTimer();
		}

		const step = () => {
			const currentText = textRef.current;
			if (!deleting) {
				const nextLen = Math.min(current.length, currentText.length + 1);
				const next = current.slice(0, nextLen);
				setText(next);
				textRef.current = next;
				if (nextLen === current.length) {
					timerRef.current = window.setTimeout(() => setDeleting(true), pauseMs);
					return;
				}
				timerRef.current = window.setTimeout(step, typeMs);
			} else {
				const nextLen = Math.max(0, currentText.length - 1);
				const next = current.slice(0, nextLen);
				setText(next);
				textRef.current = next;
				if (nextLen === 0) {
					setDeleting(false);
					setIndex((i) => (i + 1) % words.length);
					timerRef.current = window.setTimeout(step, typeMs);
					return;
				}
				timerRef.current = window.setTimeout(step, deleteMs);
			}
		};

		// kick off without re-creating on every keystroke
		timerRef.current = window.setTimeout(step, typeMs);
		return () => clearTimer();
	}, [current, deleting, deleteMs, pauseMs, reduced, typeMs, words.length]);

	return (
		<span className={className}>
			<span style={{ display: "inline-block", minWidth: `${maxLen}ch`, textAlign: "center" }}>
				{text}
				<span className="typing-cursor">_</span>
			</span>
		</span>
	);
}
