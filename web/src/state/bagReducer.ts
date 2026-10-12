import { applyField, DEFAULT_BAG, type BagSpec, type SpecField } from "../model/BagSpec";

export type AppState = {
  past: BagSpec[];
  present: BagSpec;
  future: BagSpec[];
  lastField: SpecField | null;
  selectedId: string | null;
};

export type Action =
  | { type: "setField"; field: SpecField; value: number }
  | { type: "load"; spec: BagSpec }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 100;

export function initialState(): AppState {
  return { past: [], present: DEFAULT_BAG, future: [], lastField: null, selectedId: null };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setField": {
      const present = applyField(state.present, action.field, action.value);
      // coalesce consecutive edits of the same field into one undo step
      const push = state.lastField !== action.field;
      return {
        past: push ? [...state.past, state.present].slice(-HISTORY_LIMIT) : state.past,
        present,
        future: [],
        lastField: action.field,
        selectedId: state.selectedId,
      };
    }
    case "load":
      return { past: [], present: action.spec, future: [], lastField: null, selectedId: null };
    case "select":
      return { ...state, selectedId: action.id };
    case "undo": {
      if (state.past.length === 0) return state;
      const present = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present,
        future: [state.present, ...state.future],
        lastField: null,
        selectedId: state.selectedId,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [present, ...future] = state.future;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present,
        future,
        lastField: null,
        selectedId: state.selectedId,
      };
    }
  }
}
