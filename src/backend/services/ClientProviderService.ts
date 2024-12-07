export default interface ClientProviderService<T> {
    getClient(): T | null;
}
