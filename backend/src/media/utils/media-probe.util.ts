import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

export interface ImageDimensions {
  width: number | null;
  height: number | null;
}

export interface VideoProbeResult {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export class MediaProbeUtil {
  /**
   * Read width/height from an image file. Returns nulls if metadata can't be read
   * (corrupt file, unsupported format) — dimensions are informational, not required.
   */
  static async probeImage(filePath: string): Promise<ImageDimensions> {
    try {
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
      };
    } catch (error) {
      console.error('Failed to probe image dimensions:', error);
      return { width: null, height: null };
    }
  }

  /**
   * Read width/height/duration from a video file via ffprobe.
   */
  static async probeVideo(filePath: string): Promise<VideoProbeResult> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) {
          console.error('Failed to probe video metadata:', err);
          resolve({ width: null, height: null, durationSeconds: null });
          return;
        }

        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        resolve({
          width: videoStream?.width ?? null,
          height: videoStream?.height ?? null,
          durationSeconds: data.format?.duration ?? null,
        });
      });
    });
  }
}
