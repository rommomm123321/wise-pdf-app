import { useRef, useCallback, useState } from 'react';

export interface UndoAction {
  type: 'create' | 'update' | 'delete';
  markupId: string;
  before?: any; // snapshot before the action
  after?: any;  // snapshot after the action
}

const MAX_HISTORY = 50;

/**
 * Lightweight undo/redo for markup operations.
 * Stores action deltas (create/update/delete) up to MAX_HISTORY.
 */
export function useUndoRedo() {
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const push = useCallback((action: UndoAction) => {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = []; // clear redo on new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback((): UndoAction | null => {
    const action = undoStack.current.pop() || null;
    if (action) {
      redoStack.current.push(action);
      setCanRedo(true);
    }
    setCanUndo(undoStack.current.length > 0);
    return action;
  }, []);

  const redo = useCallback((): UndoAction | null => {
    const action = redoStack.current.pop() || null;
    if (action) {
      undoStack.current.push(action);
      setCanUndo(true);
    }
    setCanRedo(redoStack.current.length > 0);
    return action;
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { push, undo, redo, clear, canUndo, canRedo };
}
