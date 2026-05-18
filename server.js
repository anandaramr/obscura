#!/usr/bin/env node

const express = require("express")
const os = require("os")
const pLimit = require("p-limit").default
require("dotenv").config({ quiet: true })

const path = require("path")
const sharp = require("sharp")
const fs = require("fs")
const ffmpegPath = require("ffmpeg-static")
const { execFile } = require("child_process")

const { scanDir } = require("./file")
const {
    DEFAULT_PORT,
    DEFAULT_ADDRESS,
    DEFAULT_DIRECTORY,
    DEFAULT_THUMB_LIMIT,
    DEFAULT_THUMB_SIZE,
    DEFAULT_THUMB_THRESHOLD,
} = require("./defaults")
const logger = require("./logger")

const app = express()
app.use(express.static(path.join(__dirname, "public")))
app.use(express.json())
app.use(logger())

const GALLERY_DIR = process.argv[2] || process.env.GALLERY_DIR || DEFAULT_DIRECTORY
const ADDRESS = process.argv[3] || process.env.ADDRESS || DEFAULT_ADDRESS
const PORT = process.argv[4] || process.env.PORT || DEFAULT_PORT

const THUMB_THRESHOLD = process.env.THUMB_THRESHOLD || DEFAULT_THUMB_THRESHOLD
const THUMB_SIZE = process.env.THUMB_SIZE || DEFAULT_THUMB_SIZE
const THUMB_LIMIT = parseInt(process.env.THUMB_LIMIT) || DEFAULT_THUMB_LIMIT

const THUMBS_DIR = path.join(__dirname, "thumbs")
if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true })

const limit = pLimit(THUMB_LIMIT)

let filesMap
try {
    filesMap = scanDir(GALLERY_DIR)
} catch (err) {
    console.error(`\x1b[31m[Obscura Startup Error]:\x1b[0m ${error.message}`)
    console.error(`Please provide a valid media directory path.`)
    process.exit(1)
}

app.get("/api/files", (req, res) => {
    const sortedFiles = [...filesMap.values()].sort((a, b) => new Date(a.date) - new Date(b.date))
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

app.get("/api/thumb/:id", async (req, res) => {
    const file = filesMap.get(req.params.id)
    if (!file) return res.sendStatus(404)

    if (file.type == "image" && file.size < THUMB_THRESHOLD) {
        return res.sendFile(file.path)
    }

    const thumbPath = path.join(THUMBS_DIR, `${file.id}.jpg`)
    if (fs.existsSync(thumbPath)) {
        return res.sendFile(path.resolve(thumbPath))
    }

    try {
        await limit(async () => {
            // check again after waiting in queue
            if (fs.existsSync(thumbPath)) return

            if (file.type === "image") {
                await generateImageThumbnail(file, thumbPath)
            } else {
                await generateVideoThumbnail(file, thumbPath)
            }
        })
        res.sendFile(path.resolve(thumbPath))
    } catch (err) {
        console.error(`Error while creating thumbnail: ${err}`)
        res.sendStatus(500)
    }
})

const server = app.listen(PORT, ADDRESS, () => {
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

function generateVideoThumbnail(file, thumbPath) {
    return new Promise((resolve, reject) => {
        execFile(
            ffmpegPath,
            [
                "-i",
                file.path,
                "-frames:v",
                "1",
                "-vf",
                `scale=${THUMB_SIZE}:${THUMB_SIZE}:force_original_aspect_ratio=increase,crop=${THUMB_SIZE}:${THUMB_SIZE}:(iw-${THUMB_SIZE})/2:(ih-${THUMB_SIZE})/2`,
                "-q:v",
                "2",
                thumbPath,
            ],
            (err) => {
                if (err) {
                    return reject(new Error(`ffmpeg error: ${err.message}`))
                }
                resolve()
            },
        )
    })
}

async function generateImageThumbnail(file, thumbPath) {
    await sharp(file.path, { animated: false, page: 0 })
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
}
