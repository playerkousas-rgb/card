import { useCallback, useState } from "react";

export function useProjectHistory(initial) {
  const [history, setHistory] = useState(() => ({
    present: initial(),
    past: [],
    future: [],
  }));
  const change = useCallback(
    (updater) =>
      setHistory((current) => {
        const next =
          typeof updater === "function" ? updater(current.present) : updater;
        if (next === current.present) return current;
        return {
          present: next,
          past: [...current.past.slice(-29), current.present],
          future: [],
        };
      }),
    [],
  );
  const replace = useCallback(
    (project) => setHistory({ present: project, past: [], future: [] }),
    [],
  );
  const undo = useCallback(
    () =>
      setHistory((current) =>
        current.past.length
          ? {
              present: current.past.at(-1),
              past: current.past.slice(0, -1),
              future: [current.present, ...current.future],
            }
          : current,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setHistory((current) =>
        current.future.length
          ? {
              present: current.future[0],
              past: [...current.past, current.present],
              future: current.future.slice(1),
            }
          : current,
      ),
    [],
  );
  return {
    project: history.present,
    change,
    replace,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
