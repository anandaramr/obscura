import path from "path"
import fs from "fs/promises"
import { defaults, PROJECT_ROOT } from "./config.js"
import type { FileMetaData } from "./types.js"

export const THUMBS_DIR = path.resolve(PROJECT_ROOT, defaults.THUMBS_DIR)

export async function getCacheSize(): Promise<number> {
    let totalSize = 0
    let files

    try {
        files = await fs.readdir(THUMBS_DIR, { withFileTypes: true })
    } catch (e) {
        if (compareErrorCode(e, "ENOENT")) return 0
        throw e
    }

    for (const file of files) {
        const fullPath = path.join(THUMBS_DIR, file.name)
        const stats = await fs.stat(fullPath)
        totalSize += stats.size
    }

    return totalSize
}

export async function emptyCache() {
    let totalSize = 0
    let files

    try {
        files = await fs.readdir(THUMBS_DIR)
    } catch (e) {
        if (compareErrorCode(e, "ENOENT")) return 0
        throw e
    }

    for (const file of files) {
        const fullPath = path.join(THUMBS_DIR, file)
        const stats = await fs.stat(fullPath)

        totalSize += stats.size
        await fs.rm(fullPath, { force: true })
    }

    return totalSize
}

function compareErrorCode(e: unknown, code: string): boolean {
    if (typeof e === "object" && e !== null && "code" in e) {
        const err = e as { code: string }
        if (err.code === code) {
            return true
        }
    }

    return false
}

export function shouldAvoidCaching(file: FileMetaData, threshold: number) {
    return file.type == "image" && file.size < threshold && !file.isAnimated
}

export function getThumbPath(fileId: string) {
    return path.join(THUMBS_DIR, `${fileId}.jpg`)
}
