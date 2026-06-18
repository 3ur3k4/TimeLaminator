export interface IVideoProcessor {
  decode(file: File, maxResolution: number, onProgress: (progress: number) => void): Promise<ImageData[]>;
}
