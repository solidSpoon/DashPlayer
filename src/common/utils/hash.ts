export default function hash(str: string, seed = 0) {
    // eslint-disable-next-line no-bitwise
    let h1 = 0xdeadbeef ^ seed;
    // eslint-disable-next-line no-bitwise
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i += 1) {
        ch = str.charCodeAt(i);
        // eslint-disable-next-line no-bitwise
        h1 = Math.imul(h1 ^ ch, 2654435761);
        // eslint-disable-next-line no-bitwise
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 =
        // eslint-disable-next-line no-bitwise
        Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
        // eslint-disable-next-line no-bitwise
        Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
        // eslint-disable-next-line no-bitwise
        Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
        // eslint-disable-next-line no-bitwise
        Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    // eslint-disable-next-line no-bitwise
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString();
}
