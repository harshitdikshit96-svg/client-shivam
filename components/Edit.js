"use client";
// Building blocks for customizable elements: inline rename, hide/show, move, drag-to-reorder.
import { useEffect, useRef, useState } from "react";
import { useCust } from "./Cust";

// Renders a label; in customize mode it can be renamed inline.
export function Label({ id, def, as: Tag = "span", className, still }) {
  const c = useCust();
  const text = c.label(id, def);
  const editingThis = !still && c.customizing && c.editing === id;
  const [val, setVal] = useState(text);
  const ref = useRef(null);
  useEffect(() => {
    if (editingThis) {
      setVal(text);
      setTimeout(() => ref.current?.select(), 0);
    }
  }, [editingThis]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editingThis) {
    const done = (commit) => {
      if (commit) c.rename(id, val, def);
      c.setEditing(null);
    };
    return (
      <input
        ref={ref}
        className="rename-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") done(true);
          if (e.key === "Escape") done(false);
        }}
        onBlur={() => done(true)}
        aria-label={`Rename ${def}`}
      />
    );
  }
  return (
    <Tag
      className={className}
      title={c.customizing && text !== def ? `Originally: ${def}` : undefined}
      onDoubleClick={c.customizing && !still ? (e) => { e.stopPropagation(); c.setEditing(id); } : undefined}
    >
      {text}
    </Tag>
  );
}

// Small control strip: move back / forward, rename, hide or show.
export function Tools({ id, def, item, container, siblings, localId, axis = "x", noHide, noMove }) {
  const c = useCust();
  if (!c.customizing) return null;
  const hidden = c.hidden(id);
  const idx = siblings ? siblings.indexOf(localId) : -1;
  const prev = axis === "x" ? "◀" : "▲";
  const next = axis === "x" ? "▶" : "▼";
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
  return (
    <span className="tools" onClick={(e) => e.stopPropagation()}>
      {!noMove && siblings && (
        <>
          <button type="button" title="Move earlier" disabled={idx <= 0} onClick={stop(() => c.move(container, siblings, localId, idx - 1))}>{prev}</button>
          <button type="button" title="Move later" disabled={idx >= siblings.length - 1} onClick={stop(() => c.move(container, siblings, localId, idx + 1))}>{next}</button>
        </>
      )}
      <button type="button" title="Rename" onClick={stop(() => c.setEditing(id))}>✎</button>
      {item?.locked || noHide ? (
        <span className="lock" title="Required by the system — cannot be removed">🔒</span>
      ) : hidden ? (
        <button type="button" className="show" title="Show again" onClick={stop(() => c.show(id))}>Show</button>
      ) : (
        <button type="button" className="hide" title="Hide" onClick={stop(() => c.hide(id, item))}>✕</button>
      )}
    </span>
  );
}

// Drag & drop props for reorderable elements within one container.
let dragState = null;
export function useDrag({ container, siblings, localId }) {
  const c = useCust();
  const [over, setOver] = useState(false);
  if (!c.customizing || !siblings) return { props: {}, over: false };
  return {
    over,
    props: {
      draggable: c.editing ? false : true,
      onDragStart: (e) => {
        e.stopPropagation();
        dragState = { container, localId };
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", localId); } catch {}
      },
      onDragOver: (e) => {
        if (dragState?.container !== container) return;
        e.preventDefault();
        e.stopPropagation();
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        if (dragState?.container !== container) return;
        e.preventDefault();
        e.stopPropagation();
        const from = dragState.localId;
        dragState = null;
        if (from === localId) return;
        const list = siblings.filter((x) => x !== from);
        c.move(container, siblings, from, list.indexOf(localId));
      },
      onDragEnd: () => { dragState = null; setOver(false); },
    },
  };
}

// Visible items for a container, with hidden ones kept (faded) in customize mode.
export function useVisible(items, idFor) {
  const c = useCust();
  return items.filter((x) => c.customizing || !c.hidden(idFor(x)));
}
