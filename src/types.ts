import type { Response } from "express"

export interface FileMetaData {
    id: string
    name: string
    path: string
    type: "image" | "video"
    date: Date
    size: number
    ext: string
    isAnimated: boolean
}

export type ClientFileMetadata = Pick<FileMetaData, "id" | "name" | "type" | "date" | "size" | "isAnimated">

export interface SseClient {
    id: number
    res: Response
}

export interface Result<T, S> {
    result?: T
    error?: S
}

export interface ServerConfig {
    galleryDir: string,
    address: string,
    port: number,
    thumbSize: number,
    imgCacheThreshold: number,
    diskConcurrency: number,
    ffmpegPath: string | null
}

export interface DefaultConfig {
    DIRECTORY: string,
    THUMBS_DIR: string,
    ADDRESS: string,
    PORT: number,

    THUMB_SIZE: number,
    IMG_CACHE_THRESHOLD: number,
    DISK_CONCURRENCY: number
}