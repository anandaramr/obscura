import { InvalidArgumentError, InvalidOptionArgumentError } from "commander"
import path from "path"
import { validateDirectory } from "./file.js"

export const defaults = {
    DIRECTORY: ".",
    THUMBS_DIR: "thumbs",
    ADDRESS: "0.0.0.0",
    PORT: 4963,

    THUMB_SIZE: 400,
    IMG_CACHE_THRESHOLD: 1024 * 1024,
    DISK_CONCURRENCY: 3
}

export function parsePortOption(option: string) {
    const port = Number(option)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidOptionArgumentError(`Port should be a number between 1 and 65535`)
    }
    return port
}

export function parseDiskConcOption(option: string) {
    const diskConcurrency = Number(option)
    if (!Number.isInteger(diskConcurrency) || diskConcurrency < 1) {
        throw new InvalidOptionArgumentError(`Disk concurrency should be a number > 0`)
    }
    return diskConcurrency
}

export function parseDirArg(option: string) {
    const galleryDir = path.resolve(process.cwd(), option)
    const { error } = validateDirectory(galleryDir)
    if (error) {
        throw new InvalidArgumentError(error)
    }
    return galleryDir
}
