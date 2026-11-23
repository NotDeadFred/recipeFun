/** State for cook mode, kept as a pure reducer so it can be unit tested. */
export interface CookState {
  stepIndex: number;
  totalSteps: number;
  completed: boolean[];
  /** Ingredients the cook has ticked off as gathered/used. */
  checkedIngredients: string[];
}

export type CookAction =
  | { type: "next" }
  | { type: "previous" }
  | { type: "goto"; index: number }
  | { type: "toggle-ingredient"; id: string }
  | { type: "reset" };

export function initCookState(totalSteps: number, startIndex = 0): CookState {
  return {
    stepIndex: Math.min(Math.max(0, startIndex), Math.max(0, totalSteps - 1)),
    totalSteps,
    completed: Array.from({ length: totalSteps }, () => false),
    checkedIngredients: [],
  };
}

export function cookReducer(state: CookState, action: CookAction): CookState {
  const last = Math.max(0, state.totalSteps - 1);
  switch (action.type) {
    case "next": {
      const completed = [...state.completed];
      completed[state.stepIndex] = true;
      return { ...state, completed, stepIndex: Math.min(state.stepIndex + 1, last) };
    }
    case "previous":
      return { ...state, stepIndex: Math.max(state.stepIndex - 1, 0) };
    case "goto":
      return { ...state, stepIndex: Math.min(Math.max(action.index, 0), last) };
    case "toggle-ingredient": {
      const has = state.checkedIngredients.includes(action.id);
      return {
        ...state,
        checkedIngredients: has
          ? state.checkedIngredients.filter((i) => i !== action.id)
          : [...state.checkedIngredients, action.id],
      };
    }
    case "reset":
      return initCookState(state.totalSteps);
  }
}

export function isFinished(state: CookState): boolean {
  return state.totalSteps > 0 && state.completed.every(Boolean);
}

export function progressPercent(state: CookState): number {
  if (state.totalSteps === 0) return 0;
  return Math.round((state.completed.filter(Boolean).length / state.totalSteps) * 100);
}
