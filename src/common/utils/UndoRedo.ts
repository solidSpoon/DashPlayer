class UndoRedo<T> {
    private undoStack: T[] = [];
    private redoStack: T[] = [];

    public undo() {
        const state = this.undoStack.pop();
        if (state) {
            this.redoStack.push(state);
        }
        return state;
    }

    public redo() {
        const state = this.redoStack.pop();
        if (state) {
            this.undoStack.push(state);
        }
        return state;
    }

    public canUndo() {
        return this.undoStack.length > 0;
    }

    public canRedo() {
        return this.redoStack.length > 0;
    }

    public add(state: T) {
        this.undoStack.push(state);
        this.redoStack = [];
    }
    public clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

export default UndoRedo;
