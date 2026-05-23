import type { FileMetaData } from "./types.js"

import { execFile } from "child_process"
import libSharp from "./lib/lib-sharp.js"
import ffmpeg from "ffmpeg-static"

const ffmpegPath = typeof ffmpeg === "string" ? ffmpeg : (ffmpeg as any).default

export function generateVideoThumbnail(file: FileMetaData, thumbPath: string, thumbSize: number) {
    return new Promise<void>((resolve, reject) => {
        execFile(
            ffmpegPath,
            [
                "-i",
                file.path,
                "-frames:v",
                "1",
                "-vf",
                `scale=${thumbSize}:${thumbSize}:force_original_aspect_ratio=increase,crop=${thumbSize}:${thumbSize}:(iw-${thumbSize})/2:(ih-${thumbSize})/2`,
                "-q:v",
                "2",
                thumbPath,
            ],
            (err, _stdout, _stderr) => {
                if (err) {
                    return reject(new Error(`ffmpeg error: ${err.message}`))
                }
                resolve()
            },
        )
    })
}

export async function generateImageThumbnail(file: FileMetaData, thumbPath: string, thumbSize: number) {
    await libSharp(file.path, { animated: false, page: 0 })
        .resize(thumbSize, thumbSize, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
}