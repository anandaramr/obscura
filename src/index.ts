#!/usr/bin/env node

import dotenv from "dotenv"
dotenv.config({ quiet: true })

import path from "path"
import pLimit from "p-limit"
import { Command } from "commander"

import manifest from "../package.json" with { type: "json" }
import {
    defaults,
    getFfmpegPath,
    parseAddress,
    parseDirectory,
    parseDiskConcurrency,
    parsePort,
    PROJECT_ROOT
} from "./config.js"

import startServer from "./server.js"
import { emptyCache, getCacheSize, THUMBS_DIR, shouldAvoidCaching, getThumbPath } from "./cache.js"
import { bytesToString } from "./utils.js"
import { getFiles } from "./file.js"
import { generateImageThumbnail, generateVideoThumbnail } from "./thumbnail.js"
import type { FileMetaData, ServerConfig } from "./types.js"

const program = new Command()

program
    .name("obscura")
    .description("Lightweight self-hosted media gallery server for local networks")
    .version(manifest.version, "-v, --version", "output the version number")

program
    .argument("[directory]", "Directory to serve", process.env.DIRECTORY ?? defaults.DIRECTORY)
    .option("-a, --address <ip>", "Address to bind to", process.env.ADDRESS ?? defaults.ADDRESS)
    .option(
        "-p, --port <number>",
        "Port to listen to",
        process.env.PORT ?? defaults.PORT.toString()
    )
    .option(
        "--disk-concurrency <number>",
        "Maximum number of concurrent disk operations",
        process.env.DISK_CONCURRENCY ?? defaults.DISK_CONCURRENCY.toString()
    )
    .action(async (directory, options) => {
        const galleryDir = parseDirectory(directory)
        const port = parsePort(options.port)
        const diskConcurrency = parseDiskConcurrency(options.diskConcurrency)
        const address = parseAddress(options.address)
        const ffmpegPath = await getFfmpegPath()

        try {
            const config: ServerConfig = {
                galleryDir: galleryDir,
                address: address,
                port: port,
                thumbSize: defaults.THUMB_SIZE,
                imgCacheThreshold: defaults.IMG_CACHE_THRESHOLD,
                diskConcurrency: diskConcurrency,
                ffmpegPath: ffmpegPath
            }

            const close = await startServer(config)

            process.on("SIGINT", async () => {
                await close()
                process.exit(0)
            })
        } catch (error) {
            console.error(`\x1b[31m[Obscura Startup Error]`)
            console.error(`> ${error}\x1b[0m`)
            process.exit(1)
        }
    })

const cache = program.command("cache").description("Manage and inspect the application cache")

cache
    .command("stats")
    .description("Show cache usage and storage statistics")
    .action(async () => {
        console.log(`Cache directory: \x1b[36m${THUMBS_DIR}\x1b[0m`)

        const cacheSize = await getCacheSize()
        console.log(`Cache size: ${bytesToString(cacheSize)}`)
    })

cache
    .command("clean")
    .description("Clear the cache directory")
    .action(async () => {
        try {
            const clearedBytes = await emptyCache()
            console.log(`Cache cleaned (Freed ${bytesToString(clearedBytes)})`)
        } catch (e) {
            console.log(`Error encountered: ${e}`)
        }
    })

program
    .command("index")
    .description("Index directory")
    .argument("[directory]", "Directory to be indexed", ".")
    .action(async dir => {
        const directory = path.resolve(PROJECT_ROOT, dir)
        const diskConcurrency = parseDiskConcurrency(
            process.env.DISK_CONCURRENCY || String(defaults.DISK_CONCURRENCY)
        )
        const limit = pLimit(diskConcurrency)
        const start = Date.now()

        let files = await getFiles(directory)
        const totalFiles = files.length

        files = files.filter(f => !shouldAvoidCaching(f, defaults.IMG_CACHE_THRESHOLD))
        const filesToBeCached = files.length

        console.log(`Found ${totalFiles} files (${filesToBeCached} to be cached)\n`)

        let completed = 0
        const ffmpegPath = await getFfmpegPath()
        const writer = progressWriter(100)
        const tasks = files.map(file =>
            limit(async () => {
                await cacheIfNecessary(file, ffmpegPath)
                completed++
                writer(completed, filesToBeCached)
            })
        )

        await Promise.all(tasks)
        process.stdout.write(`\x1b[2K\x1b[2A\x1b[2K\nIndexed ${totalFiles} files (${filesToBeCached} cached)\n`)
        console.log(`Completed in ${Date.now() - start} ms`)
    })

function progressWriter(interval: number) {
    let lastWriteTime = 0
    let lastValue = 0
    const INFINITY_SYMBOL = `\u221e`

    return (current: number, total: number) => {
        const now = Date.now()
        if (now - lastWriteTime < interval) return

        const perc = Math.round((current / total) * 100)
        const rate = (current - lastValue) / (now - lastWriteTime)
        const eta = rate !== 0 && lastValue > 3 ? ((total - current) / (rate * 1000)).toFixed(2) + 's' : INFINITY_SYMBOL
        
        const width = 30
        const bars = Math.floor(width * current / total)
        const progressBar = `[${"#".repeat(bars).padEnd(width)}]`
        
        process.stdout.write(`\x1b[2K${progressBar} ${current}/${total} (${perc}%) | ETA ${eta}\r`)
        lastWriteTime = now
        lastValue = current
    }
}

async function cacheIfNecessary(file: FileMetaData, ffmpegPath: string) {
    const thumbPath = getThumbPath(file.id)
    if (file.type === "image") {
        await generateImageThumbnail(file, thumbPath, defaults.THUMB_SIZE)
    } else {
        await generateVideoThumbnail(ffmpegPath, file, thumbPath, defaults.THUMB_SIZE)
    }
}

program.parse(process.argv)
