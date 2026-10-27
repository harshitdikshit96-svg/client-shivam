"use client";
import { useEffect, useState } from "react";
import { useCust } from "./Cust";
import { Label, Tools, useDrag } from "./Edit";
import { MENU } from "@/lib/schema";
import { ordered, menuContainer, menuGroupContainer, menuGroupId, menuItemId } from "@/lib/resolve";

export default function Sidebar({ screen, go }) {
  const c = useCust();
  const groups = ordered(c.ov, menuContainer(), MENU);
  const siblings = groups.map((g) => g.id);
  const activeGroup = MENU.find((g) => g.items?.some((i) => i.screen === screen))?.id;
  // accordion: at most one group open; opening one closes the others
  const [open, setOpen] = useState(activeGroup || null);
  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));
  // follow navigation from outside the menu (screen picker, in-page links, back/forward)
  useEffect(() => {
    if (activeGroup) setOpen(activeGroup);
  }, [activeGroup]);

  return (
    <nav className="sidebar" aria-label="Main menu">
      <div className="menu">
        {groups
          .filter((g) => c.customizing || !c.hidden(menuGroupId(g.id)))
          .map((g) => (
            <Group key={g.id} g={g} siblings={siblings} screen={screen} go={go} open={open === g.id} toggle={() => toggle(g.id)} />
          ))}
      </div>
    </nav>
  );
}

function Group({ g, siblings, screen, go, open, toggle }) {
  const c = useCust();
  const id = menuGroupId(g.id);
  const drag = useDrag({ container: menuContainer(), siblings, localId: g.id });
  const hidden = c.hidden(id);
  const activate = () => (g.items ? toggle() : go(g.screen ?? g.id)); // Logout has no screen: App explains it
  const head = (
    <div className={`menu-head ${g.items ? "group" : "plain"} ${g.screen === screen ? "active" : ""}`}
      role="button" tabIndex={0} aria-expanded={g.items ? open : undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        activate();
      }}>
      <Label id={id} def={g.label} />
      {g.items && <Chevron up={open} />}
    </div>
  );
  if (!g.items) {
    return (
      <div className={`menu-group ${hidden ? "is-hidden" : ""} ${drag.over ? "drop" : ""}`} {...drag.props}>
        {head}
        <Tools id={id} def={g.label} item={g} container={menuContainer()} siblings={siblings} localId={g.id} axis="y" />
      </div>
    );
  }
  const container = menuGroupContainer(g.id);
  const items = ordered(c.ov, container, g.items);
  const isib = items.map((i) => i.id);
  return (
    <div className={`menu-group ${hidden ? "is-hidden" : ""} ${drag.over ? "drop" : ""}`} {...drag.props}>
      {head}
      <Tools id={id} def={g.label} item={g} container={menuContainer()} siblings={siblings} localId={g.id} axis="y" />
      {open && (
        <div className="submenu">
          {items
            .filter((i) => c.customizing || !c.hidden(menuItemId(g.id, i.id)))
            .map((i) => <SubItem key={i.id} g={g} i={i} siblings={isib} container={container} screen={screen} go={go} />)}
        </div>
      )}
    </div>
  );
}

const Chevron = ({ up }) => (
  <svg className={`chev ${up ? "up" : ""}`} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function SubItem({ g, i, siblings, container, screen, go }) {
  const c = useCust();
  const id = menuItemId(g.id, i.id);
  const drag = useDrag({ container, siblings, localId: i.id });
  return (
    <div className={`sub ${i.screen === screen ? "active" : ""} ${c.hidden(id) ? "is-hidden" : ""} ${drag.over ? "drop" : ""}`} {...drag.props}
      role="link" tabIndex={0} aria-current={i.screen === screen ? "page" : undefined}
      onClick={(e) => { e.stopPropagation(); go(i.screen); }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.key !== "Enter") return;
        e.stopPropagation();
        go(i.screen);
      }}>
      <Label id={id} def={i.label} />
      <Tools id={id} def={i.label} item={i} container={container} siblings={siblings} localId={i.id} axis="y" />
    </div>
  );
}
