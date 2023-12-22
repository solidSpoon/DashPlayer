import { p } from './Util';

export default class TransHolder<T> {
    private result: Map<string, T> = new Map<string, T>();

    public getMapping(): Map<string, T> {
        return this.result;
    }

    public isEmpty(): boolean {
        return this.result.size === 0;
    }

    public addAll(map: Map<string, T>): void {
        map.forEach((value, key) => {
            this.add(p(key), value);
        });
    }

    public add(key: string, value: T) {
        this.result.set(p(key), value);
    }

    public get(key: string): T | undefined {
        return this.result.get(p(key));
    }

    public merge(other: TransHolder<T>): TransHolder<T> {
        const res = new TransHolder<T>();
        this.result.forEach((value, key) => {
            res.add(key, value);
        });
        other.result.forEach((value, key) => {
            res.add(key, value);
        });
        return res;
    }

    static from<T>(mapping: Map<string, T>) {
        const res = new TransHolder<T>();
        res.addAll(mapping);
        return res;
    }
}
