"use client";
// What each screen shows and does with live data. lib/schema.js says which fields, columns and buttons a screen
// has; this file says which records fill them, where links go and what every button does.
//
// A controller may define (all optional, all receive ctx — see PageView):
//   title(ctx)                       screen title
//   guide(ctx)                       { text, fix } shown above the screen when a step is missing (no firm, no work order…)
//   scope(ctx)                       the "saved under firm …" line for create/edit forms
//   load(ctx)                        initial form values (may be async: fetches the record being edited)
//   rows(block, ctx) / kv(block, ctx) / items(block, ctx)   records for tables, detail panels and cards
//   empty(block, ctx)                { text, fix } when a table has no rows
//   hide(block, item, ctx)           hide a button or block that does not apply (e.g. Approve on an approved order)
//   options(block, item, ctx)        [{ value, label }] for selects filled from data
//   readOnly(block, item, ctx)       field shown but not editable
//   label(block, item, ctx)          button label for this state
//   filter: { get(block, item, ctx), set(block, item, value, ctx) }
//   row(block, item, row, ctx)       what a row button does
//   action(block, item, ctx)         what a button under the screen does
import { computeWageLine } from "@/lib/wages";
import { WAGE_DEFAULTS, SCREEN_BY_ID } from "@/lib/schema";
import { MONTHS, periodLabel, fmtDate, fmtMoney, todayIso, engagedInMonth, orderInMonth, downloadCsv } from "./Data";

// ---------- helpers ----------
const orderById = (d, id) => d.workOrders.find((o) => o.id === Number(id)) ?? null;
const workmanById = (d, id) => d.workmen.find((w) => w.id === Number(id)) ?? null;
const STATUS_TEXT = { pending: "Pending approval", approved: "Ongoing", rejected: "Rejected", completed: "Completed" };
const WAGE_STATUS = { draft: "Draft (not submitted)", submitted: "Submitted", approved: "Approved" };
const now = new Date();
const thisPeriod = { year: now.getFullYear(), month: now.getMonth() + 1 };

const toast = (ctx, text, fix) => ctx.live.notify("ok", text, { fix });
const info = (ctx, text, fix) => ctx.live.notify("info", text, { fix });
const NO_FIRM = { stop: true, text: "No firm yet. Everything (work orders, workmen, wages, bills) is kept under a firm, so start by creating one.", fix: { label: "Create Firm", to: "create_firm" } };
const UPLOAD_SOON = "Uploading documents is not part of this version yet. The record is kept without the file for now.";

/** The default period for the wage lists: the latest month that has wages, else this month. */
export function defaultPeriod(d) {
  const s = d?.sheets?.[0];
  return s ? { year: s.year, month: s.month } : thisPeriod;
}
// until the user picks a month, each wage list opens on its own latest month (e.g. Approved Wages on the last approved one)
const listPeriod = (ctx, status = ctx.ctrl?.status) => {
  if (ctx.live.period) return ctx.live.period;
  const s = status ? ctx.d.sheets.find((x) => x.status === status) : null;
  return s ? { year: s.year, month: s.month } : defaultPeriod(ctx.d);
};

const periodFilter = {
  get: (b, item, ctx) => {
    const p = listPeriod(ctx);
    return item === "year" ? String(p.year) : item === "month" ? MONTHS[p.month - 1] : undefined;
  },
  set: (b, item, v, ctx) => {
    const p = { ...listPeriod(ctx) };
    if (item === "year") p.year = Number(v);
    if (item === "month") p.month = MONTHS.indexOf(v) + 1;
    ctx.live.setPeriod(p);
  },
};

const confirmMove = async (ctx, wo, move) => {
  const words = {
    approve: ["Approve", `Approve work order ${wo.woNo}? Workmen can then be engaged on it and wages entered.`],
    reject: ["Reject", `Reject work order ${wo.woNo}? It moves to the rejected list; it can be resubmitted later.`],
    resubmit: ["Resubmit", `Send work order ${wo.woNo} for approval again?`],
    complete: ["Mark Completed", `Mark ${wo.woNo} completed? Its ${wo.workmenCount} current engagement(s) end today (or on the completion date) and those workmen become inactive. Wages can still be entered for its months.`],
    reopen: ["Reopen", `Reopen ${wo.woNo}? It goes back to the ongoing list.`],
  }[move];
  if (!(await ctx.live.ask({ title: `${words[0]}?`, body: words[1], confirm: words[0] }))) return;
  const r = await ctx.live.run("setWorkOrderStatus", { workOrderId: wo.id, move });
  const next = {
    approve: { label: "Engage workmen on it", to: "wm_engage", params: { wo: wo.id } },
    complete: { label: "Completed Work Orders", to: "wo_completed" },
    reject: { label: "Pending Work Order Approval", to: "wo_pending" },
  }[move];
  toast(ctx, `Work order ${wo.woNo} ${r.verb}.${r.ended ? ` ${r.ended} engagement(s) ended.` : ""}`, next);
};

const editEngagement = async (ctx, e) => {
  const v = await ctx.live.ask({
    title: `Edit engagement of ${e.wuin} on ${e.woNo}`, body: "Correct the dates. Leave Engaged To empty if the workman is still engaged.",
    confirm: "Save dates", inputs: [
      { name: "from", type: "date", label: "Engaged From", value: e.from },
      { name: "to", type: "date", label: "Engaged To", value: e.to ?? "" },
    ],
  });
  if (!v) return;
  await ctx.live.run("editEngagement", { engagementId: e.id, from: v.from, to: v.to });
  toast(ctx, `Engagement of ${e.wuin} on ${e.woNo} saved: ${fmtDate(v.from)} to ${v.to ? fmtDate(v.to) : "now"}.`);
};

/** Ask, delete, say what happened. The server refuses (naming the linked records) when something depends on it. */
const confirmDelete = async (ctx, { title, body, op, args, done, then }) => {
  if (!(await ctx.live.ask({ title, body: `${body} This cannot be undone.`, confirm: "Delete" }))) return;
  const r = await ctx.live.run(op, args);
  await then?.(r);      // first move on (another list, another firm)…
  toast(ctx, done(r));  // …then say what happened, so the message is not cleared by that move
};
const deleteEngagement = (ctx, e) => confirmDelete(ctx, {
  title: `Delete the engagement of ${e.wuin} on ${e.woNo}?`, body: `${fmtDate(e.from)} to ${e.to ? fmtDate(e.to) : "now"}. Use this only for an engagement entered by mistake; End or Edit keeps the history.`,
  op: "deleteEngagement", args: { engagementId: e.id }, done: () => `Engagement of ${e.wuin} on ${e.woNo} deleted.`,
});

