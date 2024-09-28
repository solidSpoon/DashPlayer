export default interface MediaService {
    thumbnail(inputFile: string, time?: number): Promise<string>;
}
