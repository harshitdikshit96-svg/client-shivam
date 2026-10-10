"use client";
import { useState } from "react";
import { useCust } from "./Cust";
import { Label, Tools, useDrag } from "./Edit";
import { MENU } from "@/lib/schema";
import { ordered, menuContainer, menuGroupContainer, menuGroupId, menuItemId } from "@/lib/resolve";

export default function Sidebar({ screen, go }) {
  const c = useCust();
  const groups = ordered(c.ov, menuContainer(), MENU);
  const siblings = groups.map((g) => g.id);
  const activeGroup = MENU.find((g) => g.items?.some((i) => i.screen === screen))?.id;
  const [open, setOpen] = useState(() => new Set(activeGroup ? [activeGroup] : []));
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <nav className="sidebar" aria-label="Main menu">
      <div className="menu">
        {groups
          .filter((g) => c.customizing || !c.hidden(menuGroupId(g.id)))
          .map((g) => (
            <Group key={g.id} g={g} siblings={siblings} screen={screen} go={go} open={open.has(g.id) || c.customizing} toggle={() => toggle(g.id)} />
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
  const head = (
    <div className={`menu-head ${g.items ? "group" : "plain"} ${g.screen === screen ? "active" : ""}`}
      onClick={() => (g.items ? toggle() : g.screen && go(g.screen))}>
      <Label id={id} def={g.label} />
      {g.items && <span className={`chev ${open ? "up" : ""}`} aria-hidden>⌄</span>}
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

function SubItem({ g, i, siblings, container, screen, go }) {
  const c = useCust();
  const id = menuItemId(g.id, i.id);
  const drag = useDrag({ container, siblings, localId: i.id });
  return (
    <div className={`sub ${i.screen === screen ? "active" : ""} ${c.hidden(id) ? "is-hidden" : ""} ${drag.over ? "drop" : ""}`} {...drag.props}
      onClick={(e) => { e.stopPropagation(); go(i.screen); }}>
      <Label id={id} def={i.label} />
      <Tools id={id} def={i.label} item={i} container={container} siblings={siblings} localId={i.id} axis="y" />
    </div>
  );
}