const endEngagement = async (ctx, e) => {
  if (e.to) return info(ctx, `This engagement already ended on ${fmtDate(e.to)}.`);
  const to = await ctx.live.ask({
    title: `End engagement of ${e.wuin} on ${e.woNo}?`, body: `Engaged from ${fmtDate(e.from)}. Pick the last working day; the workman becomes inactive until engaged again.`,
    confirm: "End engagement", input: { type: "date", label: "Last working day", value: todayIso() < e.from ? e.from : todayIso() },
  });
  if (!to) return;
  await ctx.live.run("endEngagement", { engagementId: e.id, to });
  toast(ctx, `Engagement of ${e.wuin} on ${e.woNo} ended on ${fmtDate(to)}.`, { label: "Engage on another work order", to: "wm_engage", params: { wm: e.workmanId } });
};

const sheetRow = (s) => ({ ...s, period: periodLabel(s.year, s.month), wageStatus: WAGE_STATUS[s.status], net: s.net, gross: s.gross, totalDed: s.totalDed });
const csvColumns = (screenId, blockId) => SCREEN_BY_ID[screenId].blocks.find((b) => b.id === blockId).items.filter((i) => i.kind !== "action" && i.id !== "select" && i.id !== "newFrom");

// ---------- wage grid ----------
export const WAGE_INPUTS = { attDays: "daysWorked", otHrs: "otHours", otMin: "otMinutes", ug: "ugAllowance", bonus: "bonus", edlis: "edlis", pli: "pli", otherEarn: "otherEarnings", otherDed: "otherDeduction", damage: "damageRecovery" };
export const WAGE_OUTPUTS = { basic: "basicRate", vda: "vdaRate", basicPay: "basicVdaEarned", ot: "otAmount", gross: "grossEarnings", epf: "epfDeduction", esi: "esiDeduction", totalDed: "totalDeduction", net: "netEarnings" };

/** Which work order and month the Wage Entry screen shows. */
export function wageSelection(ctx) {
  const d = ctx.d;
  const usable = d.workOrders.filter((o) => o.status === "approved" || o.status === "completed");
  const wo = orderById(d, ctx.params.wo) ?? (ctx.params.wo ? null : usable.find((o) => o.status === "approved") ?? usable[0] ?? null);
  let year = Number(ctx.params.y) || null;
  let month = Number(ctx.params.m) || null;
  if (wo && !(year && month)) {
    const draft = d.sheets.find((s) => s.workOrderId === wo.id && s.status === "draft");
    if (draft) ({ year, month } = draft);
    else if (orderInMonth(wo, thisPeriod.year, thisPeriod.month)) ({ year, month } = thisPeriod);
    else { const [y, m] = (wo.end < todayIso() ? wo.end : wo.start).split("-").map(Number); year = y; month = m; }
  }
  const sheet = wo && year ? d.sheets.find((s) => s.workOrderId === wo.id && s.year === year && s.month === month) ?? null : null;
  return { wo, year, month, sheet, usable };
}

/** Rows of the Wage Entry grid: workmen engaged on the order in the month, plus anyone already paid in it. */
export function wageRows(ctx) {
  const { wo, year, month, sheet } = wageSelection(ctx);
  if (!wo || !year) return [];
  const ids = new Set(ctx.d.engagements.filter((e) => e.workOrderId === wo.id && engagedInMonth(e, year, month)).map((e) => e.workmanId));
  for (const l of sheet?.lines ?? []) ids.add(l.workmanId);
  return [...ids].map((id) => {
    const w = workmanById(ctx.d, id);
    const saved = sheet?.lines.find((l) => l.workmanId === id) ?? null;
    const engs = ctx.d.engagements.filter((e) => e.workmanId === id && e.workOrderId === wo.id);
    const when = engs.filter((e) => engagedDays([e], year, month) > 0).map((e) => `${fmtDate(e.from)} to ${e.to ? fmtDate(e.to) : "now"}`).join(", ");
    return { workmanId: id, wuin: w?.wuin, name: w?.fullName, skill: w?.skill, saved, engaged: engagedDays(engs, year, month), when };
  }).sort((a, b) => String(a.wuin).localeCompare(String(b.wuin)));
}

const gridKey = (sel) => `${sel.wo?.id}|${sel.year}|${sel.month}`;
/** What has been typed in the grid (starts from the saved lines). */
export function gridValues(ctx) {
  const sel = wageSelection(ctx);
  if (ctx.local.gridKey === gridKey(sel) && ctx.local.grid) return ctx.local.grid;
  const g = {};
  for (const r of wageRows(ctx)) {
    const s = r.saved;
    g[r.workmanId] = Object.fromEntries(Object.keys(WAGE_INPUTS).map((k) => [k, s ? (k === "otMin" ? String(s[k] ?? 0) : s[k] ? String(s[k]) : k === "attDays" ? String(s[k]) : "") : k === "otMin" ? "0" : ""]));
  }
  return g;
}
export const setGridValue = (ctx, workmanId, key, v) => {
  const sel = wageSelection(ctx);
  const g = gridValues(ctx);
  ctx.setLocal({ gridKey: gridKey(sel), grid: { ...g, [workmanId]: { ...g[workmanId], [key]: v } }, dirty: true });
};

/** Live calculation of one grid row from the order's Config (the server recalculates on Save). */
/** Days of month (y, m) inside the engagements given (same rule the server applies on Save). */
export function engagedDays(engs, y, m) {
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return engs.reduce((t, e) => {
    const a = e.from > first ? e.from : first;
    const b = (e.to ?? "9999-12-31") < last ? e.to : last;
    return a > b ? t : t + (Date.parse(b) - Date.parse(a)) / 86400000 + 1;
  }, 0);
}

export function previewLine(wo, skill, typed, limit = null) {
  if (!typed || typed.attDays === "" || typed.attDays == null) return { line: null };
  const days = Number(typed.attDays);
  if (limit && Number.isFinite(days)) {
    if (days > limit.month) return { error: `${days} days entered, but ${limit.label} has ${limit.month} days` };
    if (limit.engaged && days > limit.engaged) {
      const n = `${limit.engaged} day${limit.engaged === 1 ? "" : "s"}`;
      return { error: `${days} days entered, but the engagement on ${wo.woNo} covers only ${n} of ${limit.label}${limit.when ? ` (${limit.when})` : ""}. Enter at most ${limit.engaged}, or correct the engagement dates (Edit, on the work order's page).` };
    }
  }
  const rate = wo?.config?.rates?.[skill];
  if (!rate) return { error: `No Per Day Wage for "${skill}" in this work order's Config` };
  try {
    const extras = {};
    for (const k of ["ug", "bonus", "edlis", "pli", "otherEarn", "otherDed", "damage"]) extras[WAGE_INPUTS[k]] = typed[k] || 0;
    return {
      line: computeWageLine({
        daysWorked: typed.attDays, otHours: typed.otHrs || 0, otMinutes: typed.otMin || 0,
        rate: { ...rate, otMultiplier: wo.config.otMultiplier, hoursPerDay: wo.config.hoursPerDay }, statutory: wo.config.statutory, extras,
      }),
    };
  } catch (e) {
    return { error: e.message };
  }
}

