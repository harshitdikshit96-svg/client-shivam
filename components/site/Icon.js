// Line icons for the public website (24×24, stroked).
const ICONS = {
  arrowUp: "M7 17L17 7M8 7h9v9",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z",
  shieldCheck: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4",
  briefcase: "M3 7h18v13H3zM9 7V5h6v2M3 13h18",
  target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  people: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6",
  growth: "M3 17l6-6 4 4 8-8M15 7h6v6",
  building: "M4 21V8l8-5 8 5v13M2 21h20M9 21v-5h6v5",
  heartPulse: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM8 11h2l1-2 2 4 1-2h2",
  leaf: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7",
  bag: "M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2",
  truck: "M2 6h12v10H2zM14 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  government: "M3 21h18M4 10h16M12 3l8 5H4l8-5zM6 10v8M10 10v8M14 10v8M18 10v8",
  office: "M5 3h14v18H5zM9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3",
  factory: "M3 21V11l6 3v-3l6 3V7l6 3v11H3z",
};
export default function Icon({ name, className = "hp-ic" }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}
