export interface Cloneable {
    clone(): this;
}

export interface Convertible<T> {
    convert(): T;
}


export interface Cancelable {
    cancel(): void;
}