const workmenWord = (n) => `${n} workm${n === 1 ? "an" : "en"}`;

async function saveGrid(ctx, { quiet = false } = {}) {
  const sel = wageSelection(ctx);
  const g = gridValues(ctx);
  const rows = wageRows(ctx).map((r) => ({
    workmanId: r.workmanId,
    ...Object.fromEntries(Object.entries(WAGE_INPUTS).map(([k, server]) => [server, g[r.workmanId]?.[k] ?? ""])),
  }));
  const r = await ctx.live.run("saveWages", { workOrderId: sel.wo.id, year: sel.year, month: sel.month, rows });
  const failed = Object.keys(r.errors).length;
  ctx.setLocal({ rowErrors: r.errors, dirty: failed > 0 });
  if (failed) {
    const rateMissing = Object.values(r.errors).some((m) => /Per Day Wage/.test(m));
    ctx.live.notify("error", `Saved ${workmenWord(r.saved)}; ${failed} could not be saved — the reason is shown in red on each row.`, {
      fix: rateMissing ? { label: "Open Config", to: "wo_config", params: { wo: sel.wo.id } } : null,
    });
    return null;
  }
  if (!quiet) toast(ctx, `Saved wages of ${workmenWord(r.saved)} for ${periodLabel(sel.year, sel.month)}${r.removed ? `; ${r.removed} cleared row(s) removed` : ""}. Press Submit when everyone is entered.`);
  return r.sheetId;
}

