import express from "express"
import cors from "cors"
import os from "os"
import chokidar from "chokidar"
import pLimit from "p-limit"

import path from "path"
import fs from "fs"

import { parseFileMetadata, generateHash } from "./file.js"
import logger from "./logger.js"

import { generateImageThumbnail, generateVideoThumbnail } from "./thumbnail.js"
import { getFfmpegPath } from "./lib/lib-ffmpeg.js"
import { insertSorted } from "./utils.js"
import type { ClientFileMetadata, FileMetaData, ServerConfig, SseClient } from "./types.js"

import { fileURLToPath } from "url"
import { getThumbsDir } from "./cache.js"
const __filename = fileURLToPath(import.meta.url)
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..")

function createApp() {
    const app = express()
    app.use(express.json())
    app.use(logger())
    app.use(cors())
    app.use(express.static(path.join(PROJECT_ROOT, "public")))
    return app
}

export default function startServer(config: ServerConfig) {
    const limit = pLimit(config.diskConcurrency)
    const THUMBS_DIR = getThumbsDir()
    if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true })

    let filesMap = new Map<string, FileMetaData>()
    let sortedFiles: ClientFileMetadata[] = []

    const watcher = chokidar.watch(config.galleryDir, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: false
    })

    let clients: SseClient[] = []
    function broadcastToUsers(action: string, fileData: Partial<ClientFileMetadata>) {
        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify({ action, file: fileData })}\n\n`)
        })
    }

    let isBooting = true
    watcher.on("add", async filePath => {
        const fileData = await parseFileMetadata(filePath)
        if (!fileData) return

        const isExisting = filesMap.has(fileData.id)
        filesMap.set(fileData.id, fileData)

        if (isExisting) return
        const { id, name, type, date, size, isAnimated } = fileData
        const clientFileData = { id, name, type, date, size, isAnimated }
        insertSorted(
            sortedFiles,
            clientFileData,
            file => new Date(file.date).getTime(),
            (a, b) => b - a
        )

        if (isBooting) return
        broadcastToUsers("add", clientFileData)
    })

    watcher.on("unlink", filePath => {
        const fileId = generateHash(filePath)

        if (filesMap.has(fileId)) {
            filesMap.delete(fileId)
            sortedFiles = sortedFiles.filter(file => file.id !== fileId)
            broadcastToUsers("remove", { id: fileId })

            const thumbPath = getThumbPath(THUMBS_DIR, fileId)
            fs.unlink(thumbPath, () => {})
        }
    })

    watcher.on("ready", () => {
        isBooting = false
    })

    const app = createApp()

    app.get("/api/files", (req, res) => {
        res.status(200).json(sortedFiles)
    })

    app.get("/api/files/:id", (req, res) => {
        const file = filesMap.get(req.params.id)
        if (!file) return res.sendStatus(404)
        res.sendFile(file.path)
    })

    app.get("/api/events", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
        res.flushHeaders()

        const clientId = Date.now()
        clients.push({ id: clientId, res })
        req.on("close", () => {
            clients = clients.filter(client => client.id !== clientId)
        })
    })

    app.get("/api/thumb/:id", async (req, res) => {
        const file = filesMap.get(req.params.id)
        if (!file) return res.sendStatus(404)

        if (shouldAvoidCaching(file, config.imgCacheThreshold)) {
            return res.sendFile(file.path)
        }

        const thumbPath = getThumbPath(THUMBS_DIR, file.id)

        try {
            await limit(async () => {
                if (fs.existsSync(thumbPath)) return

                if (file.type === "image") {
                    await generateImageThumbnail(file, thumbPath, config.thumbSize)
                } else {
                    const ffmpegPath = config.ffmpegPath || (await getFfmpegPath())
                    await generateVideoThumbnail(ffmpegPath, file, thumbPath, config.thumbSize)
                }
            })
            res.sendFile(path.resolve(thumbPath))
        } catch (err) {
            console.error(`Error while creating thumbnail: ${err}`)
            res.sendStatus(500)
        }
    })

    return new Promise<() => Promise<void>>((resolve, reject) => {
        const server = app.listen(config.port, config.address, error => {
            if (error) {
                reject(error)
                return
            }

            console.log(`Obscura running at ${config.address}:${config.port}`)
            console.log(`Serving media from \x1b[36m${config.galleryDir}\x1b[0m\n`)

            const isAllInterfaces = config.address === "0.0.0.0"
            if (!isAllInterfaces) {
                logAddress(config.address, config.port)
                return
            }

            const interfaces = os.networkInterfaces()
            Object.entries(interfaces).forEach(([name, addresses]) => {
                addresses
                    ?.filter(addr => addr.family === "IPv4")
                    .forEach(addr => {
                        logAddress(addr.address, config.port, name)
                    })
            })

            console.log("\n")

            resolve(() => {
                return new Promise(res => {
                    watcher.close().then(() => server.close(() => res()))
                })
            })
        })
    })
}

function logAddress(addr: string, port: number, name?: string) {
    const url = `http://${addr}:${port}`
    console.log(`- \x1b[36m${url.padEnd(30)}\x1b[0m ${name ? "[" + name + "]" : ""}`)
}

function getThumbPath(thumbsDir: string, fileId: string) {
    return path.join(thumbsDir, `${fileId}.jpg`)
}

function shouldAvoidCaching(file: FileMetaData, threshold: number) {
    return file.type == "image" && file.size < threshold && !file.isAnimated
}
