class UndoRedo<T> {
    private undoStack: T[] = [];
    private redoStack: T[] = [];

    public undo() {
        const state = this.undoStack.pop();
        if (state) {
            this.redoStack.push(state);
        }
        return this.undoStack[this.undoStack.length - 1];
    }

    public redo() {
        const state = this.redoStack.pop();
        if (state) {
            this.undoStack.push(state);
        }
        return this.undoStack[this.undoStack.length - 1];
    }

    public canUndo() {
        return this.undoStack.length > 1;
    }

    public canRedo() {
        return this.redoStack.length > 0;
    }

    public add(state: T) {
        this.undoStack.push(state);
        this.redoStack = [];
    }

    public update(state: T) {
        this.undoStack[this.undoStack.length - 1] = state;
    }
    public clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

export default UndoRedo;
