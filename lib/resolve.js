// Applies the client's overrides to the schema.
// overrides = { hidden: {id: true}, labels: {id: "New label"}, order: {containerId: [localId, ...]} }
import { MENU, SCREENS } from "./schema";

export const EMPTY = { hidden: {}, labels: {}, order: {} };

export const norm = (o) => ({
  hidden: { ...(o?.hidden || {}) },
  labels: { ...(o?.labels || {}) },
  order: { ...(o?.order || {}) },
});

export const labelOf = (ov, id, def) => (ov.labels[id] != null && ov.labels[id] !== "" ? ov.labels[id] : def);
export const isHidden = (ov, id) => !!ov.hidden[id];

// Returns items sorted by the saved order for the container; unknown/new items keep schema order at the end.
export function ordered(ov, containerId, items) {
  const saved = ov.order[containerId];
  if (!saved) return items;
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const out = saved.filter((id) => byId[id]).map((id) => byId[id]);
  for (const x of items) if (!saved.includes(x.id)) out.push(x);
  return out;
}

// Container ids
export const menuContainer = () => "menu";
export const menuGroupContainer = (g) => `menu.${g}`;
export const screenContainer = (s) => `screen:${s}`;
export const blockContainer = (s, b) => `${s}.${b}`;

// Element ids
export const menuGroupId = (g) => `menu.${g}`;
export const menuItemId = (g, i) => `menu.${g}.${i}`;
export const screenTitleId = (s) => `${s}.title`;
export const blockId = (s, b) => `${s}.${b}`;
export const itemId = (s, b, i) => `${s}.${b}.${i}`;

// Full resolved spec — used by the review page and the JSON export.
export function buildSpec(rawOv) {
  const ov = norm(rawOv);
  const removed = [];
  const renamed = [];
  const el = (id, original, extra = {}) => {
    const label = labelOf(ov, id, original);
    const hidden = isHidden(ov, id);
    if (hidden) removed.push({ id, label: original });
    if (label !== original) renamed.push({ id, from: original, to: label });
    return { id, label, original, hidden, ...extra };
  };
  const reordered = Object.keys(ov.order);

  const menu = ordered(ov, menuContainer(), MENU).map((g) => {
    const group = el(menuGroupId(g.id), g.label, { locked: !!g.locked });
    if (g.items) {
      group.items = ordered(ov, menuGroupContainer(g.id), g.items).map((i) =>
        el(menuItemId(g.id, i.id), i.label, { screen: i.screen })
      );
    }
    return group;
  });

  const screens = SCREENS.map((s) => {
    const title = labelOf(ov, screenTitleId(s.id), s.title);
    if (title !== s.title) renamed.push({ id: screenTitleId(s.id), from: s.title, to: title });
    return {
      id: s.id,
      title,
      blocks: ordered(ov, screenContainer(s.id), s.blocks).map((b) => {
        const blk = el(blockId(s.id, b.id), b.title, { type: b.type });
        blk.items = ordered(ov, blockContainer(s.id, b.id), b.items).map((i) =>
          el(itemId(s.id, b.id, i.id), i.label, {
            locked: !!i.locked,
            required: !!i.req,
            ...(i.calc ? { calc: i.calc } : {}),
            ...(i.input ? { input: i.input } : {}),
            ...(i.options ? { options: i.options } : {}),
          })
        );
        return blk;
      }),
    };
  });

  return { menu, screens, removed, renamed, reordered };
}

// Compact "final spec": only what survives, in order.
export function finalSpec(rawOv) {
  const { menu, screens } = buildSpec(rawOv);
  return {
    menu: menu.filter((g) => !g.hidden).map((g) => ({
      label: g.label,
      ...(g.items ? { items: g.items.filter((i) => !i.hidden).map((i) => ({ label: i.label, screen: i.screen })) } : {}),
    })),
    screens: screens.map((s) => ({
      id: s.id,
      title: s.title,
      blocks: s.blocks.filter((b) => !b.hidden).map((b) => ({
        title: b.label,
        type: b.type,
        items: b.items.filter((i) => !i.hidden).map((i) => ({
          label: i.label,
          ...(i.label !== i.original ? { originalLabel: i.original } : {}),
          ...(i.required ? { required: true } : {}),
          ...(i.input ? { input: i.input } : {}),
          ...(i.options ? { options: i.options } : {}),
          ...(i.calc ? { calc: i.calc } : {}),
        })),
      })),
    })),
  };
}

// Where an element lives, for grouping diffs: "Sidebar menu" or the screen title.
export function placeOf(id) {
  if (id.startsWith("menu.")) return "Sidebar menu";
  const s = SCREENS.find((x) => x.id === id.split(".")[0]);
  return s ? s.title : id;
}

// Flat map of every element: id -> { label, original, hidden }
function flat(ov) {
  const spec = buildSpec(ov);
  const out = {};
  for (const g of spec.menu) {
    out[g.id] = g;
    for (const i of g.items || []) out[i.id] = i;
  }
  for (const s of spec.screens) {
    out[`${s.id}.title`] = { id: `${s.id}.title`, label: s.title, original: SCREENS.find((x) => x.id === s.id).title, hidden: false };
    for (const b of s.blocks) {
      out[b.id] = b;
      for (const i of b.items) out[i.id] = i;
    }
  }
  return out;
}

// What changed from version a to version b (overrides objects).
export function diffVersions(aOv, bOv) {
  const A = flat(norm(aOv));
  const B = flat(norm(bOv));
  const a = norm(aOv);
  const b = norm(bOv);
  const removed = [];
  const restored = [];
  const renamed = [];
  for (const id of Object.keys(B)) {
    const x = A[id];
    const y = B[id];
    if (!x) continue;
    if (!x.hidden && y.hidden) removed.push({ id, label: y.original, place: placeOf(id) });
    if (x.hidden && !y.hidden) restored.push({ id, label: y.original, place: placeOf(id) });
    if (x.label !== y.label) renamed.push({ id, from: x.label, to: y.label, place: placeOf(id) });
  }
  const containers = new Set([...Object.keys(a.order), ...Object.keys(b.order)]);
  const reordered = [...containers]
    .filter((c) => JSON.stringify(a.order[c] || null) !== JSON.stringify(b.order[c] || null))
    .map((c) => ({ container: c, place: c.startsWith("menu") ? "Sidebar menu" : placeOf(c.replace(/^screen:/, "")) }));
  return { removed, restored, renamed, reordered, total: removed.length + restored.length + renamed.length + reordered.length };
}
