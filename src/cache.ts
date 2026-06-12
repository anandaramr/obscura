import path from "path"
import { fileURLToPath } from "url"
import fs from "fs/promises"
import { defaults } from "./config.js"

const __filename = fileURLToPath(import.meta.url)
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..")

export function getThumbsDir() {
    return path.resolve(PROJECT_ROOT, defaults.THUMBS_DIR)
}

export async function getCacheSize(): Promise<number> {
    const THUMBS_DIR = getThumbsDir()
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
    const THUMBS_DIR = getThumbsDir()
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
