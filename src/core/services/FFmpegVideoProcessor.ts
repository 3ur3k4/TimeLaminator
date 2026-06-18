import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { IVideoProcessor } from '../interfaces/IVideoProcessor';

// Single-threaded core: no SharedArrayBuffer / COOP+COEP requirement, so it
// works on any host without extra response-header configuration.
const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
const DECODE_FPS = 30;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return loadPromise;
}

function computeDownscaledSize(sourceWidth: number, sourceHeight: number, maxResolution: number) {
  if (maxResolution <= 0 || Math.max(sourceWidth, sourceHeight) <= maxResolution) {
    return { width: sourceWidth, height: sourceHeight };
  }
  const scale = maxResolution / Math.max(sourceWidth, sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

// Software decoder fallback for codecs the browser's native <video> element
// can't play (e.g. Apple ProRes .mov). Slower and requires a one-time ~30MB
// wasm core download, but works for anything ffmpeg itself can decode.
export class FFmpegVideoProcessor implements IVideoProcessor {
  async decode(file: File, maxResolution: number, onProgress: (progress: number) => void): Promise<ImageData[]> {
    const ffmpeg = await getFFmpeg();

    const dotIndex = file.name.lastIndexOf('.');
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex) : '.mov';
    const inputName = `input${ext}`;
    const probeName = 'probe.txt';
    const outputName = 'output.raw';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Note: this build's ffprobe entry point doesn't reliably report its
    // exit code via the returned status (observed -1 even on a clean,
    // fully-parseable run), so success is judged by whether probe.txt
    // actually contains the fields we need, not by the status code.
    await ffmpeg.ffprobe([
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'default=noprint_wrappers=1',
      inputName,
      '-o', probeName,
    ]).catch(() => {});

    let probeText = '';
    try {
      probeText = await ffmpeg.readFile(probeName, 'utf8') as string;
    } catch {
      // probe.txt wasn't written at all
    }
    await ffmpeg.deleteFile(probeName).catch(() => {});

    const sourceWidth = parseInt(/width=(\d+)/.exec(probeText)?.[1] ?? '', 10);
    const sourceHeight = parseInt(/height=(\d+)/.exec(probeText)?.[1] ?? '', 10);

    if (!sourceWidth || !sourceHeight) {
      await ffmpeg.deleteFile(inputName).catch(() => {});
      throw new Error("Could not read this video file. It may be corrupt or use a codec that isn't supported, even by the fallback decoder.");
    }

    const { width, height } = computeDownscaledSize(sourceWidth, sourceHeight, maxResolution);

    const progressHandler = ({ progress }: { progress: number }) => {
      onProgress(Math.min(1, Math.max(0, progress)));
    };
    ffmpeg.on('progress', progressHandler);

    let execStatus: number;
    try {
      execStatus = await ffmpeg.exec([
        '-i', inputName,
        '-vf', `fps=${DECODE_FPS},scale=${width}:${height}`,
        '-pix_fmt', 'rgba',
        '-f', 'rawvideo',
        outputName,
      ]);
    } finally {
      ffmpeg.off('progress', progressHandler);
    }

    if (execStatus !== 0) {
      await ffmpeg.deleteFile(inputName).catch(() => {});
      throw new Error("Fallback decoding failed. The codec may not be supported.");
    }

    const data = await ffmpeg.readFile(outputName) as Uint8Array;
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    const frameBytes = width * height * 4;
    const frameCount = Math.floor(data.length / frameBytes);
    const frames: ImageData[] = [];
    for (let i = 0; i < frameCount; i++) {
      const start = i * frameBytes;
      const slice = data.slice(start, start + frameBytes);
      frames.push(new ImageData(new Uint8ClampedArray(slice.buffer), width, height));
    }
    return frames;
  }
}
