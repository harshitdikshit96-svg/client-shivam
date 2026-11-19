"use client";
// Home hero: full-width photos that fade into each other every few seconds, with the hero text on top.
// Pauses while hovered or focused, on the pause button, and (no autoplay) for people who ask for reduced motion.
import { useEffect, useRef, useState } from "react";
import { HERO_SLIDES } from "@/lib/site";

const EVERY = 3500;
const src = (name, w) => `/home/slide-${name}-${w}.webp`;
const two = (n) => String(n).padStart(2, "0");

export default function HeroCarousel({ children }) {
  const [at, setAt] = useState(0);
  const [stopped, setStopped] = useState(false); // the pause button, or reduced motion
  const [held, setHeld] = useState(false); // hover / keyboard focus inside the hero
  const touch = useRef(null);
  const n = HERO_SLIDES.length;
  const go = (k) => setAt(((k % n) + n) % n);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setStopped(true);
  }, []);
  useEffect(() => {
    if (stopped || held) return undefined;
    const t = setTimeout(() => go(at + 1), EVERY);
    return () => clearTimeout(t);
  }, [at, stopped, held]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      className="hp-hero"
      aria-roledescription="carousel"
      aria-label="Our business verticals"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      <div className="hp-slides">
        {HERO_SLIDES.map((s, k) => (
          <img
            key={s.name}
            className={k === at ? "hp-on" : undefined}
            src={src(s.name, 1920)}
            srcSet={`${src(s.name, 960)} 960w, ${src(s.name, 1920)} 1920w`}
            sizes="100vw"
            alt={s.alt}
            aria-hidden={k === at ? undefined : true}
            width="1920"
            height="1280"
            fetchPriority={k === 0 ? "high" : undefined}
            decoding="async"
          />
        ))}
      </div>
      <div className="hp-hero-shade" aria-hidden="true" />
      <div className="hp-wrap hp-hero-in">{children}</div>
      <div className="hp-wrap hp-hero-bar">
        <p className="hp-slide-label" aria-live={stopped || held ? "polite" : "off"}>
          <span className="hp-slide-no">{two(at + 1)} / {two(n)}</span>{HERO_SLIDES[at].label}
        </p>
        <div className="hp-dots">
          {HERO_SLIDES.map((s, k) => (
            <button key={s.name} type="button" className="hp-dot" aria-label={`Show slide ${k + 1}: ${s.label}`} aria-current={k === at ? "true" : undefined} onClick={() => go(k)} />
          ))}
          <button type="button" className="hp-play" aria-label={stopped ? "Play slideshow" : "Pause slideshow"} onClick={() => setStopped((v) => !v)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{stopped ? <path d="M8 5v14l11-7z" /> : <path d="M8 5h3v14H8zM13 5h3v14h-3z" />}</svg>
          </button>
        </div>
      </div>
    </section>
  );
}