// ---------- controllers ----------
export const CONTROLLERS = {
  home: {
    title: (ctx) => SCREEN_BY_ID.home.title.replace("——", ctx.d.firm?.cuin || ctx.d.firm?.name || "——"),
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    stat: (item, ctx) => ({
      value: ctx.d.workOrders.filter((o) => o.status === item).length,
      onClick: () => ctx.go(item === "approved" ? "wo_ongoing" : "wo_pending"),
    }),
    steps: (ctx) => {
      const d = ctx.d;
      const done = {
        firm: !!d.firm, wo: d.workOrders.length > 0, approve: d.workOrders.some((o) => o.status !== "pending" && o.status !== "rejected"),
        workman: d.workmen.length > 0, engage: d.engagements.length > 0, wages: d.sheets.length > 0,
      };
      return Object.values(done).every(Boolean) ? null : done;
    },
    items: (b, ctx) => (b === "recent" ? (ctx.d.activity.length
      ? ctx.d.activity.map((a) => ({ text: `${a.text}${a.at ? ` · ${fmtDate(a.at.slice(0, 10))}` : ""}`, onClick: () => ctx.go(a.to, a.params) }))
      : [{ text: "No recent activity. Create a work order to get started.", onClick: () => ctx.go("wo_new") }]) : null),
  },

  // ----- work orders -----
  wo_ongoing: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    rows: (b, ctx) => ctx.d.workOrders.filter((o) => o.status === "approved"),
    empty: (b, ctx) => (ctx.d.workOrders.some((o) => o.status === "pending")
      ? { text: "No ongoing work orders. Work orders waiting for approval are listed under Pending Work Order Approval.", fix: { label: "Pending Work Order Approval", to: "wo_pending" } }
      : { text: "No ongoing work orders yet. Create one; it becomes ongoing once approved.", fix: { label: "Create New Work Order", to: "wo_new" } }),
    row: (b, item, row, ctx) => (item === "complete" ? () => confirmMove(ctx, row, "complete") : null),
  },
  wo_completed: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    rows: (b, ctx) => ctx.d.workOrders.filter((o) => o.status === "completed"),
    empty: () => ({ text: "No completed work orders. Use Mark Completed on an ongoing work order when the contract ends.", fix: { label: "Ongoing Work Orders", to: "wo_ongoing" } }),
    row: (b, item, row, ctx) => (item === "reopen" ? () => confirmMove(ctx, row, "reopen") : null),
  },
  wo_pending: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    rows: (b, ctx) => ctx.d.workOrders.filter((o) => o.status === "pending" || o.status === "rejected").map((o) => ({ ...o, status: STATUS_TEXT[o.status], raw: o.status })),
    empty: () => ({ text: "Nothing is waiting for approval.", fix: { label: "Create New Work Order", to: "wo_new" } }),
    label: (b, item, ctx, row) => (row?.raw === "rejected" && item === "approve" ? "Resubmit" : null),
    hideCell: (b, item, row) => row.raw === "rejected" && item === "reject",
    row: (b, item, row, ctx) => (item === "approve" ? () => confirmMove(ctx, row, row.raw === "rejected" ? "resubmit" : "approve")
      : item === "reject" ? () => confirmMove(ctx, row, "reject") : null),
  },
  wo_view: {
    title: (ctx) => `Work Order — ${orderById(ctx.d, ctx.params.wo)?.woNo ?? ""}`,
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : !orderById(ctx.d, ctx.params.wo)
      ? { stop: true, text: "This work order is not in the selected firm. Pick one from the list.", fix: { label: "Ongoing Work Orders", to: "wo_ongoing" } } : null),
    kv: (b, ctx) => {
      const o = orderById(ctx.d, ctx.params.wo);
      return o && { ...o, status: STATUS_TEXT[o.status] };
    },
    hide: (b, item, ctx) => {
      const s = orderById(ctx.d, ctx.params.wo)?.status;
      if (b !== "actions") return false;
      return {
        approve: s !== "pending", reject: s !== "pending", resubmit: s !== "rejected", complete: s !== "approved", reopen: s !== "completed",
        engage: s !== "approved", wages: s !== "approved" && s !== "completed",
      }[item] ?? false;
    },
    action: (b, item, ctx) => {
      const o = orderById(ctx.d, ctx.params.wo);
      if (["approve", "reject", "resubmit", "complete", "reopen"].includes(item)) return () => confirmMove(ctx, o, item);
      if (item === "delete") return () => confirmDelete(ctx, {
        title: `Delete work order ${o.woNo}?`, body: "Its Config goes with it. Only an order with no engagements, wages or bills can be deleted.",
        op: "deleteWorkOrder", args: { workOrderId: o.id }, done: (r) => `Work order ${r.woNumber} deleted.`,
        then: () => ctx.go(o.status === "approved" ? "wo_ongoing" : o.status === "completed" ? "wo_completed" : "wo_pending", {}, { keepNotice: true }),
      });
      return () => ctx.go(SCREEN_BY_ID.wo_view.blocks.find((x) => x.id === "actions").items.find((i) => i.id === item).to, { wo: o.id });
    },
    rows: (b, ctx) => {
      const id = Number(ctx.params.wo);
      if (b === "workmen") return ctx.d.engagements.filter((e) => e.workOrderId === id).sort((a, b2) => (a.to ? 1 : 0) - (b2.to ? 1 : 0) || String(a.wuin).localeCompare(String(b2.wuin)));
      if (b === "sheets") return ctx.d.sheets.filter((s) => s.workOrderId === id).map(sheetRow);
      if (b === "bills") return ctx.d.bills.filter((x) => x.workOrderId === id);
      return null;
    },
    empty: (b, ctx) => {
      const o = orderById(ctx.d, ctx.params.wo);
      if (b === "workmen") return o?.status === "approved" ? { text: "No workmen engaged on this work order yet.", fix: { label: "Engage Workmen", to: "wm_engage", params: { wo: o.id } } } : { text: o?.status === "pending" ? "No workmen yet. Approve the work order first, then engage workmen on it." : "No workmen were engaged on this work order." };
      if (b === "sheets") return o?.status === "approved" ? { text: "No wages entered yet.", fix: { label: "Wage Entry", to: "wage_entry", params: { wo: o.id } } } : { text: "No wages entered." };
      return { text: "No bills for this work order.", fix: { label: "Add a bill", to: "dispatch_register", params: { wo: o?.id } } };
    },
    row: (b, item, row, ctx) => {
      if (b === "workmen" && item === "edit") return () => editEngagement(ctx, row);
      if (b === "workmen" && item === "end") return () => endEngagement(ctx, row);
      if (b === "workmen" && item === "del") return () => deleteEngagement(ctx, row);
      if (b === "sheets") return () => ctx.go("wage_entry", { wo: row.workOrderId, y: row.year, m: row.month });
      if (b === "bills") return () => ctx.go("dispatch_register", { bill: row.id });
      return null;
    },
    hideCell: (b, item, row) => b === "workmen" && item === "end" && !!row.to,
  },
  wo_new: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    scope: (ctx) => `This work order will be saved under ${ctx.d.firm?.name}. To use another firm, switch it in the top bar first.`,
    load: () => ({ statutory: Object.fromEntries(Object.entries(WAGE_DEFAULTS).map(([k, v]) => [k, v == null ? "" : String(v)])), rates: {} }),
    action: (b, item, ctx) => async () => {
      const wo = await ctx.live.run("createWorkOrder", { values: ctx.values });
      toast(ctx, `Work order ${wo.woNumber} created and waiting for approval. Approve it to engage workmen and enter wages.`, { label: "Open work order", to: "wo_view", params: { wo: wo.id } });
      ctx.go("wo_view", { wo: wo.id }, { keepNotice: true });
    },
  },
  wo_edit: {
    title: (ctx) => `Edit Work Order / Contract${orderById(ctx.d, ctx.params.wo) ? ` — ${orderById(ctx.d, ctx.params.wo).woNo}` : ""}`,
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : !orderById(ctx.d, ctx.params.wo)
      ? { stop: true, text: "Choose the work order to edit: use Edit on a row of the work order list.", fix: { label: "Ongoing Work Orders", to: "wo_ongoing" } } : null),
    load: (ctx) => (orderById(ctx.d, ctx.params.wo) ? ctx.live.run("getWorkOrder", { workOrderId: Number(ctx.params.wo) }, { refresh: false }) : {}),
    kv: (b, ctx) => orderById(ctx.d, ctx.params.wo),
    action: (b, item, ctx) => async () => {
      const r = await ctx.live.run("updateWorkOrder", { workOrderId: Number(ctx.params.wo), values: ctx.values });
      toast(ctx, `Work order ${r.woNumber} saved.${r.recalculated ? ` ${r.recalculated} draft wage line(s) recalculated with the new Config.` : ""}`);
      ctx.go("wo_view", { wo: r.id }, { keepNotice: true });
    },
  },
  wo_config: {
    title: (ctx) => `Work Order Config${orderById(ctx.d, ctx.params.wo) ? ` — ${orderById(ctx.d, ctx.params.wo).woNo}` : ""}`,
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : !orderById(ctx.d, ctx.params.wo)
      ? { stop: true, text: "Choose the work order whose Config to open: use Config on a row of the work order list.", fix: { label: "Ongoing Work Orders", to: "wo_ongoing" } } : null),
    load: (ctx) => (orderById(ctx.d, ctx.params.wo) ? ctx.live.run("getWorkOrder", { workOrderId: Number(ctx.params.wo) }, { refresh: false }) : {}),
    kv: (b, ctx) => orderById(ctx.d, ctx.params.wo),
    action: (b, item, ctx) => async () => {
      const r = await ctx.live.run("saveConfig", { workOrderId: Number(ctx.params.wo), values: ctx.values });
      toast(ctx, `Config saved.${r.recalculated ? ` ${r.recalculated} draft wage line(s) recalculated; submitted months are unchanged.` : ""}`, { label: "Back to work order", to: "wo_view", params: { wo: r.workOrderId } });
    },
  },

  // ----- workmen -----
  wm_engage: {
    guide: (ctx) => {
      if (!ctx.d.firm) return NO_FIRM;
      if (!ctx.d.workOrders.some((o) => o.status === "approved")) {
        return { text: "There is no approved work order to engage workmen on. Create a work order and approve it first.", fix: ctx.d.workOrders.length ? { label: "Pending Work Order Approval", to: "wo_pending" } : { label: "Create New Work Order", to: "wo_new" } };
      }
      return null;
    },
    options: (b, item, ctx) => (item === "wo" ? ctx.d.workOrders.filter((o) => o.status === "approved").map((o) => ({ value: String(o.id), label: `${o.woNo} — ${o.workName}` })) : null),
    filter: {
      get: (b, item, ctx) => (ctx.local.wo ?? (ctx.params.wo ? String(ctx.params.wo) : "")),
      set: (b, item, v, ctx) => ctx.setLocal({ wo: v, rowErrors: {} }),
    },
    rows: (b, ctx) => {
      const rows = ctx.d.workmen.filter((w) => w.state !== "moved");
      // a workman opened from his page comes first
      return ctx.params.wm ? [...rows].sort((a, b2) => (b2.id === Number(ctx.params.wm)) - (a.id === Number(ctx.params.wm))) : rows;
    },
    empty: () => ({ text: "No workmen in this firm yet. Add them with New Workman.", fix: { label: "New Workman", to: "wm_edit", params: { back: "wm_engage" } } }),
    action: (b, item, ctx) => {
      if (item === "engage") return async () => {
        const wo = ctx.local.wo ?? (ctx.params.wo ? String(ctx.params.wo) : "");
        const sel = ctx.local.sel ?? {};
        const rows = Object.entries(sel).filter(([, v]) => v.checked).map(([id, v]) => ({ workmanId: Number(id), from: v.from ?? "" }));
        try {
          const r = await ctx.live.run("engageWorkmen", { workOrderId: Number(wo) || null, rows });
          ctx.setLocal({ sel: {}, rowErrors: {} });
          toast(ctx, `${r.engaged} workm${r.engaged === 1 ? "an" : "en"} engaged on ${r.woNumber}${r.moved ? ` (${r.moved} moved from another work order; that engagement ended the day before)` : ""}.`, { label: "Enter wages", to: "wage_entry", params: { wo: Number(wo) } });
        } catch (e) {
          ctx.setLocal({ rowErrors: Object.fromEntries(Object.entries(e.fields ?? {}).filter(([k]) => k.startsWith("row.")).map(([k, v]) => [k.slice(4), v])) });
          throw e;
        }
      };
      if (item === "newWorkman") return () => ctx.go("wm_edit", { back: "wm_engage" });
      if (item === "formA") return () => {
        const cols = [{ id: "wuin", label: "WUIN" }, { id: "fullName", label: "Name" }, { id: "gender", label: "Gender" }, { id: "dob", label: "Date of Birth" },
          { id: "skill", label: "Skill Category" }, { id: "designation", label: "Designation" }, { id: "doj", label: "Date of Joining" },
          { id: "engagedIn", label: "Engaged in (Work Order)" }, { id: "engagedFrom", label: "Engaged From" }, { id: "status", label: "Status" }, { id: "exitDate", label: "Date of Exit" }];
        downloadCsv(`FORM-A-register-${ctx.d.firm.name}.csv`, cols, ctx.d.workmen);
        toast(ctx, `FORM A (register of workmen) downloaded: ${ctx.d.workmen.length} workmen.`);
      };
      if (item === "excel") return () => {
        downloadCsv(`workmen-${ctx.d.firm.name}.csv`, csvColumns("wm_engage", "list"), ctx.d.workmen.filter((w) => w.state !== "moved"));
        toast(ctx, "Workmen list downloaded (opens in Excel).");
      };
      return null;
    },
    row: (b, item, row, ctx) => (item === "letter" ? () => info(ctx, UPLOAD_SOON) : null),
  },
  wm_active: workmenList("active", { text: "No active workmen. A workman is active while engaged on a work order.", fix: { label: "Engage Workmen", to: "wm_engage" } }),
  wm_inactive: workmenList("inactive", { text: "No inactive workmen. Workmen show here when they are not engaged on any work order (new, or their engagement ended)." }),
  wm_moved: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    rows: (b, ctx) => ctx.d.workmen.filter((w) => w.state === "moved"),
    empty: () => ({ text: "No workmen have moved out. Set a Date of Exit on a workman (Edit) to move them out." }),
    row: (b, item, row, ctx) => (item === "engBefore" ? () => ctx.go("wm_view", { wm: row.id }) : null),
  },
  wm_view: {
    title: (ctx) => `Workman — ${workmanById(ctx.d, ctx.params.wm)?.wuin ?? ""}`,
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : !workmanById(ctx.d, ctx.params.wm)
      ? { stop: true, text: "This workman is not in the selected firm. Pick one from the list.", fix: { label: "View Active Workmen", to: "wm_active" } } : null),
    kv: (b, ctx) => workmanById(ctx.d, ctx.params.wm),
    hide: (b, item, ctx) => b === "actions" && item === "engage" && workmanById(ctx.d, ctx.params.wm)?.state === "moved",
    action: (b, item, ctx) => {
      const w = workmanById(ctx.d, ctx.params.wm);
      if (item === "delete") return () => confirmDelete(ctx, {
        title: `Delete workman ${w.wuin} (${w.fullName})?`, body: "Only a workman with no engagements and no wages can be deleted; otherwise set a Date of Exit.",
        op: "deleteWorkman", args: { workmanId: w.id }, done: (r) => `Workman ${r.wuin} deleted.`,
        then: () => ctx.go(w.state === "moved" ? "wm_moved" : w.state === "active" ? "wm_active" : "wm_inactive", {}, { keepNotice: true }),
      });
      return () => ctx.go(item === "edit" ? "wm_edit" : "wm_engage", { wm: w.id });
    },
    rows: (b, ctx) => {
      const id = Number(ctx.params.wm);
      if (b === "engagements") return ctx.d.engagements.filter((e) => e.workmanId === id).reverse();
      if (b === "wages") {
        return ctx.d.sheets.flatMap((s) => s.lines.filter((l) => l.workmanId === id).map((l) => ({
          ...l, sheetId: s.id, workOrderId: s.workOrderId, woNo: s.woNo, period: periodLabel(s.year, s.month), wageStatus: WAGE_STATUS[s.status],
        })));
      }
      return null;
    },
    empty: (b, ctx) => (b === "engagements"
      ? { text: "Not engaged on any work order yet.", fix: { label: "Engage on a Work Order", to: "wm_engage", params: { wm: Number(ctx.params.wm) } } }
      : { text: "No wages entered for this workman yet." }),
    row: (b, item, row, ctx) => (b === "engagements"
      ? () => (item === "edit" ? editEngagement(ctx, row) : item === "del" ? deleteEngagement(ctx, row) : endEngagement(ctx, row))
      : () => ctx.go("wage_slip", { wuin: row.wuin, sheet: row.sheetId })),
    hideCell: (b, item, row) => b === "engagements" && item === "end" && !!row.to,   // ended ones can still be edited
  },
  wm_edit: {
    title: (ctx) => {
      const w = workmanById(ctx.d, ctx.params.wm);
      return w ? SCREEN_BY_ID.wm_edit.title.replace("——", w.wuin) : "New Workman";
    },
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : ctx.params.wm && !workmanById(ctx.d, ctx.params.wm)
      ? { stop: true, text: "This workman is not in the selected firm.", fix: { label: "View Active Workmen", to: "wm_active" } } : null),
    scope: (ctx) => (ctx.params.wm ? null : `The workman will be added to ${ctx.d.firm?.name} and given a WUIN automatically. To use another firm, switch it in the top bar first.`),
    load: async (ctx) => (ctx.params.wm
      ? (await ctx.live.run("getWorkman", { workmanId: Number(ctx.params.wm) }, { refresh: false })).values
      : { details: { nationality: "Indian", pwd: "No", exServ: "No", pfType: "EPF", accommodation: "Self" } }),
    hideItem: (b, item, ctx) => b === "note" && item === "n2" && !ctx.params.wm,
    label: (b, item, ctx) => (item === "update" && !ctx.params.wm ? "Add Workman" : null),
    action: (b, item, ctx) => async () => {
      if (ctx.params.wm) {
        const w = await ctx.live.run("updateWorkman", { workmanId: Number(ctx.params.wm), values: ctx.values });
        toast(ctx, `Workman ${w.wuin} saved.${w.dateOfExit ? " A Date of Exit is set, so the workman is listed under Workmen Moved Out." : ""}`);
        return ctx.go("wm_view", { wm: w.id }, { keepNotice: true });
      }
      const w = await ctx.live.run("createWorkman", { values: ctx.values });
      toast(ctx, `Workman added with WUIN ${w.wuin}. Next, engage the workman on a work order.`, { label: "Engage now", to: "wm_engage", params: { wm: w.id } });
      ctx.go(ctx.params.back === "wm_engage" ? "wm_engage" : "wm_view", ctx.params.back === "wm_engage" ? {} : { wm: w.id }, { keepNotice: true });
    },
  },

  // ----- wages -----
  wage_entry: {
    guide: (ctx) => {
      if (!ctx.d.firm) return NO_FIRM;
      const sel = wageSelection(ctx);
      if (!sel.usable.length) return { text: "Wages are entered against an approved work order. There is none in this firm yet.", fix: ctx.d.workOrders.length ? { label: "Pending Work Order Approval", to: "wo_pending" } : { label: "Create New Work Order", to: "wo_new" } };
      if (!sel.wo) return { text: "Choose the work order above." };
      if (!sel.wo.config || !Object.keys(sel.wo.config.rates).length) return { text: `${sel.wo.woNo} has no Per Day Wage in its Config, so wages cannot be calculated.`, fix: { label: "Open Config", to: "wo_config", params: { wo: sel.wo.id } } };
      if (!orderInMonth(sel.wo, sel.year, sel.month)) return { text: `${sel.wo.woNo} runs from ${fmtDate(sel.wo.start)} to ${fmtDate(sel.wo.end)}; choose a month inside it.` };
      return null;
    },
    options: (b, item, ctx) => (item === "wo" ? wageSelection(ctx).usable.map((o) => ({ value: String(o.id), label: `${o.woNo} — ${o.workName}${o.status === "completed" ? " (completed)" : ""}` })) : null),
    filter: {
      get: (b, item, ctx) => {
        const s = wageSelection(ctx);
        return item === "wo" ? String(s.wo?.id ?? "") : item === "year" ? String(s.year ?? "") : s.month ? MONTHS[s.month - 1] : "";
      },
      set: async (b, item, v, ctx) => {
        const s = wageSelection(ctx);
        if (ctx.local.dirty && !(await ctx.live.ask({ title: "Leave without saving?", body: "Wages typed on this screen have not been saved.", confirm: "Leave" }))) return;
        const p = { wo: s.wo?.id, y: s.year, m: s.month };
        if (item === "wo") { p.wo = Number(v); delete p.y; delete p.m; }
        if (item === "year") p.y = Number(v);
        if (item === "month") p.m = MONTHS.indexOf(v) + 1;
        ctx.go("wage_entry", p);
      },
    },
    kv: (b, ctx) => {
      const s = wageSelection(ctx);
      if (!s.wo) return null;
      return { woRef: `${s.wo.woNo} — ${s.wo.workName}`, period: `${periodLabel(s.year, s.month)} · ${s.sheet ? WAGE_STATUS[s.sheet.status] : "Not started"}` };
    },
    banner: (b, ctx) => {
      const s = wageSelection(ctx);
      if (s.sheet && s.sheet.status !== "draft") return `${WAGE_STATUS[s.sheet.status]} on ${fmtDate((s.sheet.approvedAt ?? s.sheet.submittedAt)?.slice(0, 10))}. These wages are locked and can only be viewed; press Reopen for Editing to correct them.`;
      const deadline = s.sheet?.deadline;
      if (deadline) return `Wage submission deadline: ${fmtDate(deadline)}. After the deadline you may continue saving, but submission is no longer available.`;
      return s.wo?.config?.deadlineDay ? `Wage submission deadline: day ${s.wo.config.deadlineDay} of the next month. After the deadline you may continue saving, but submission is no longer available.` : null;
    },
    hide: (b, item, ctx) => {
      if (b !== "actions") return false;
      const st = wageSelection(ctx).sheet?.status ?? "none";
      const locked = st === "submitted" || st === "approved";
      return { save: locked, submit: locked, approve: st !== "submitted", reopen: !locked, deleteMonth: st !== "draft" }[item] ?? false;
    },
    empty: (b, ctx) => {
      const s = wageSelection(ctx);
      return s.wo?.status === "approved"
        ? { text: `No workmen were engaged on ${s.wo.woNo} in ${periodLabel(s.year, s.month)}. Engage workmen first; they then appear here.`, fix: { label: "Engage Workmen", to: "wm_engage", params: { wo: s.wo.id } } }
        : { text: `No wages were entered for ${s.wo?.woNo} in ${periodLabel(s.year, s.month)}.` };
    },
    action: (b, item, ctx) => {
      const s = wageSelection(ctx);
      if (item === "save") return () => saveGrid(ctx);
      if (item === "deleteMonth") return () => confirmDelete(ctx, {
        title: `Delete all wages of ${periodLabel(s.year, s.month)} on ${s.wo.woNo}?`, body: `${s.sheet.lines.length} saved row(s) are removed. To remove one workman only, clear his Days Worked and press Save.`,
        op: "deleteWages", args: { sheetId: s.sheet.id }, done: () => `Wages of ${periodLabel(s.year, s.month)} on ${s.wo.woNo} deleted.`,
        then: () => ctx.setLocal({ grid: null, gridKey: null, dirty: false, rowErrors: {} }),
      });
      if (item === "submit") return async () => {
        if (!(await ctx.live.ask({ title: `Submit wages for ${periodLabel(s.year, s.month)}?`, body: "Submitted wages are locked: they cannot be changed afterwards, even if the Config changes.", confirm: "Submit" }))) return;
        const sheetId = await saveGrid(ctx, { quiet: true });
        if (!sheetId) return;
        await ctx.live.run("submitWages", { sheetId });
        toast(ctx, `Wages for ${periodLabel(s.year, s.month)} submitted and locked.`, { label: "Submitted Wages", to: "wage_submitted" });
      };
      if (item === "approve") return async () => {
        if (!(await ctx.live.ask({ title: "Approve these wages?", body: `${s.wo.woNo}, ${periodLabel(s.year, s.month)}.`, confirm: "Approve" }))) return;
        await ctx.live.run("approveWages", { sheetId: s.sheet.id });
        toast(ctx, `Wages for ${periodLabel(s.year, s.month)} approved.`, { label: "Approved Wages", to: "wage_approved" });
      };
      if (item === "reopen") return async () => {
        if (!(await ctx.live.ask({ title: `Reopen ${periodLabel(s.year, s.month)} for editing?`, body: `The month goes back to draft so days and extras can be corrected. Saving recalculates the rows with ${s.wo.woNo}'s current Config. Submit it again afterwards.`, confirm: "Reopen" }))) return;
        await ctx.live.run("reopenWages", { sheetId: s.sheet.id });
        toast(ctx, `${periodLabel(s.year, s.month)} reopened. Correct the rows, Save, then Submit again.`);
      };
      if (item === "excel") return () => {
        const rows = wageRows(ctx).map((r) => ({ wuin: r.wuin, name: r.name, ...(r.saved ?? {}) }));
        if (!rows.length) return info(ctx, "There are no rows to download for this month.");
        downloadCsv(`wages-${s.wo.woNo}-${s.year}-${String(s.month).padStart(2, "0")}.csv`, csvColumns("wage_entry", "grid"), rows);
        toast(ctx, `Wage sheet downloaded with the saved values${ctx.local.dirty ? " (unsaved changes are not included — press Save first)" : ""}.`);
      };
      if (item === "statement") return () => {
        if (!s.sheet?.lines.length) return info(ctx, "Nothing saved yet for this month. Save the wages first; the statement prints the saved values.");
        window.print();
      };
      return null;
    },
    row: (b, item, row, ctx) => (item === "slip" ? () => (row.saved
      ? ctx.go("wage_slip", { wuin: row.wuin, sheet: wageSelection(ctx).sheet.id })
      : info(ctx, `Save the wages of ${row.wuin} first; the slip shows saved values.`)) : null),
  },
  wage_new: wageList({
    rows: (ctx) => {
      const p = listPeriod(ctx);
      return ctx.d.workOrders.filter((o) => o.status === "approved" && orderInMonth(o, p.year, p.month)).flatMap((o) => {
        const s = ctx.d.sheets.find((x) => x.workOrderId === o.id && x.year === p.year && x.month === p.month);
        if (s && s.status !== "draft") return [];
        const engaged = ctx.d.engagements.filter((e) => e.workOrderId === o.id && engagedInMonth(e, p.year, p.month)).length;
        return [{ ...o, workOrderId: o.id, year: p.year, month: p.month, period: periodLabel(p.year, p.month), wageStatus: s ? WAGE_STATUS.draft : "Not started", workmenCount: engaged, net: s ? s.net : null }];
      });
    },
    empty: (ctx) => {
      const p = listPeriod(ctx);
      if (!ctx.d.workOrders.some((o) => o.status === "approved")) return { text: "Wages are entered against approved work orders; there is none yet.", fix: { label: "Pending Work Order Approval", to: "wo_pending" } };
      return { text: `Nothing left to enter for ${periodLabel(p.year, p.month)}: every ongoing work order is submitted, or none runs in that month. Choose another month above.`, fix: { label: "Submitted Wages", to: "wage_submitted" } };
    },
  }),
  wage_submitted: wageList({ status: "submitted" }),
  wage_approved: wageList({ status: "approved" }),
  wage_slip: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    filter: {
      get: (b, item, ctx) => (item === "wuin" ? (ctx.local.wuin ?? ctx.params.wuin ?? "") : undefined),
      set: (b, item, v, ctx) => ctx.setLocal({ wuin: v }),
    },
    action: (b, item, ctx) => {
      if (b === "search") return () => {
        const q = String(ctx.local.wuin ?? ctx.params.wuin ?? "").trim().toUpperCase();
        if (!q) return info(ctx, "Type the WUIN of the worker, then press Search. WUINs are listed under Workmen → View Active Workmen.");
        const w = ctx.d.workmen.find((x) => x.wuin.toUpperCase() === q);
        if (!w) return ctx.live.notify("error", `No workman with WUIN ${q} in ${ctx.d.firm.name}. Check the number, or switch the firm in the top bar.`);
        ctx.go("wage_slip", { wuin: w.wuin });
      };
      if (item === "print") return () => {
        if (!ctx.params.sheet) return info(ctx, "Choose a month with View Slip first.");
        window.print();
      };
      return null;
    },
    rows: (b, ctx) => {
      const w = ctx.d.workmen.find((x) => x.wuin === ctx.params.wuin);
      if (!w) return null;
      return ctx.d.sheets.flatMap((s) => s.lines.filter((l) => l.workmanId === w.id).map((l) => ({
        ...l, sheetId: s.id, woNo: s.woNo, period: periodLabel(s.year, s.month), wageStatus: WAGE_STATUS[s.status],
      })));
    },
    empty: () => ({ text: "No wages have been entered for this workman yet." }),
    row: (b, item, row, ctx) => () => ctx.go("wage_slip", { wuin: row.wuin, sheet: row.sheetId }),
    kv: (b, ctx) => {
      const s = ctx.d.sheets.find((x) => x.id === Number(ctx.params.sheet));
      const l = s?.lines.find((x) => x.wuin === ctx.params.wuin);
      return l ? { ...l, woNo: s.woNo, period: periodLabel(s.year, s.month), otTime: `${l.otHrs} h ${l.otMin} min` } : null;
    },
    hideBlock: (b, ctx) => (b === "history" && !ctx.params.wuin) || ((b === "slip" || b === "actions") && !ctx.params.sheet),
  },

  // ----- firm, compliance -----
  create_firm: {
    title: (ctx) => (ctx.params.edit ? `Edit Firm — ${ctx.d.firm?.name ?? ""}` : "Create Firm"),
    load: (ctx) => (ctx.params.edit && ctx.d.firm ? ctx.live.run("getFirm", {}, { refresh: false }) : {}),
    label: (b, item, ctx) => (item === "save" && ctx.params.edit ? "Save Firm" : null),
    hide: (b, item, ctx) => item === "delete" && !ctx.params.edit,
    action: (b, item, ctx) => item === "delete" ? () => confirmDelete(ctx, {
      title: `Delete firm "${ctx.d.firm.name}"?`, body: "Only a firm with no work orders, workmen or bills can be deleted.",
      op: "deleteFirm", args: {}, done: (r) => `Firm "${r.name}" deleted.`,
      then: async () => { await ctx.live.setFirm(null); ctx.go("home", {}, { keepNotice: true }); },
    }) : async () => {
      if (ctx.params.edit) {
        await ctx.live.run("updateFirm", { values: ctx.values });
        toast(ctx, "Firm details saved.");
        return ctx.go("home", {}, { keepNotice: true });
      }
      const f = await ctx.live.run("createFirm", { values: ctx.values }, { refresh: false });
      await ctx.live.setFirm(f.id);
      toast(ctx, `Firm "${f.name}" created and selected. Next, create its first work order.`, { label: "Create New Work Order", to: "wo_new" });
      ctx.go("home", {}, { keepNotice: true });
    },
  },
  dispatch_register: {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    scope: (ctx) => `Bills of ${ctx.d.firm?.name}. ${ctx.local.billId ?? ctx.params.bill ? "Editing the bill chosen above." : "Fill the form to add a new bill, or press Edit on a bill above."}`,
    load: async (ctx) => {
      const id = ctx.params.bill;
      if (id && ctx.d.bills.some((b) => b.id === Number(id))) {
        ctx.setLocal({ billId: Number(id) });
        return { details: (await ctx.live.run("getBill", { billId: Number(id) }, { refresh: false })).details };
      }
      return { details: { wo: ctx.params.wo ? String(ctx.params.wo) : "", gstStatus: "Pending", epfStatus: "Pending", esicStatus: "Pending", approved: "No" } };
    },
    rows: (b, ctx) => ctx.d.bills.map((x) => ({ ...x, current: x.id === (ctx.local.billId ?? Number(ctx.params.bill)) })),
    empty: () => ({ text: "No bills yet. Fill the Bill Details form below and press Save Bill." }),
    options: (b, item, ctx) => (item === "wo" ? ctx.d.workOrders.map((o) => ({ value: String(o.id), label: `${o.woNo} — ${o.workName}` })) : null),
    row: (b, item, row, ctx) => async () => {
      // already in the form (e.g. just added): reloading it could overwrite what is being typed
      if (ctx.local.billId !== row.id) {
        const v = await ctx.live.run("getBill", { billId: row.id }, { refresh: false });
        ctx.setValues({ details: v.details });
        ctx.setLocal({ billId: row.id });
      }
      info(ctx, `Editing bill ${row.billNo}. Change the fields below and press Save Bill.`);
      ctx.scrollTo("details");
    },
    label: (b, item, ctx) => (b === "actions" && item === "edit" ? (ctx.local.billId ? "Save Bill" : "Add Bill") : null),
    hide: (b, item, ctx) => b === "actions" && item === "delete" && !ctx.local.billId,
    action: (b, item, ctx) => {
      if (item === "delete") return () => {
        const bill = ctx.d.bills.find((x) => x.id === ctx.local.billId);
        return confirmDelete(ctx, {
          title: `Delete bill ${bill?.billNo}?`, body: "The bill and its payment status are removed from the Dispatch Register.",
          op: "deleteBill", args: { billId: ctx.local.billId }, done: (r) => `Bill ${r.billNumber} deleted.`,
          then: () => { ctx.setLocal({ billId: null }); ctx.setValues({ details: { gstStatus: "Pending", epfStatus: "Pending", esicStatus: "Pending", approved: "No" } }); },
        });
      };
      if (item === "new") return () => {
        ctx.setLocal({ billId: null });
        ctx.setValues({ details: { gstStatus: "Pending", epfStatus: "Pending", esicStatus: "Pending", approved: "No" } });
        info(ctx, "Form cleared for a new bill.");
        ctx.scrollTo("details");
      };
      return async () => {
        const billId = ctx.local.billId ?? null;
        const r = await ctx.live.run("saveBill", { billId, values: ctx.values });
        ctx.setLocal({ billId: r.id });
        toast(ctx, `Bill ${r.billNumber} ${billId ? "saved" : "added"}.`);
      };
    },
  },
  reset_pw: {
    action: (b, item, ctx) => async () => {
      const r = await ctx.live.run("resetPassword", { values: ctx.values }, { refresh: false });
      ctx.setValues({ form: {} });
      toast(ctx, `Password changed for login "${r.username}". Any other browser that was logged in has to log in again.`);
    },
  },
};

