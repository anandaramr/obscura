#!/usr/bin/env node

const express = require("express")
const os = require("os")
const chokidar = require("chokidar")
const pLimit = require("p-limit").default

require("dotenv").config({ quiet: true })

const path = require("path")
const fs = require("fs")
const sharp = require("sharp")
sharp.cache(false)

const { validateDirectory, parseFileMetadata, generateHash } = require("./file")
const {
    DEFAULT_PORT,
    DEFAULT_ADDRESS,
    DEFAULT_DIRECTORY,
    DEFAULT_THUMB_LIMIT,
    DEFAULT_THUMB_SIZE,
    DEFAULT_THUMB_THRESHOLD,
} = require("./defaults")
const logger = require("./logger")

const { generateImageThumbnail, generateVideoThumbnail } = require("./thumbnail")
const { insertSorted } = require("./utils")

const app = express()
app.use(express.json())
app.use(logger())
app.use(express.static(path.join(__dirname, "public")))

const GALLERY_DIR = path.resolve(process.cwd(), process.argv[2] || process.env.GALLERY_DIR || DEFAULT_DIRECTORY)
const ADDRESS = process.argv[3] || process.env.ADDRESS || DEFAULT_ADDRESS
const PORT = process.argv[4] || process.env.PORT || DEFAULT_PORT

const THUMB_THRESHOLD = process.env.THUMB_THRESHOLD || DEFAULT_THUMB_THRESHOLD
const THUMB_SIZE = process.env.THUMB_SIZE || DEFAULT_THUMB_SIZE
const THUMB_LIMIT = parseInt(process.env.THUMB_LIMIT) || DEFAULT_THUMB_LIMIT

const THUMBS_DIR = path.join(__dirname, "thumbs")
if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true })

const limit = pLimit(THUMB_LIMIT)

const { error } = validateDirectory(GALLERY_DIR)
if (error) {
    console.error(`\x1b[31m[Obscura Startup Error]\x1b[0m ${error}`)
    console.error(`Please provide a valid media directory path.`)
    process.exit(1)
}

let filesMap = new Map()
let sortedFiles = []

const watcher = chokidar.watch(GALLERY_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false,
})

let clients = []
let isBooting = true
function broadcastToUsers(action, fileData) {
    clients.forEach((client) => {
        client.res.write(`data: ${JSON.stringify({ action, file: fileData })}\n\n`)
    })
}

watcher.on("add", (filePath) => {
    const fileData = parseFileMetadata(filePath)
    if (!fileData) return

    const isExisting = filesMap.has(fileData.id)
    filesMap.set(fileData.id, fileData)

    if (isExisting) return
    const { id, name, type, date, size } = fileData
    const fileDataToSend = { id, name, type, date, size }
    insertSorted(sortedFiles, fileDataToSend, file => new Date(file.date).getTime(), (a, b) => b - a)

    if (isBooting) return
    broadcastToUsers("add", fileDataToSend)
})

watcher.on('unlink', (filePath) => {
    const fileId = generateHash(filePath)

    if (filesMap.has(fileId)) {
        filesMap.delete(fileId)
        sortedFiles = sortedFiles.filter(file => file.id !== fileId)
        broadcastToUsers('remove', { id: fileId })

        const thumbPath = path.join(THUMBS_DIR, `${fileId}.jpg`)
        fs.unlink(thumbPath, () => {}) 
    }
})

watcher.on('ready', () => {
    isBooting = false
})

app.get("/api/files", (req, res) => {
    res.json(
        sortedFiles.map(({ id, name, type, date, size }) => ({
            id,
            name,
            type,
            date,
            size,
        })),
    )
})

app.get("/api/files/:id", (req, res) => {
    const file = filesMap.get(req.params.id)
    if (!file) return res.sendStatus(404)
    res.sendFile(file.path)
})

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const clientId = Date.now()
    clients.push({ id: clientId, res })
    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId)
    })
})

app.get("/api/thumb/:id", async (req, res) => {
    const file = filesMap.get(req.params.id)
    if (!file) return res.sendStatus(404)

    if (file.type == "image" && file.ext !== ".gif" && file.size < THUMB_THRESHOLD) {
        if (file.ext !== ".webp") {
            return res.sendFile(file.path)
        }

        // handle animated .webp files
        try {
            const metadata = await sharp(file.path).metadata()
            if (!metadata.pages || metadata.pages === 1) return res.sendFile(file.path)
        } catch (err) {
            console.log(`Error reading metadata: ${err}`)
        }
    }

    const thumbPath = path.join(THUMBS_DIR, `${file.id}.jpg`)

    try {
        await limit(async () => {
            // check again after waiting in queue
            if (fs.existsSync(thumbPath)) return

            if (file.type === "image") {
                await generateImageThumbnail(file, thumbPath, THUMB_SIZE)
            } else {
                await generateVideoThumbnail(file, thumbPath, THUMB_SIZE)
            }
        })
        res.sendFile(path.resolve(thumbPath))
    } catch (err) {
        console.error(`Error while creating thumbnail: ${err}`)
        res.sendStatus(500)
    }
})

app.listen(PORT, ADDRESS, (error) => {
    if (error) {
        console.error(`\x1b[31m[Obscura Startup Error]\x1b[0m ${error.message}`)
        process.exit(1)
    }

    console.log(`Obscura running at ${ADDRESS}:${PORT}`)
    console.log(`Serving media from \x1b[36m${GALLERY_DIR}\x1b[0m\n`)

    const interfaces = os.networkInterfaces()
    Object.entries(interfaces).forEach(([name, addresses]) => {
        addresses
            ?.filter((addr) => addr.family === "IPv4")
            .forEach((addr) => {
                console.log(`- \x1b[36mhttp://${addr.address}:${PORT}\x1b[0m \t [${name}]`)
            })
    })

    console.log("\n")
})
