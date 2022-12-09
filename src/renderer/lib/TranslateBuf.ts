export default class TranslateBuf {
    startIndex: number;

    strs: string[];

    response: string[] | undefined;

    private size: number;

    private readonly capacity: number;

    next: TranslateBuf | undefined;

    constructor(startIndex: number, capacity: number) {
        this.startIndex = startIndex;
        this.strs = [];
        this.size = 0;
        this.capacity = capacity;
        this.next = undefined;
    }

    canAdd(str: string): boolean {
        const b = this.size + str.length < this.capacity;
        if (!b) {
            if (this.size === 0) {
                throw new Error(
                    `translate buf: capacity too small-${str.length}`
                );
            }
        }
        return b;
    }

    add(str: string): void {
        if (!this.canAdd(str)) {
            throw new Error('translate buf: too large');
        }
        this.strs.push(str);
        this.size += str.length;
    }

    isEmpty(): boolean {
        return this.size === 0;
    }
}