function workmenList(state, emptyMsg) {
  return {
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    rows: (b, ctx) => ctx.d.workmen.filter((w) => w.state === state),
    empty: (b, ctx) => (ctx.d.workmen.length ? emptyMsg : { text: "No workmen in this firm yet.", fix: { label: "New Workman", to: "wm_edit" } }),
    row: (b, item, row, ctx) => (item === "engBefore" ? () => ctx.go("wm_view", { wm: row.id }) : null),
    action: (b, item, ctx) => (item === "bulkAcc" ? () => {
      if (!ctx.d.workmen.some((w) => w.state === state)) return info(ctx, "There are no workmen in this list to update.");
      ctx.setLocal({ bulk: !ctx.local.bulk });
    } : null),
    bulk: true,
  };
}

function wageList({ status, rows, empty }) {
  return {
    status,
    guide: (ctx) => (!ctx.d.firm ? NO_FIRM : null),
    filter: periodFilter,
    rows: (b, ctx) => {
      if (rows) return rows(ctx);
      const p = listPeriod(ctx);
      return ctx.d.sheets.filter((s) => s.status === status && s.year === p.year && s.month === p.month).map(sheetRow);
    },
    empty: (b, ctx) => {
      if (empty) return empty(ctx);
      const p = listPeriod(ctx);
      const months = [...new Set(ctx.d.sheets.filter((s) => s.status === status).map((s) => `${s.year}-${s.month}`))];
      if (!months.length) return { text: `No ${status} wages yet.${status === "submitted" ? " Wages appear here after Submit on the Wage Entry screen." : " Wages appear here once submitted wages are approved."}`, fix: { label: "New Wage Entry", to: "wage_new" } };
      const [y, m] = months[0].split("-").map(Number);
      return { text: `No ${status} wages for ${periodLabel(p.year, p.month)}. ${status[0].toUpperCase() + status.slice(1)} months: ${months.map((x) => { const [yy, mm] = x.split("-").map(Number); return periodLabel(yy, mm); }).join(", ")}.`, fix: { label: `Show ${periodLabel(y, m)}`, period: { year: y, month: m } } };
    },
    action: (b, item, ctx) => (item === "search" ? () => {
      const p = listPeriod(ctx);
      const n = CONTROLLERS[ctx.screenId].rows("list", ctx).length;
      info(ctx, `${n} work order${n === 1 ? "" : "s"} for ${periodLabel(p.year, p.month)}.`);
    } : null),
    row: (b, item, row, ctx) => {
      if (item === "approve") return async () => {
        if (!(await ctx.live.ask({ title: "Approve these wages?", body: `${row.woNo}, ${row.period}: ${row.workmenCount} workmen, net ₹${fmtMoney(row.net)}.`, confirm: "Approve" }))) return;
        await ctx.live.run("approveWages", { sheetId: row.id });
        toast(ctx, `Wages for ${row.woNo}, ${row.period} approved.`, { label: "Approved Wages", to: "wage_approved" });
      };
      if (item === "proof") return () => info(ctx, UPLOAD_SOON);
      return () => ctx.go("wage_entry", { wo: row.workOrderId, y: row.year, m: row.month });
    },
  };
}
