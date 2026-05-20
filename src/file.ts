import type { Result, FileMetaData } from './types.js'

import path from "path"
import fs from "fs"
import crypto from "crypto"

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"]
const VIDEO_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm"]

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

    return {  }
}

export function parseFileMetadata(filePath: string): FileMetaData | null {
    const basename = path.basename(filePath)
    const ext = path.extname(basename).toLowerCase()
    if (![...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext)) return null

    const stat = fs.statSync(filePath)
    return {
        id: crypto.createHash("md5").update(filePath).digest("hex"),
        name: basename,
        path: filePath,
        type: IMAGE_EXTS.includes(ext) ? "image" : "video",
        date: stat.mtime,
        size: stat.size,
        ext: ext,
    }
}

export function generateHash(fullPath: string) {
    return crypto.createHash("md5").update(fullPath).digest("hex")
}