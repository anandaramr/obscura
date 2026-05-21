import type { Result, FileMetaData } from "./types.js"

import path from "path"
import fs from "fs"
import crypto from "crypto"
import sharp from "sharp"

const IMAGE_EXTS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".heic",
    ".heif",
    ".tiff",
    ".tif",
    ".avif",
]

const VIDEO_EXTS = [
    ".mp4",
    ".mov",
    ".mkv",
    ".webm",
    ".m4v",
    ".ts",
    ".mts",
    ".m2ts",
]

const ALWAYS_ANIMATED_EXTS = new Set([".gif"])
const SOMETIMES_ANIMATED = new Set([".webp", ".avif", ".png"])

export function validateDirectory(absoluteDirPath: string): Result<void, string> {
    if (!path.isAbsolute(absoluteDirPath)) {
        return { error: `Directory validation failed: not an absolute path` }
    }
    if (!fs.existsSync(absoluteDirPath)) {
        return { error: `Directory validation failed: directory not found` }
    }

    const stats = fs.statSync(absoluteDirPath)
    if (!stats.isDirectory()) {
        return { error: `Directory validation failed: not a directory` }
    }

    return {}
}

export async function parseFileMetadata(filePath: string): Promise<FileMetaData | null> {
    const basename = path.basename(filePath)
    const ext = path.extname(basename).toLowerCase()
    if (![...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext)) return null

    const stat = fs.statSync(filePath)

    let animated = false
    if (ALWAYS_ANIMATED_EXTS.has(ext)) animated = true
    else if (SOMETIMES_ANIMATED.has(ext)) animated = await isAnimated(filePath)

    return {
        id: generateHash(filePath),
        name: basename,
        path: filePath,
        type: IMAGE_EXTS.includes(ext) ? "image" : "video",
        date: stat.mtime,
        size: stat.size,
        ext: ext,
        isAnimated: animated,
    }
}

export function generateHash(fullPath: string) {
    return crypto.createHash("md5").update(fullPath).digest("hex")
}

async function isAnimated(filePath: string): Promise<boolean> {
    try {
        const metadata = await sharp(filePath).metadata()
        return (metadata.pages ?? 1) > 1
    } catch (_) {
        return false
    }
}
