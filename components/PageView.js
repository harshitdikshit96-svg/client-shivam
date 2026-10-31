"use client";
// One renderer for every screen: dashboards, tables, forms, filters, buttons.
// The layout comes from lib/schema.js. With live data (final mode) components/screens.js fills it and wires every
// button; without it (prototype field-selection tool, spec tests) the screen shows its empty layout.
import { useCust } from "./Cust";
import { Label, Tools, useDrag } from "./Edit";
import { ordered, screenContainer, blockContainer, blockId, itemId, screenTitleId } from "@/lib/resolve";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SCREEN_BY_ID, WAGE_DEFAULTS, SKILL_CATEGORIES, ACCOMMODATION } from "@/lib/schema";
import { computeWageLine } from "@/lib/wages";
import { isLockedAfterCreate } from "@/lib/rules";
import { districtsOf } from "@/lib/districts";
import { billTotals } from "@/lib/bill";
import { sanitize, checkValue, inputProps, FORMATS } from "@/lib/validate";
import { useData, fmtDate, fmtMoney, MONTHS as MONTH_LABELS } from "./Data";
import { CONTROLLERS, WAGE_INPUTS, WAGE_OUTPUTS, wageRows, wageSelection, gridValues, setGridValue, previewLine, printDoc, engageWoId } from "./screens";
import { PrintOverlay, FormD, WageSlip } from "./Forms";

// ctx for the live screen (null without live data)
const PageCtx = createContext(null);
const usePage = () => useContext(PageCtx);

const MONEY_COLS = new Set(["taxable", "tax", "gst", "total", "received", "deduction", "gross", "totalDed", "net", "basic", "vda", "basicPay", "ot", "ug", "bonus", "edlis", "pli", "otherEarn", "epf", "cmps", "esi", "fine", "otherDed", "damage"]);
const fmtValue = (id, v) => (v == null || v === "" ? null : typeof v === "number" && MONEY_COLS.has(id) ? fmtMoney(v) : fmtDate(v));

/** Params for the screen a row button opens. */
function rowParams(row, to) {
  if (to === "wm_edit" || to === "wm_view") return { wm: row.workmanId ?? row.id };
  if (to === "wage_entry") return { wo: row.workOrderId ?? row.id, ...(row.year ? { y: row.year, m: row.month } : {}) };
  if (to === "wage_slip") return { wuin: row.wuin, sheet: row.sheetId };
  if (to === "dispatch_register") return { bill: row.billId ?? row.id };
  return { wo: row.workOrderId ?? row.id };
}

export default function PageView({ screen, go, params = {} }) {
  const live = useData();
  if (live && !live.data) return <div className="center-msg">{live.error ?? "Loading…"}</div>;
  if (!live) return <PageBody screen={screen} go={go} />;
  return <LivePage screen={screen} go={go} params={params} live={live} />;
}

