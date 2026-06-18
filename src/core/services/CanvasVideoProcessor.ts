import type { IVideoProcessor } from '../interfaces/IVideoProcessor';

export class CanvasVideoProcessor implements IVideoProcessor {
  async decode(file: File, maxResolution: number, onProgress: (progress: number) => void): Promise<ImageData[]> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      // Some containers (e.g. certain .mov/HEVC files) fire loadedmetadata
      // before the decoder has actually resolved a frame size, leaving
      // videoWidth/videoHeight at 0. Retry on loadeddata/canplay, then give
      // up with a clear error rather than passing a 0-sized canvas through.
      const begin = () => {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;

        if (sourceWidth === 0 || sourceHeight === 0) {
          return false;
        }

        const duration = video.duration;

        // Downscale before stacking if the source exceeds the resolution
        // threshold, to keep the voxel grid (and resulting mesh) tractable.
        let width = sourceWidth;
        let height = sourceHeight;
        if (maxResolution > 0 && Math.max(sourceWidth, sourceHeight) > maxResolution) {
          const scale = maxResolution / Math.max(sourceWidth, sourceHeight);
          width = Math.max(1, Math.round(sourceWidth * scale));
          height = Math.max(1, Math.round(sourceHeight * scale));
        }

        // Estimate fps, browser video element doesn't provide exact FPS.
        // We'll extract roughly 30 fps for now, or just seek by a small delta.
        // A better approach in production is using WebCodecs API if available.
        // For this baseline, we seek frame by frame roughly.
        const FPS = 30;
        const totalFrames = Math.floor(duration * FPS);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return true;
        }

        const frames: ImageData[] = [];
        let currentFrame = 0;

        const processFrame = () => {
          ctx.drawImage(video, 0, 0, width, height);
          frames.push(ctx.getImageData(0, 0, width, height));

          currentFrame++;
          onProgress(currentFrame / totalFrames);

          if (currentFrame < totalFrames) {
            video.currentTime = currentFrame / FPS;
          } else {
            URL.revokeObjectURL(url);
            resolve(frames);
          }
        };

        video.onseeked = () => {
          processFrame();
        };

        // Start processing
        video.currentTime = 0;
        return true;
      };

      video.onerror = () => {
        reject(new Error("Video decoding error. The file may use a codec this browser can't decode."));
      };

      video.onloadedmetadata = () => {
        if (begin()) return;
        video.onloadeddata = () => {
          if (begin()) return;
          reject(new Error("Could not read video dimensions. The codec in this file may not be supported by this browser (try converting to H.264 MP4)."));
        };
      };
    });
  }
}
