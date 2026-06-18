export class FrameProcessor {
  static trim(frames: ImageData[], range: [number, number]): ImageData[] {
    if (frames.length === 0) return frames;
    const start = Math.max(0, Math.min(range[0], frames.length - 1));
    const end = Math.max(start, Math.min(range[1], frames.length - 1));
    return frames.slice(start, end + 1);
  }

  static decimate(frames: ImageData[], step: number): ImageData[] {
    const s = Math.max(1, Math.floor(step));
    return frames.filter((_, i) => i % s === 0);
  }

  static toGrayscale(frame: ImageData): Float32Array {
    const { data, width, height } = frame;
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }
    return gray;
  }

  // Separable box blur, applied twice (horizontal + vertical), as a cheap Gaussian approximation.
  static blur(gray: Float32Array, width: number, height: number, radius: number): Float32Array {
    if (radius <= 0) return gray;
    const horizontal = FrameProcessor.boxBlur1D(gray, width, height, radius, true);
    return FrameProcessor.boxBlur1D(horizontal, width, height, radius, false);
  }

  private static boxBlur1D(
    src: Float32Array,
    width: number,
    height: number,
    radius: number,
    horizontal: boolean
  ): Float32Array {
    const out = new Float32Array(src.length);
    if (horizontal) {
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let count = 0;
          for (let k = -radius; k <= radius; k++) {
            const sx = x + k;
            if (sx >= 0 && sx < width) {
              sum += src[rowOffset + sx];
              count++;
            }
          }
          out[rowOffset + x] = sum / count;
        }
      }
    } else {
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let sum = 0;
          let count = 0;
          for (let k = -radius; k <= radius; k++) {
            const sy = y + k;
            if (sy >= 0 && sy < height) {
              sum += src[sy * width + x];
              count++;
            }
          }
          out[y * width + x] = sum / count;
        }
      }
    }
    return out;
  }

  static threshold(gray: Float32Array, thresholdValue: number): Uint8Array {
    const binary = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
      binary[i] = gray[i] >= thresholdValue ? 1 : 0;
    }
    return binary;
  }

  // 4-connected (cross) structuring element. Border pixels treated as background.
  static erode(binary: Uint8Array, width: number, height: number): Uint8Array {
    const out = new Uint8Array(binary.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binary[idx] === 0) continue;
        const up = y > 0 ? binary[idx - width] : 0;
        const down = y < height - 1 ? binary[idx + width] : 0;
        const left = x > 0 ? binary[idx - 1] : 0;
        const right = x < width - 1 ? binary[idx + 1] : 0;
        out[idx] = up && down && left && right ? 1 : 0;
      }
    }
    return out;
  }

  static dilate(binary: Uint8Array, width: number, height: number): Uint8Array {
    const out = new Uint8Array(binary.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binary[idx] === 1) {
          out[idx] = 1;
          continue;
        }
        const up = y > 0 ? binary[idx - width] : 0;
        const down = y < height - 1 ? binary[idx + width] : 0;
        const left = x > 0 ? binary[idx - 1] : 0;
        const right = x < width - 1 ? binary[idx + 1] : 0;
        out[idx] = up || down || left || right ? 1 : 0;
      }
    }
    return out;
  }

  // Morphological opening (erode then dilate) removes small noise specks while preserving larger shapes.
  static removeNoise(binary: Uint8Array, width: number, height: number): Uint8Array {
    const eroded = FrameProcessor.erode(binary, width, height);
    return FrameProcessor.dilate(eroded, width, height);
  }
}
