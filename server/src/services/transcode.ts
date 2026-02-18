import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { config } from '../config.js';

interface TranscodeJob {
  clipId: string;
  filePath: string;
  startMs: number;
  endMs: number;
}

interface TranscodeResult {
  hlsPath: string;
  thumbnailPath: string;
}

// Simple concurrency-limited job queue
let activeJobs = 0;
const pendingJobs: Array<{ job: TranscodeJob; resolve: (r: TranscodeResult) => void; reject: (e: Error) => void }> = [];

function processQueue() {
  while (activeJobs < config.clips.maxConcurrentTranscodes && pendingJobs.length > 0) {
    const next = pendingJobs.shift()!;
    activeJobs++;
    executeTranscode(next.job)
      .then(next.resolve)
      .catch(next.reject)
      .finally(() => {
        activeJobs--;
        processQueue();
      });
  }
}

/** Queue a transcoding job */
export function queueTranscode(job: TranscodeJob): Promise<TranscodeResult> {
  return new Promise((resolve, reject) => {
    pendingJobs.push({ job, resolve, reject });
    processQueue();
  });
}

/** Execute FFmpeg transcoding to produce HLS output at multiple qualities */
async function executeTranscode(job: TranscodeJob): Promise<TranscodeResult> {
  const { clipId, filePath, startMs, endMs } = job;
  const durationMs = endMs - startMs;
  const outputDir = join(config.paths.clips, clipId);
  await mkdir(outputDir, { recursive: true });

  const startSec = (startMs / 1000).toFixed(3);
  const durationSec = (durationMs / 1000).toFixed(3);

  // Generate thumbnail from midpoint
  const midpointSec = ((startMs + durationMs / 2) / 1000).toFixed(3);
  const thumbnailPath = join(outputDir, 'thumb.jpg');
  await runFFmpeg([
    '-ss', midpointSec,
    '-i', filePath,
    '-vframes', '1',
    '-vf', 'scale=640:-2',
    '-y',
    thumbnailPath,
  ]);

  // Transcode to HLS with multiple quality variants
  // Using the ultrafast preset for initial speed as per PRD
  const args = [
    '-ss', startSec,
    '-t', durationSec,
    '-i', filePath,
    // Encoding settings
    ...getHwAccelArgs(),
    // 1080p variant
    '-map', '0:v:0', '-map', '0:a:0',
    '-c:v:0', 'libx264', '-preset', 'ultrafast', '-b:v:0', '5000k', '-maxrate:v:0', '5500k', '-bufsize:v:0', '10000k',
    '-vf:0', 'scale=-2:1080',
    // 720p variant
    '-map', '0:v:0', '-map', '0:a:0',
    '-c:v:1', 'libx264', '-preset', 'ultrafast', '-b:v:1', '2500k', '-maxrate:v:1', '2750k', '-bufsize:v:1', '5000k',
    '-vf:1', 'scale=-2:720',
    // 480p variant
    '-map', '0:v:0', '-map', '0:a:0',
    '-c:v:2', 'libx264', '-preset', 'ultrafast', '-b:v:2', '1000k', '-maxrate:v:2', '1100k', '-bufsize:v:2', '2000k',
    '-vf:2', 'scale=-2:480',
    // Audio for all streams
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    // HLS settings
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '0',
    '-hls_segment_type', 'mpegts',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    // Multi-variant output
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2',
    '-hls_segment_filename', join(outputDir, 'v%v/seg%d.ts'),
    join(outputDir, 'v%v/playlist.m3u8'),
  ];

  await runFFmpeg(args);

  return {
    hlsPath: clipId,
    thumbnailPath: `${clipId}/thumb.jpg`,
  };
}

function getHwAccelArgs(): string[] {
  switch (config.transcode.hardware) {
    case 'vaapi':
      return ['-hwaccel', 'vaapi', '-hwaccel_output_format', 'vaapi', '-vaapi_device', '/dev/dri/renderD128'];
    case 'nvenc':
      return ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'];
    case 'qsv':
      return ['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv'];
    case 'auto':
    case 'none':
    default:
      return [];
  }
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });
    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}
