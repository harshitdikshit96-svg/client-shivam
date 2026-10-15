"use client";
// One renderer for every screen: dashboards, tables, forms, filters, buttons.
import { useCust } from "./Cust";
import { Label, Tools, useDrag } from "./Edit";
import { ordered, screenContainer, blockContainer, blockId, itemId, screenTitleId } from "@/lib/resolve";
import { useState } from "react";
import { SCREEN_BY_ID, WAGE_DEFAULTS } from "@/lib/schema";
import { computeWageLine } from "@/lib/wages";

export default function PageView({ screen, go }) {
  const c = useCust();
  const blocks = ordered(c.ov, screenContainer(screen.id), screen.blocks);
  const siblings = blocks.map((b) => b.id);
  const visible = blocks.filter((b) => c.customizing || !c.hidden(blockId(screen.id, b.id)));
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

  return (
    <div className="page">
      <h1 className="page-title">
        <Label id={screenTitleId(screen.id)} def={screen.title} />
        <Tools id={screenTitleId(screen.id)} def={screen.title} noHide noMove />
      </h1>
      {rows.map((r, i) =>
        r.block ? render(r.block) : <div className="half-row" key={`h${i}`}>{r.halves.map(render)}</div>
      )}
    </div>
  );
}

function BlockShell({ screen, block, siblings, go }) {
  const c = useCust();
  const id = blockId(screen.id, block.id);
  const container = screenContainer(screen.id);
  const hidden = c.hidden(id);
  const drag = useDrag({ container, siblings, localId: block.id });
  const Comp = BLOCKS[block.type];
  return (
    <section
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

const KIND = { rates: "Rate table", stats: "Cards", card: "Panel", table: "Table", form: "Form section", kv: "Details", filter: "Filter", buttons: "Buttons", notes: "Notes", banner: "Banner" };

// Iterates a block's items in the client's order, with per-item tools and drag.
function useItems(screen, block) {
  const c = useCust();
  const container = blockContainer(screen.id, block.id);
  const items = ordered(c.ov, container, block.items);
  const siblings = items.map((x) => x.id);
  const list = items
    .map((it) => ({ it, id: itemId(screen.id, block.id, it.id) }))
    .filter(({ id }) => c.customizing || !c.hidden(id));
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
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="stats">
      {list.map(({ it, id }) => (
        <Item key={it.id} className="stat" id={id} it={it} siblings={siblings} container={container}>
          <Label id={id} def={it.label} className="stat-label" />
          <div className="stat-value">0</div>
        </Item>
      ))}
    </div>
  );
}

function Card({ screen, block }) {
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className={`card tone-${block.tone || "grey"}`}>
      <div className="card-head"><BlockTitle screen={screen} block={block} as="span" className="" /></div>
      <ul className="card-body">
        {list.map(({ it, id }) => (
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
  const { list, siblings, container } = useItems(screen, block);
  const links = block.items.filter((x) => x.to && !c.hidden(itemId(screen.id, block.id, x.id)));
  return (
    <div className="table-wrap">
      {block.note && (
        <>
          <BlockTitle screen={screen} block={block} as="h3" />
          <p className="small-note">{block.note}</p>
        </>
      )}
      <div className="table-scroll">
        <table className="tbl">
          <thead>
            <tr>
              {list.map(({ it, id }) => (
                <Item as="th" key={it.id} id={id} it={it} siblings={siblings} container={container}>
                  <Label id={id} def={it.label} />
                  {it.auto ? <span className="calc-tag auto" title={`Calculated automatically: ${it.calc}`}>auto</span> : it.calc ? <span className="calc-tag" title={it.calc}>calc</span> : null}
                </Item>
              ))}
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Control({ it }) {
  const ro = it.readOnly;
  switch (it.input) {
    case "select":
      return <select disabled={ro} defaultValue="">{[<option key="" value="" />, ...(it.options || []).map((o) => <option key={o}>{o}</option>)]}</select>;
    case "textarea":
      return <textarea readOnly={ro} rows={2} />;
    case "date":
      return <input type="date" readOnly={ro} />;
    case "file":
      return <input type="file" disabled={ro} />;
    case "password":
      return <input type="password" autoComplete="off" readOnly={ro} />;
    case "button":
      return null;
    case "number":
      return <input type="number" min="0" step="any" readOnly={ro} defaultValue={it.def ?? undefined} />;
    default:
      return <input type="text" readOnly={ro} />;
  }
}

function Form({ screen, block }) {
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="form-section">
      <BlockTitle screen={screen} block={block} />
      <div className={`form-grid ${block.single ? "single" : ""}`}>
        {list.map(({ it, id }) => (
          <Item key={it.id} className={`field ${it.readOnly ? "ro" : ""}`} id={id} it={it} siblings={siblings} container={container}>
            <label>
              <Label id={id} def={it.label} />
              {it.req && <span className="req"> *</span>}
            </label>
            <Control it={it} />
          </Item>
        ))}
      </div>
    </div>
  );
}

function KV({ screen, block }) {
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="kv">
      {list.map(({ it, id }) => (
        <Item key={it.id} className="kv-row" id={id} it={it} siblings={siblings} container={container} axis="y">
          <Label id={id} def={it.label} className="kv-key" />
          <span className="kv-val">——</span>
        </Item>
      ))}
    </div>
  );
}

function Filter({ screen, block }) {
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className="filter">
      <BlockTitle screen={screen} block={block} as="span" className="filter-title" />
      {list.map(({ it, id }) => (
        <Item key={it.id} className="filter-item" id={id} it={it} siblings={siblings} container={container}>
          {it.input === "button" ? (
            <button className="btn btn-outline"><Label id={id} def={it.label} /></button>
          ) : (
            <>
              <Label id={id} def={it.label} className="filter-label" />
              <Control it={it} />
            </>
          )}
        </Item>
      ))}
    </div>
  );
}

function Buttons({ screen, block, go }) {
  const c = useCust();
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className={`btn-row ${block.align === "right" ? "right" : ""}`}>
      {list.map(({ it, id }) => (
        <Item key={it.id} className={`btn-item ${it.wide ? "wide" : ""}`} id={id} it={it} siblings={siblings} container={container}>
          <button
            className={`btn ${it.tone === "green" ? "btn-success" : it.tone === "outline" ? "btn-outline" : "btn-primary"} ${it.wide ? "w100" : ""}`}
            onClick={() => it.to && !c.editing && go(it.to)}
          >
            <Label id={id} def={it.label} />
          </button>
        </Item>
      ))}
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
  const { list, siblings, container } = useItems(screen, block);
  return (
    <div className={`banner tone-${block.tone}`}>
      {list.map(({ it, id }) => (
        <Item key={it.id} id={id} it={it} siblings={siblings} container={container} axis="y">
          <Label id={id} def={it.label} />
        </Item>
      ))}
    </div>
  );
}

// Example row on the Wage Entry grid that really calculates: type days, OT or extras and every auto column updates.
// Uses a sample Config (Unskilled, ₹556/day, default deductions); real rows use each work order's Config.
const DEMO_RATE = { basicDaily: 556, vdaDaily: 0, otMultiplier: WAGE_DEFAULTS.otMultiplier, hoursPerDay: WAGE_DEFAULTS.hoursPerDay };
const INPUT_KEYS = { attDays: "daysWorked", otHrs: "otHours", otMin: "otMinutes", ug: "ugAllowance", bonus: "bonus", edlis: "edlis", pli: "pli", otherEarn: "otherEarnings", otherDed: "otherDeduction", damage: "damageRecovery" };
const OUTPUT_KEYS = { basic: "basicRate", vda: "vdaRate", basicPay: "basicVdaEarned", ot: "otAmount", gross: "grossEarnings", epf: "epfDeduction", esi: "esiDeduction", totalDed: "totalDeduction", net: "netEarnings" };
const inr = (v) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LiveWageRow({ list }) {
  const c = useCust();
  const [v, setV] = useState({ attDays: "26", otHrs: "", otMin: "0" });
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  let line = null;
  let error = null;
  try {
    const extras = {};
    for (const k of ["ug", "bonus", "edlis", "pli", "otherEarn", "otherDed", "damage"]) extras[INPUT_KEYS[k]] = v[k] || 0;
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
          if (INPUT_KEYS[it.id]) {
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
          if (OUTPUT_KEYS[it.id]) {
            return <td key={it.id} className={`calc-cell ${hidden}`} data-testid={`calc-${it.id}`}>{line ? inr(line[OUTPUT_KEYS[it.id]]) : "—"}</td>;
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
          {block.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.label}</td>
              {list.map(({ it }) => (
                <td key={it.id}><input type="number" min="0" step="any" aria-label={`${r.label} ${it.label}`} placeholder="0.00" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BLOCKS = { stats: Stats, card: Card, table: Table, form: Form, kv: KV, filter: Filter, buttons: Buttons, notes: Notes, banner: Banner, rates: Rates };
