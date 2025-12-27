export default interface MediaService {
    thumbnail(inputFile: string, time?: number): Promise<string>;
    duration(inputFile: string): Promise<number>;
}
