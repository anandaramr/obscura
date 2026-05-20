import type { Response } from "express"

export interface FileMetaData {
    id: string
    name: string
    path: string
    type: "image" | "video"
    date: Date
    size: number
    ext: string
}

export type ClientFileMetadata = Pick<FileMetaData, "id" | "name" | "type" | "date" | "size">

export interface SseClient {
    id: number
    res: Response
}

export interface Result<T, S> {
    result?: T
    error?: S
}
