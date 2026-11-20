"use client";
// Website header: brand, page links, Login (→ the portal at /admin). Below 1100px the same links move into a menu.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { Brand } from "./parts";
import { NAV } from "@/lib/site";

const isOn = (path, href) => (href === "/" ? path === "/" : path === href || path?.startsWith(`${href}/`));

export default function SiteHeader() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [path]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <header className={`hp-hdr ${scrolled ? "hp-scrolled" : ""}`}>
      <div className="hp-wrap hp-hdr-in">
        <Brand />
        <nav className="hp-nav" aria-label="Primary">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={isOn(path, href) ? "page" : undefined}>{label}</Link>
          ))}
          <a href="/admin" className="hp-btn hp-btn-navy">Login</a>
        </nav>
        <button className="hp-burger" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="hp-menu" onClick={() => setMenuOpen((o) => !o)}>
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>
      <nav id="hp-menu" className={`hp-menu ${menuOpen ? "hp-open" : ""}`} aria-label="Menu" onClick={(e) => { if (e.target.closest("a")) setMenuOpen(false); }}>
        {NAV.map(([href, label]) => (
          <Link key={href} className="hp-item" href={href} aria-current={isOn(path, href) ? "page" : undefined}>{label}</Link>
        ))}
        <a href="/admin" className="hp-btn hp-btn-navy">Login</a>
      </nav>
    </header>
  );
}
