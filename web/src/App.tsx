import { useEffect, useReducer, useRef, useState } from "react";
import { ApiError, fetchPattern } from "./api/patternEngine";
import Inspector from "./components/Inspector";
import Parameters from "./components/Parameters";
import PatternCanvas from "./components/PatternCanvas";
import Toolbar from "./components/Toolbar";
import type { PatternModel } from "./model/Pattern";
import { initialState, reducer } from "./state/bagReducer";
import type { SpecField } from "./model/BagSpec";

const DEBOUNCE_MS = 150;

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [pattern, setPattern] = useState<PatternModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      fetchPattern(state.present)
        .then((result) => {
          if (seq !== requestSeq.current) return; // a newer spec is already in flight
          setPattern(result);
          setError(null);
        })
        .catch((e) => {
          if (seq !== requestSeq.current) return;
          setError(e instanceof ApiError ? e.message : String(e));
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.present]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setField = (field: SpecField, value: number) =>
    dispatch({ type: "setField", field, value });

  return (
    <div className="app">
      <Toolbar
        spec={state.present}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onLoad={(spec) => dispatch({ type: "load", spec })}
        onError={setError}
      />
      {error && (
        <div className="error-banner" role="alert">
          {error} — showing the last valid pattern
        </div>
      )}
      <main className="layout">
        <Parameters spec={state.present} onField={setField} />
        <PatternCanvas
          pattern={pattern}
          selectedId={state.selectedId}
          onSelect={(id) => dispatch({ type: "select", id })}
        />
        <Inspector
          spec={state.present}
          selectedId={state.selectedId}
          pattern={pattern}
          onField={setField}
          onClearSelection={() => dispatch({ type: "select", id: null })}
        />
      </main>
    </div>
  );
}