function LivePage({ screen, go, params, live }) {
  const ctrl = CONTROLLERS[screen.id] ?? {};
  const [values, setValuesState] = useState(ctrl.load ? null : {});
  const [errors, setErrors] = useState({});
  const [local, setLocalState] = useState({});
  const top = useRef(null);
  const setLocal = useCallback((patch) => setLocalState((l) => ({ ...l, ...patch })), []);
  const closePrint = useCallback(() => setLocalState((l) => ({ ...l, print: null })), []);
  const setValues = useCallback((patch) => setValuesState((v) => {
    const next = { ...(v ?? {}) };
    for (const [k, val] of Object.entries(patch)) next[k] = val && typeof val === "object" && !Array.isArray(val) ? { ...val } : val;
    return next;
  }), []);
  const setValue = useCallback((block, item, v) => {
    setValuesState((all) => ({ ...(all ?? {}), [block]: { ...(all?.[block] ?? {}), [item]: v } }));
    setErrors((e) => {
      if (!e[`${block}.${item}`]) return e;
      const { [`${block}.${item}`]: _, ...rest } = e;
      return rest;
    });
  }, []);

  const setError = useCallback((key, msg) => setErrors((e) => {
    if (!msg) { if (!e[key]) return e; const { [key]: _, ...rest } = e; return rest; }
    return e[key] === msg ? e : { ...e, [key]: msg };
  }), []);
  const ctx = {
    live, d: live.data, params, go, screenId: screen.id, ctrl,
    values: values ?? {}, setValue, setValues, errors, setError, local, setLocal,
    scrollTo: (block) => document.getElementById(`block-${block}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
  };
  /** Wrap a button handler: show the outcome, highlight wrong fields, never fail silently. */
  ctx.act = (fn) => async () => {
    if (!fn) return live.notify("info", "This action is not available yet.");
    try {
      setErrors({});
      await fn();
    } catch (e) {
      // a bug in the screen's code (not a refusal from the server): a plain message for the user, the details in the console
      if (e instanceof TypeError || e instanceof ReferenceError) {
        console.error("[action failed]", e);
        live.notify("error", "Something went wrong on this screen and nothing was changed. Reload the page and try again; if it happens again, tell your administrator.");
      } else {
        setErrors(e.fields ?? {});
        live.fail(e);
      }
    }
    top.current?.scrollIntoView?.({ block: "nearest" });
  };

  useEffect(() => {
    if (!ctrl.load) return;
    let alive = true;
    Promise.resolve(ctrl.load(ctx))
      .then((v) => alive && setValuesState(v ?? {}))
      .catch((e) => { if (alive) { setValuesState({}); live.fail(e); } });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guide = ctrl.guide?.(ctx);
  const scope = ctrl.scope?.(ctx);
  const printing = values != null && !guide?.stop ? printDoc(ctx) : null;
  return (
    <PageCtx.Provider value={ctx}>
      {printing && (
        <PrintOverlay title={printing.title} landscape={printing.kind === "formD"} numbered={printing.kind === "formD"}
          footer={printing.kind === "formD" ? printing.doc.footer : null} onClose={closePrint}>
          {printing.kind === "formD" ? <FormD doc={printing.doc} /> : <WageSlip doc={printing.doc} />}
        </PrintOverlay>
      )}
      <div ref={top} />
      <Notice />
      {guide && <Guide g={guide} />}
      {guide?.stop ? (
        <h1 className="page-title">{ctrl.title?.(ctx) ?? screen.title}</h1>
      ) : values == null ? (
        <div className="center-msg">Loading…</div>
      ) : (
        <PageBody screen={screen} go={go} scope={scope} />
      )}
    </PageCtx.Provider>
  );
}

/** The message bar: result of the last action, with the next step as a button. */
function Notice() {
  const ctx = usePage();
  const n = ctx.live.notice;
  if (!n) return null;
  return (
    <div className={`notice notice-${n.type}`} role={n.type === "error" ? "alert" : "status"}>
      <span>{n.text}</span>
      {n.fields && Object.keys(n.fields).length > 0 && n.type === "error" && !Object.keys(n.fields).some((k) => k.startsWith("row.")) && (
        <span className="notice-sub">{Object.keys(n.fields).length} field{Object.keys(n.fields).length === 1 ? "" : "s"} marked in red below.</span>
      )}
      <span className="notice-actions">
        {n.fix && <FixButton fix={n.fix} />}
        <button className="link-btn" onClick={() => ctx.live.notify(null)} aria-label="Dismiss message">Dismiss</button>
      </span>
    </div>
  );
}

function FixButton({ fix, small }) {
  const ctx = usePage();
  const onClick = () => {
    if (fix.period) { ctx.live.setPeriod(fix.period); return ctx.live.notify(null); }
    ctx.go(fix.to, fix.params ?? {});
  };
  return <button className={`btn btn-primary ${small ? "btn-sm" : "btn-sm"}`} onClick={onClick}>{fix.label}</button>;
}

/** What is missing before this screen can be used, and the button that sorts it out. */
function Guide({ g, inline }) {
  return (
    <div className={inline ? "guide-inline" : "guide"} role={inline ? undefined : "note"}>
      <span>{g.text}</span>
      {g.fix && <FixButton fix={g.fix} />}
    </div>
  );
}

function PageBody({ screen, go, scope }) {
  const c = useCust();
  const ctx = usePage();
  const blocks = ordered(c.ov, screenContainer(screen.id), screen.blocks);
  const siblings = blocks.map((b) => b.id);
  const visible = blocks.filter((b) => (c.customizing || !c.hidden(blockId(screen.id, b.id))) && !ctx?.ctrl.hideBlock?.(b.id, ctx));
  const halves = [];
  const rows = [];
  // group consecutive half-width blocks side by side
  for (const b of visible) {
    if (b.half) halves.push(b);
    else {
      if (halves.length) rows.push({ halves: halves.splice(0) });
      rows.push({ block: b });
    }
  }
  if (halves.length) rows.push({ halves: halves.splice(0) });

  const render = (b) => (
    <BlockShell key={b.id} screen={screen} block={b} siblings={siblings} go={go} />
  );
  const title = ctx?.ctrl.title?.(ctx) ?? screen.title;

  return (
    <div className="page">
      <h1 className="page-title">
        <Label id={screenTitleId(screen.id)} def={title} />
        <Tools id={screenTitleId(screen.id)} def={screen.title} noHide noMove />
      </h1>
      {scope && <p className="scope">{scope}</p>}
      {rows.map((r, i) =>
        r.block ? render(r.block) : <div className="half-row" key={`h${i}`}>{r.halves.map(render)}</div>
      )}
    </div>
  );
}

function BlockShell({ screen, block, siblings, go }) {
  const c = useCust();
  const ctx = usePage();
  const id = blockId(screen.id, block.id);
  const container = screenContainer(screen.id);
  const hidden = c.hidden(id);
  const drag = useDrag({ container, siblings, localId: block.id });
  const Comp = BLOCKS[block.type];
  if (ctx && block.type === "checklist" && !ctx.ctrl.steps?.(ctx)) return null;
  if (ctx && block.type === "banner" && ctx.ctrl.banner && !ctx.ctrl.banner(block.id, ctx)) return null;
  if (!ctx && block.type === "checklist") return null;
  return (
    <section
      id={`block-${block.id}`}
      className={`block block-${block.type} ${c.customizing ? "cz" : ""} ${hidden ? "is-hidden" : ""} ${drag.over ? "drop" : ""} ${block.half ? "half" : ""}`}
      {...drag.props}
    >
      {c.customizing && (
        <div className="block-tag">
          <span className="grip" aria-hidden>⋮⋮</span>
          <span className="block-kind">{KIND[block.type]}:</span>
          <Label id={id} def={block.title} />
          <Tools id={id} def={block.title} container={container} siblings={siblings} localId={block.id} axis="y" />
        </div>
      )}
      {hidden ? <div className="hidden-note">Hidden section — will not appear in the final system.</div> : <Comp screen={screen} block={block} go={go} />}
    </section>
  );
}

const KIND = { rates: "Rate table", stats: "Cards", card: "Panel", table: "Table", form: "Form section", kv: "Details", filter: "Filter", buttons: "Buttons", notes: "Notes", banner: "Banner", checklist: "Checklist" };

// Iterates a block's items in the client's order, with per-item tools and drag.
function useItems(screen, block) {
  const c = useCust();
  const ctx = usePage();
  const container = blockContainer(screen.id, block.id);
  const items = ordered(c.ov, container, block.items);
  const siblings = items.map((x) => x.id);
  const list = items
    .map((it) => ({ it, id: itemId(screen.id, block.id, it.id) }))
    .filter(({ id }) => c.customizing || !c.hidden(id))
    .filter(({ it }) => !ctx?.ctrl.hideItem?.(block.id, it.id, ctx));
  return { list, siblings, container };
}

function Item({ as: Tag = "div", className = "", id, it, siblings, container, axis = "x", children, ...rest }) {
  const c = useCust();
  const drag = useDrag({ container, siblings, localId: it.id });
  const hidden = c.hidden(id);
  return (
    <Tag className={`${className} ${hidden ? "is-hidden" : ""} ${drag.over ? "drop" : ""} ${c.customizing ? "cz-item" : ""}`} {...drag.props} {...rest}>
      {children}
      <Tools id={id} def={it.label} item={it} container={container} siblings={siblings} localId={it.id} axis={axis} />
    </Tag>
  );
}

// Visible block title (rename via the block tag in customize mode)
function BlockTitle({ screen, block, as: Tag = "h2", className = "block-title" }) {
  return <Label still as={Tag} className={className} id={blockId(screen.id, block.id)} def={block.title} />;
}

function Stats({ screen, block }) {
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="stats">
      {list.map(({ it, id }) => {
        const s = ctx?.ctrl.stat?.(it.id, ctx);
        return (
          <Item key={it.id} className={`stat ${s ? "clickable" : ""}`} id={id} it={it} siblings={siblings} container={container}
            {...(s ? { role: "button", tabIndex: 0, onClick: s.onClick, onKeyDown: (e) => e.key === "Enter" && s.onClick() } : {})}>
            <Label id={id} def={it.label} className="stat-label" />
            <div className="stat-value">{s?.value ?? 0}</div>
          </Item>
        );
      })}
    </div>
  );
}

// Home: steps to set a firm up, ticked as they are done
function Checklist({ screen, block }) {
  const ctx = usePage();
  const done = ctx.ctrl.steps(ctx);
  const next = block.items.find((it) => !done[it.id]);
  return (
    <div className="card tone-info">
      <div className="card-head"><BlockTitle screen={screen} block={block} as="span" className="" /></div>
      <ol className="checklist">
        {block.items.map((it) => (
          <li key={it.id} className={done[it.id] ? "done" : it === next ? "next" : ""}>
            <span className="tick" aria-hidden>{done[it.id] ? "✓" : "○"}</span>
            <span>{it.label}</span>
            {!done[it.id] && <button className={`btn btn-sm ${it === next ? "btn-primary" : "btn-light"}`} onClick={() => ctx.go(it.to)}>{it === next ? "Do this next" : "Open"}</button>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Card({ screen, block }) {
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  const dynamic = ctx?.ctrl.items?.(block.id, ctx);
  return (
    <div className={`card tone-${block.tone || "grey"}`}>
      <div className="card-head"><BlockTitle screen={screen} block={block} as="span" className="" /></div>
      <ul className="card-body">
        {dynamic ? dynamic.map((x, i) => (
          <li key={i}><button className="link-btn plain" onClick={x.onClick}>{x.text}</button></li>
        )) : list.map(({ it, id }) => (
          <Item as="li" key={it.id} id={id} it={it} siblings={siblings} container={container} axis="y">
            <Label id={id} def={it.label} />
          </Item>
        ))}
      </ul>
    </div>
  );
}

function Table({ screen, block, go }) {
  const c = useCust();
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  const rows = ctx ? ctx.ctrl.rows?.(block.id, ctx) ?? null : null;
  const live = ctx && block.live === "wages";
  const links = block.items.filter((x) => x.to && !c.hidden(itemId(screen.id, block.id, x.id)));
  const showTitle = block.note || (ctx && rows && screen.blocks.filter((b) => b.type === "table").length > 1);
  return (
    <div className="table-wrap">
      {showTitle && <BlockTitle screen={screen} block={block} as="h3" />}
      {block.note && <p className="small-note">{block.note}</p>}
      {ctx?.ctrl.bulk && ctx.local.bulk && <BulkAccommodation rows={rows ?? []} />}
      <div className="table-scroll">
        <table className="tbl">
          <thead>
            <tr>
              {list.map(({ it, id }) => (
                <Item as="th" key={it.id} id={id} it={it} siblings={siblings} container={container} {...(ctx && MONEY_COLS.has(it.id) && block.live !== "wages" ? { style: { textAlign: "right" } } : {})}>
                  <Label id={id} def={it.label} />
                  {it.auto ? <span className="calc-tag auto" title={`Calculated automatically: ${it.calc}`}>auto</span> : it.calc ? <span className="calc-tag" title={it.calc}>calc</span> : null}
                </Item>
              ))}
            </tr>
          </thead>
          <tbody>
            {live ? <WageGrid list={list} />
              : rows ? (
                rows.length ? rows.map((r, i) => <DataRow key={r.id ?? r.workmanId ?? i} row={r} index={i} list={list} block={block} />)
                  : <tr><td colSpan={Math.max(1, list.length)} className="empty"><Guide inline g={ctx.ctrl.empty?.(block.id, ctx) ?? { text: "no records found" }} /></td></tr>
              ) : <>
                <tr>
                  <td colSpan={Math.max(1, list.length)} className="empty">
                    no records found
                    {links.length > 0 && (
                      <span className="sample-links">
                        {links.map((l) => (
                          <button key={l.id} className="link-btn" onClick={() => go(l.to)}>
                            Open “{c.label(`${l.to}.title`, SCREEN_BY_ID[l.to].title)}” screen →
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
                {block.live === "wages" ? (
                  <LiveWageRow list={list} />
                ) : block.items.some((x) => x.input || x.auto) && (
                  <tr className="example-row" title="Example row: shows what is typed in and what is calculated. Not real data.">
                    {list.map(({ it, id }) => (
                      <td key={it.id} className={c.hidden(id) ? "is-hidden" : ""}>
                        {it.auto ? <span className="auto-cell">auto</span>
                          : it.input === "number" ? <input type="number" min="0" placeholder="0" />
                          : it.input === "select" ? <select defaultValue="">{[<option key="" value="" />, ...(it.options || []).map((o) => <option key={o}>{o}</option>)]}</select>
                          : it.kind === "action" ? <button className="btn btn-primary btn-sm" disabled>{c.label(id, it.btn || it.label)}</button>
                          : <span className="muted">—</span>}
                      </td>
                    ))}
                  </tr>
                )}
              </>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A link to the record a cell refers to (work order or workman), unless we are already on that record's page. */
function linkFor(colId, row, ctx) {
  if ((colId === "woNo" && row.workOrderId) || (colId === "engagedIn" && row.engagedWoId)) {
    const wo = colId === "woNo" ? row.workOrderId : row.engagedWoId;
    if (ctx.screenId === "wo_view" && Number(ctx.params.wo) === wo) return null;
    return { to: "wo_view", params: { wo }, title: "Open this work order" };
  }
  if (["wuin", "name", "fullName"].includes(colId) && row.workmanId) {
    if (ctx.screenId === "wm_view" && Number(ctx.params.wm) === row.workmanId) return null;
    return { to: "wm_view", params: { wm: row.workmanId }, title: "Open this workman" };
  }
  return null;
}

// One real record in a table: values by column id; action buttons do their job for this record.
function DataRow({ row, index, list, block }) {
  const c = useCust();
  const ctx = usePage();
  const engage = ctx.screenId === "wm_engage";
  const rowError = engage ? ctx.local.rowErrors?.[row.id] : null;
  return (
    <>
      <tr className={`${row.current ? "current-row" : ""} ${rowError ? "row-error" : ""}`}>
        {list.map(({ it, id }) => {
          const hidden = c.hidden(id) ? "is-hidden" : "";
          if (it.kind === "action") {
            if (ctx.ctrl.hideCell?.(block.id, it.id, row)) return <td key={it.id} className={hidden}><span className="muted">—</span></td>;
            const handler = ctx.ctrl.row?.(block.id, it.id, row, ctx)
              ?? (it.to ? () => ctx.go(it.to, rowParams(row, it.to)) : it.upload ? () => ctx.live.notify("info", "Uploading documents is not part of this version yet.") : null);
            const label = ctx.ctrl.label?.(block.id, it.id, ctx, row) ?? c.label(id, it.btn || it.label);
            return <td key={it.id} className={hidden}><button className={`btn btn-sm ${it.upload ? "btn-light" : it.danger ? "btn-outline-danger" : "btn-primary"}`} disabled={ctx.live.busy} onClick={ctx.act(handler)}>{label}</button></td>;
          }
          if (it.id === "sl") return <td key={it.id} className={hidden}>{index + 1}</td>;
          if (engage && it.id === "select") return <td key={it.id} className={hidden}><EngageTick row={row} /></td>;
          if (engage && it.id === "newFrom") return <td key={it.id} className={hidden}><EngageFrom row={row} /></td>;
          const shown = fmtValue(it.id, row[it.id]);
          const link = shown != null && linkFor(it.id, row, ctx);
          return (
            <td key={it.id} className={`${MONEY_COLS.has(it.id) ? "num" : ""} ${hidden}`}>
              {shown == null ? "—" : link ? <button className="link-btn" title={link.title} onClick={() => ctx.go(link.to, link.params)}>{shown}</button> : shown}
            </td>
          );
        })}
      </tr>
      {rowError && <tr className="row-error-msg"><td colSpan={list.length} role="alert">{rowError}</td></tr>}
    </>
  );
}

// Engage Workmen: tick + date per row
const engagedHere = (row, ctx) => {
  const wo = engageWoId(ctx);
  return wo != null && row.currentWoId === wo;
};
function EngageTick({ row }) {
  const ctx = usePage();
  if (engagedHere(row, ctx)) return <span className="pill">Engaged</span>;
  const sel = ctx.local.sel ?? {};
  const checked = !!sel[row.id]?.checked || (!ctx.local.sel && Number(ctx.params.wm) === row.id);
  return (
    <input type="checkbox" aria-label={`Select ${row.wuin}`} checked={checked}
      onChange={(e) => ctx.setLocal({ sel: { ...(ctx.local.sel ?? (ctx.params.wm ? { [ctx.params.wm]: { checked: true } } : {})), [row.id]: { ...sel[row.id], checked: e.target.checked } } })} />
  );
}
function EngageFrom({ row }) {
  const ctx = usePage();
  if (engagedHere(row, ctx)) return <span className="muted">since {fmtDate(row.engagedFrom)}</span>;
  const sel = ctx.local.sel ?? {};
  const wo = ctx.d.workOrders.find((o) => o.id === engageWoId(ctx));
  return (
    <input type="date" aria-label={`New engagement from for ${row.wuin}`} value={sel[row.id]?.from ?? ""} min={[wo?.start, row.doj].filter(Boolean).sort().at(-1)} max={wo?.end}
      onChange={(e) => ctx.setLocal({ sel: { ...sel, [row.id]: { ...sel[row.id], checked: true, from: e.target.value } } })} />
  );
}

// Bulk Accommodation: set one Accommodation value on the ticked workmen
function BulkAccommodation({ rows }) {
  const ctx = usePage();
  const [value, setValue] = useState("");
  const [ticked, setTicked] = useState(() => new Set(rows.map((r) => r.id)));
  const toggle = (id) => setTicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const apply = ctx.act(async () => {
    const r = await ctx.live.run("setAccommodation", { workmanIds: [...ticked], accommodation: value });
    ctx.setLocal({ bulk: false });
    ctx.live.notify("ok", `Accommodation set to "${value}" for ${r.updated} workm${r.updated === 1 ? "an" : "en"}.`);
  });
  return (
    <div className="bulk" role="region" aria-label="Bulk Accommodation">
      <p><b>Bulk Accommodation</b> — every workman record has an Accommodation (where the workman stays: Self, Company Quarter or Contractors' camp). Set it for many workmen at once instead of editing each one.</p>
      <div className="bulk-row">
        <label>Accommodation{" "}
          <select aria-label="Accommodation to set" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="" disabled>— choose —</option>
            {ACCOMMODATION.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <button className="btn btn-primary btn-sm" onClick={apply} disabled={ctx.live.busy}>Apply to {ticked.size} ticked</button>
        <button className="btn btn-light btn-sm" onClick={() => ctx.setLocal({ bulk: false })}>Close</button>
      </div>
      <div className="bulk-list">
        {rows.map((r) => (
          <label key={r.id}><input type="checkbox" checked={ticked.has(r.id)} onChange={() => toggle(r.id)} /> {r.wuin} — {r.fullName} <span className="muted">({r.accommodation})</span></label>
        ))}
      </div>
    </div>
  );
}

// ---------- Wage Entry grid (live) ----------
function WageGrid({ list }) {
  const ctx = usePage();
  const sel = wageSelection(ctx);
  if (!sel.wo || !sel.year) return <tr><td colSpan={list.length} className="empty"><Guide inline g={{ text: "Choose the work order and month above to list its workmen." }} /></td></tr>;
  const rows = wageRows(ctx);
  if (!rows.length) return <tr><td colSpan={list.length} className="empty"><Guide inline g={ctx.ctrl.empty("grid", ctx)} /></td></tr>;
  const editable = !sel.sheet || sel.sheet.status === "draft";
  const typed = gridValues(ctx);
  const totals = { gross: 0, totalDed: 0, net: 0 };
  const body = rows.map((r) => {
    const t = typed[r.workmanId];
    const limit = { month: new Date(Date.UTC(sel.year, sel.month, 0)).getUTCDate(), engaged: r.engaged, when: r.when, label: `${MONTH_LABELS[sel.month - 1]} ${sel.year}` };
    const pv = editable ? previewLine(sel.wo, r.skill, t, limit) : { line: null };
    const shown = editable ? pv.line : null;
    const out = (k) => (shown ? shown[WAGE_OUTPUTS[k]] : !editable && r.saved ? r.saved[k] : null);
    for (const k of Object.keys(totals)) totals[k] += Number(out(k) ?? 0);
    const err = ctx.local.rowErrors?.[r.workmanId] ?? (editable && pv.error ? pv.error : null);
    return (
      <WageRow key={r.workmanId} r={r} list={list} editable={editable} t={t} out={out} err={err} />
    );
  });
  return (
    <>
      {body}
      <tr className="totals-row">
        {list.map(({ it }, i) => (
          <td key={it.id} className={MONEY_COLS.has(it.id) ? "num" : ""}>{i === 0 ? <b>Total</b> : it.id in totals ? <b>{fmtMoney(totals[it.id])}</b> : ""}</td>
        ))}
      </tr>
    </>
  );
}

function WageRow({ r, list, editable, t, out, err }) {
  const ctx = usePage();
  const c = useCust();
  return (
    <>
      <tr className={err ? "row-error" : ""}>
        {list.map(({ it, id }) => {
          const hidden = c.hidden(id) ? "is-hidden" : "";
          if (WAGE_INPUTS[it.id]) {
            if (!editable) return <td key={it.id} className={`num ${hidden}`}>{fmtValue(it.id, r.saved?.[it.id]) ?? "—"}</td>;
            const v = t?.[it.id] ?? "";
            const set = (e) => setGridValue(ctx, r.workmanId, it.id, it.input === "select" ? e.target.value : sanitize(it.id === "otHrs" ? "int" : "money", e.target.value));
            return (
              <td key={it.id} className={hidden}>
                {it.input === "select"
                  ? <select aria-label={`${it.label} ${r.wuin}`} value={v || "0"} onChange={set}>{(it.options || []).map((o) => <option key={o}>{o}</option>)}</select>
                  : <input aria-label={`${it.label} ${r.wuin}`} type="text" inputMode="decimal" maxLength={it.id === "attDays" ? 4 : 10} value={v} placeholder={it.id === "attDays" ? "days" : "0"} onChange={set} />}
              </td>
            );
          }
          if (WAGE_OUTPUTS[it.id]) return <td key={it.id} className={`calc-cell ${hidden}`}>{out(it.id) == null ? "—" : fmtMoney(out(it.id))}</td>;
          if (it.id === "wuin" || it.id === "name") {
            return <td key={it.id} className={hidden}><button className="link-btn" onClick={() => ctx.go("wm_view", { wm: r.workmanId })}>{r[it.id]}</button>{it.id === "name" && <div className="muted small">{r.skill}</div>}</td>;
          }
          if (it.kind === "action") {
            const handler = ctx.ctrl.row?.("grid", it.id, r, ctx);
            return <td key={it.id} className={hidden}><button className="btn btn-primary btn-sm" onClick={ctx.act(handler)}>{c.label(id, it.btn || it.label)}</button></td>;
          }
          return <td key={it.id} className={hidden}>—</td>;
        })}
      </tr>
      {err && <tr className="row-error-msg"><td colSpan={list.length} role="alert">{r.wuin}: {err}</td></tr>}
    </>
  );
}

// ---------- forms ----------
/** Read-only in the spec, or locked by lib/rules.js once the record exists (nothing is, by default). */
const isReadOnly = (it, block, ctx) => !!(it.readOnly || (ctx && (ctx.ctrl.readOnly?.(block.id, it, ctx)
  || (["wm", "wo", "bill", "edit"].some((k) => ctx.params[k]) && isLockedAfterCreate(ctx.screenId, block.id, it.id)))));

function Control({ it, block, live }) {
  const ctx = usePage();
  const ro = isReadOnly(it, block, ctx);
  const dynamic = ctx?.ctrl.options?.(block.id, it.id, ctx);
  const options = dynamic ?? (it.options || []).map((o) => ({ value: o, label: o }));
  if (it.calc && !live) return <input type="text" readOnly className="calc" />;
  if (!live) {
    // static layout (prototype / spec tests)
    switch (it.input) {
      case "select": return <select disabled={ro} defaultValue="">{[<option key="" value="" />, ...options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)]}</select>;
      case "textarea": return <textarea readOnly={ro} rows={2} />;
      case "date": return <input type="date" readOnly={ro} />;
      case "checkbox": return <input type="checkbox" disabled={ro} />;
      case "rate": return <select disabled={ro} defaultValue="">{[<option key="" value="" />, ...(it.options || []).map((o) => <option key={o} value={o}>{o}%</option>), <option key="other" value="other">Other</option>]}</select>;
      case "file": return <input type="file" disabled={ro} />;
      case "password": return <input type="password" autoComplete="off" readOnly={ro} />;
      case "button": return null;
      case "number": return <input type="number" min="0" step="any" readOnly={ro} defaultValue={it.def ?? undefined} />;
      default: return <input type="text" readOnly={ro} />;
    }
  }
  const value = ctx.values?.[block.id]?.[it.id] ?? "";
  const key = `${block.id}.${it.id}`;
  // what can be typed is filtered as you type (e.g. digits only in Aadhaar); the format is checked when leaving the field
  const set = (e) => {
    ctx.setValue(block.id, it.id, it.format ? sanitize(it.format, e.target.value) : e.target.value);
    // a new State clears a District picked from the old State's list (a typed-in district is kept)
    if (it.id === "state") {
      const d = ctx.values?.[block.id]?.district;
      if (d && districtsOf(value).includes(d) && !districtsOf(e.target.value).includes(d)) ctx.setValue(block.id, "district", "");
    }
  };
  const check = (e) => ctx.setError(key, it.format ? checkValue(it.format, e.target.value, { max: it.maxLength }) : null);
  const err = ctx.errors[key];
  const fmt = it.format ? inputProps(it.format) : { maxLength: FORMATS.text.max };
  if (it.maxLength) fmt.maxLength = it.maxLength;
  const common = { "aria-invalid": err ? true : undefined, "aria-label": it.label, onBlur: check };
  // calculated from other fields of the form (e.g. Dispatch Register: tax, GST and total from the rates)
  if (it.calc) {
    const v = billTotals(ctx.values?.[block.id] ?? {})[it.calc];
    return <input type="text" readOnly tabIndex={-1} className="calc" aria-label={it.label} value={fmtMoney(Number(v))} />;
  }
  if (it.input === "rate") return <RateControl it={it} value={value} readOnly={ro} onChange={set} inputProps={{ ...fmt, ...common }} />;
  switch (it.input) {
    case "select":
      return <select disabled={ro} value={value} onChange={set} {...common}>{[<option key="" value="">{dynamic && !options.length ? "— none available —" : "— select —"}</option>, ...options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)]}</select>;
    case "textarea": return <textarea readOnly={ro} rows={2} value={value} onChange={set} {...fmt} {...common} />;
    case "date": return <input type="date" readOnly={ro} value={value} onChange={set} min="1900-01-01" max="2100-12-31" {...common} />;
    case "file":
      return <input type="file" disabled={ro} {...common} onChange={(e) => { e.target.value = ""; ctx.live.notify("info", "Uploading documents is not part of this version yet. The work order is saved without the file."); }} />;
    case "password": return <input type="password" autoComplete="new-password" readOnly={ro} value={value} onChange={set} {...fmt} {...common} />;
    case "button": return null;
    // numbers are typed as text so letters, "e" and minus signs cannot get in; inputMode brings up the number pad
    default:
      if (it.suggestFrom) {
        // a drop-down of suggestions (e.g. the districts of the chosen State) that still takes any typed value
        const list = districtsOf(ctx.values?.[block.id]?.[it.suggestFrom]);
        return <Combo id={`${block.id}-${it.id}`} value={value} options={list} readOnly={ro} onChange={set} inputProps={{ ...fmt, ...common }}
          placeholder={list.length ? it.placeholder : "Choose the State first, or type"} />;
      }
      return <input type="text" readOnly={ro} value={value} onChange={set} {...fmt} {...common} />;
  }
}

/**
 * A percentage picked from a drop-down (0% / 5% / 18% …) or, with "Other", typed in the box that appears.
 * The value is the percentage as text ("18", "12.5"); a value not in the list shows as Other with the box filled.
 */
function RateControl({ it, value, readOnly, onChange, inputProps }) {
  const [other, setOther] = useState(false);
  const v = value == null ? "" : String(value);   // shown exactly as typed ("12." while typing 12.5)
  const listed = v === "" ? null : it.options.find((o) => Number(o) === Number(v));
  const mode = other || (v !== "" && listed == null) ? "other" : (listed ?? "");
  const pick = (e) => {
    const next = e.target.value;
    setOther(next === "other");
    onChange({ target: { value: next === "other" ? "" : next } });
  };
  return (
    <div className="rate">
      <select disabled={readOnly} value={mode} onChange={pick} aria-label={it.label}>
        <option value="">— select —</option>
        {it.options.map((o) => <option key={o} value={o}>{o}%</option>)}
        <option value="other">Other (type the rate)</option>
      </select>
      {mode === "other" && (
        <span className="rate-other">
          <input type="text" readOnly={readOnly} value={v} onChange={onChange} placeholder="e.g. 12 or 2.5" autoFocus={other} {...inputProps}
            aria-label={`${it.label} — other rate`} />
          <span className="muted">%</span>
        </span>
      )}
    </div>
  );
}

/**
 * A text field with a drop-down of suggestions drawn like the app's other controls (a browser <datalist> pop-up
 * cannot be styled). Typing filters the list; any value can still be typed. Keys: ↓ ↑ to move, Enter to pick, Esc to close.
 */
function Combo({ id, value, options, readOnly, onChange, placeholder, inputProps }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [typing, setTyping] = useState(false);   // opened by typing → filter; by click / focus / chevron → whole list
  const listRef = useRef(null);
  const q = value.trim().toLowerCase();
  // names starting with the typed text come first, then names containing it
  const shown = !typing || !q ? options
    : [...options.filter((o) => o.toLowerCase().startsWith(q)), ...options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q))];
  const pick = (o) => { onChange({ target: { value: o } }); setOpen(false); setActive(-1); };
  useEffect(() => {
    if (open && active >= 0) listRef.current?.children[active]?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);
  const onKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); setTyping(false); setActive(Math.max(0, options.indexOf(value))); return; }
      const n = shown.length;
      if (n) setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n));
    } else if (e.key === "Enter" && open && active >= 0 && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };
  const listId = `${id}-list`;
  const expanded = open && !readOnly && shown.length > 0;
  return (
    <div className="combo">
      <input type="text" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off"
        readOnly={readOnly} value={value} placeholder={placeholder} {...inputProps}
        onChange={(e) => { onChange(e); setOpen(true); setTyping(true); setActive(-1); }}
        onFocus={() => { setOpen(true); setTyping(false); }} onClick={() => { if (!open) { setOpen(true); setTyping(false); } }}
        onBlur={(e) => { setOpen(false); inputProps.onBlur?.(e); }} onKeyDown={onKeyDown} />
      {!readOnly && options.length > 0 && (
        <button type="button" className="combo-toggle" tabIndex={-1} aria-label="Show the list"
          onMouseDown={(e) => { e.preventDefault(); const was = open; e.currentTarget.previousSibling.focus(); setOpen(!was); setTyping(false); }} />
      )}
      {expanded && (
        <ul className="combo-list" role="listbox" id={listId} ref={listRef}>
          {shown.map((o, i) => (
            <li key={o} id={`${listId}-${i}`} role="option" aria-selected={o === value}
              className={`${i === active ? "active" : ""} ${o === value ? "picked" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Form({ screen, block }) {
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="form-section">
      <BlockTitle screen={screen} block={block} />
      <div className={`form-grid ${block.single ? "single" : ""}`}>
        {list.map(({ it, id }) => {
          const ro = isReadOnly(it, block, ctx);
          const err = ctx?.errors[`${block.id}.${it.id}`];
          return (
            <Item key={it.id} className={`field ${ro ? "ro" : ""} ${err ? "has-error" : ""}`} id={id} it={it} siblings={siblings} container={container}>
              <label>
                <Label id={id} def={it.label} />
                {it.req && !ro && <span className="req"> *</span>}
                {ro && ctx && <span className="muted small"> (locked after saving)</span>}
                {it.calc && <span className="muted small"> (calculated)</span>}
              </label>
              <Control it={it} block={block} live={!!ctx} />
              {err && <span className="field-error">{err}</span>}
            </Item>
          );
        })}
      </div>
    </div>
  );
}

function KV({ screen, block }) {
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  const rec = ctx?.ctrl.kv?.(block.id, ctx);
  return (
    <div className="kv">
      {ctx && rec === null && block.id === "slip" ? null : list.map(({ it, id }) => (
        <Item key={it.id} className="kv-row" id={id} it={it} siblings={siblings} container={container} axis="y">
          <Label id={id} def={it.label} className="kv-key" />
          <span className="kv-val">{fmtValue(it.id, rec?.[it.id]) ?? "——"}</span>
        </Item>
      ))}
    </div>
  );
}

function Filter({ screen, block }) {
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  const f = ctx?.ctrl.filter;
  return (
    <div className="filter">
      <BlockTitle screen={screen} block={block} as="span" className="filter-title" />
      {list.map(({ it, id }) => {
        const handler = ctx && it.input === "button" ? ctx.ctrl.action?.(block.id, it.id, ctx) : null;
        const value = f?.get(block.id, it.id, ctx);
        const dynamic = ctx?.ctrl.options?.(block.id, it.id, ctx);
        const options = dynamic ?? (it.options || []).map((o) => ({ value: o, label: o }));
        return (
          <Item key={it.id} className="filter-item" id={id} it={it} siblings={siblings} container={container}>
            {it.input === "button" ? (
              <button className="btn btn-outline" onClick={ctx ? ctx.act(handler) : undefined}><Label id={id} def={it.label} /></button>
            ) : (
              <>
                <Label id={id} def={it.label} className="filter-label" />
                {ctx && value !== undefined ? (
                  it.input === "checkbox" ? (
                    <input type="checkbox" aria-label={it.label} checked={!!value} onChange={(e) => f.set(block.id, it.id, e.target.checked, ctx)} />
                  ) : it.input === "select" ? (
                    <select aria-label={it.label} value={value} onChange={(e) => f.set(block.id, it.id, e.target.value, ctx)}>
                      {value === "" && <option value="" disabled>{dynamic && !options.length ? "— none available —" : "— select —"}</option>}
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input aria-label={it.label} value={value} {...(it.format ? inputProps(it.format) : {})} maxLength={it.maxLength ?? inputProps(it.format).maxLength}
                      onChange={(e) => f.set(block.id, it.id, it.format ? sanitize(it.format, e.target.value) : e.target.value, ctx)}
                      onKeyDown={(e) => e.key === "Enter" && handler == null && ctx.act(ctx.ctrl.action?.(block.id, "search", ctx))()} />
                  )
                ) : <Control it={it} block={block} live={false} />}
              </>
            )}
          </Item>
        );
      })}
    </div>
  );
}

function Buttons({ screen, block, go }) {
  const c = useCust();
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  const shown = list.filter(({ it }) => !ctx?.ctrl.hide?.(block.id, it.id, ctx));
  return (
    <div className={`btn-row ${block.align === "right" ? "right" : ""}`}>
      {shown.map(({ it, id }) => {
        const tone = { green: "btn-success", outline: "btn-outline", danger: "btn-outline-danger" }[it.tone] ?? "btn-primary";
        const label = ctx?.ctrl.label?.(block.id, it.id, ctx);
        const onClick = ctx
          ? ctx.act(ctx.ctrl.action?.(block.id, it.id, ctx) ?? (it.to ? () => go(it.to) : null))
          : () => it.to && !c.editing && go(it.to);
        return (
          <Item key={it.id} className={`btn-item ${it.wide ? "wide" : ""}`} id={id} it={it} siblings={siblings} container={container}>
            <button className={`btn ${tone} ${it.wide ? "w100" : ""}`} onClick={onClick} disabled={ctx?.live.busy} title={it.hint}>
              {label ?? <Label id={id} def={it.label} />}
            </button>
          </Item>
        );
      })}
    </div>
  );
}

function Notes({ screen, block }) {
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="notes">
      {list.map(({ it, id }) => (
        <Item key={it.id} as="p" id={id} it={it} siblings={siblings} container={container} axis="y">
          <Label id={id} def={it.label} />
        </Item>
      ))}
    </div>
  );
}

function Banner({ screen, block }) {
  const ctx = usePage();
  const text = ctx?.ctrl.banner?.(block.id, ctx);
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className={`banner tone-${block.tone}`}>
      {list.map(({ it, id }) => (
        <Item key={it.id} id={id} it={it} siblings={siblings} container={container} axis="y">
          <Label id={id} def={text ?? it.label} />
        </Item>
      ))}
    </div>
  );
}

// Example row on the Wage Entry grid when there is no data (prototype / spec tests): type days, OT or extras and
// every auto column updates. Uses a sample Config (Unskilled, ₹556/day, default deductions).
const DEMO_RATE = { basicDaily: 556, vdaDaily: 0, otMultiplier: WAGE_DEFAULTS.otMultiplier, hoursPerDay: WAGE_DEFAULTS.hoursPerDay };
const inr = (v) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LiveWageRow({ list }) {
  const c = useCust();
  const [v, setV] = useState({ attDays: "26", otHrs: "", otMin: "0" });
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  let line = null;
  let error = null;
  try {
    const extras = {};
    for (const k of ["ug", "bonus", "edlis", "pli", "otherEarn", "otherDed", "damage"]) extras[WAGE_INPUTS[k]] = v[k] || 0;
    line = computeWageLine({
      daysWorked: v.attDays === "" ? 0 : v.attDays, otHours: v.otHrs || 0, otMinutes: v.otMin || 0,
      rate: DEMO_RATE, statutory: WAGE_DEFAULTS, extras,
    });
  } catch (e) {
    error = e.message;
  }
  return (
    <>
      <tr className="example-row live" title="Example row: type a number of days and watch wages and deductions calculate.">
        {list.map(({ it, id }) => {
          const hidden = c.hidden(id) ? "is-hidden" : "";
          if (WAGE_INPUTS[it.id]) {
            return (
              <td key={it.id} className={hidden}>
                {it.input === "select" ? (
                  <select aria-label={it.label} value={v[it.id] ?? "0"} onChange={set(it.id)}>
                    {(it.options || []).map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input aria-label={it.label} type="number" min="0" step="any" value={v[it.id] ?? ""} placeholder="0" onChange={set(it.id)} />
                )}
              </td>
            );
          }
          if (WAGE_OUTPUTS[it.id]) {
            return <td key={it.id} className={`calc-cell ${hidden}`} data-testid={`calc-${it.id}`}>{line ? inr(line[WAGE_OUTPUTS[it.id]]) : "—"}</td>;
          }
          if (it.id === "wuin") return <td key={it.id} className={hidden}><span className="muted">Example</span></td>;
          if (it.id === "name") return <td key={it.id} className={hidden}><span className="muted">Sample workman (Unskilled, ₹556/day)</span></td>;
          if (it.kind === "action") return <td key={it.id} className={hidden}><button className="btn btn-primary btn-sm" disabled>{c.label(id, it.btn || it.label)}</button></td>;
          return <td key={it.id} className={hidden}><span className="muted">—</span></td>;
        })}
      </tr>
      {error && (
        <tr><td colSpan={list.length} className="calc-error" role="alert">{error}</td></tr>
      )}
    </>
  );
}

// Work order Config: per-day wages, one row per skill category.
function Rates({ screen, block }) {
  const ctx = usePage();
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="form-section">
      <BlockTitle screen={screen} block={block} />
      {block.note && <p className="small-note">{block.note}</p>}
      <table className="tbl rates-tbl">
        <thead>
          <tr>
            <th>Skill Category</th>
            {list.map(({ it, id }) => (
              <Item as="th" key={it.id} id={id} it={it} siblings={siblings} container={container}>
                <Label id={id} def={it.label} />
                {it.req && <span className="req"> *</span>}
              </Item>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r) => {
            const skill = SKILL_CATEGORIES.find((s) => s === r.label);
            const err = ctx?.errors[`rates.${skill}`];
            return (
              <tr key={r.id} className={err ? "row-error" : ""}>
                <td>{r.label}{err && <div className="field-error">{err}</div>}</td>
                {list.map(({ it }) => (
                  <td key={it.id}>
                    {ctx ? (
                      <input type="text" inputMode="decimal" maxLength={13} aria-label={`${r.label} ${it.label}`} placeholder="0.00"
                        value={ctx.values.rates?.[skill]?.[it.id] ?? ""}
                        onBlur={(e) => ctx.setError(`rates.${skill}`, e.target.value ? checkValue(it.format, e.target.value) : null)}
                        onChange={(e) => ctx.setValues({ rates: { ...(ctx.values.rates ?? {}), [skill]: { ...(ctx.values.rates?.[skill] ?? {}), [it.id]: sanitize(it.format, e.target.value) } } })} />
                    ) : <input type="number" min="0" step="any" aria-label={`${r.label} ${it.label}`} placeholder="0.00" />}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BLOCKS = { stats: Stats, card: Card, table: Table, form: Form, kv: KV, filter: Filter, buttons: Buttons, notes: Notes, banner: Banner, rates: Rates, checklist: Checklist };
