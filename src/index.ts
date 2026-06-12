#!/usr/bin/env node

import dotenv from "dotenv"
dotenv.config({ quiet: true })

import fs from "fs/promises"
import path from "path"
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
import { parseFileMetadata } from "./file.js"
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
        const start = Date.now()
        const ffmpegPath = await getFfmpegPath()
        await cacheDirectory(directory, ffmpegPath)
        console.log(`Completed in ${Date.now() - start} ms`)
    })

async function cacheDirectory(directory: string, ffmpegPath: string) {
    const files = await fs.readdir(directory)

    for (const entry of files) {
        const fullPath = path.resolve(directory, entry)
        const stat = await fs.lstat(fullPath)
        if (stat.isSymbolicLink()) continue

        if (stat.isDirectory()) {
            await cacheDirectory(fullPath, ffmpegPath)
        } else {
            const file = await parseFileMetadata(fullPath)
            if (!file) continue
            await cacheIfNecessary(file, ffmpegPath)
        }
    }
}

async function cacheIfNecessary(file: FileMetaData, ffmpegPath: string) {
    if (shouldAvoidCaching(file, defaults.IMG_CACHE_THRESHOLD)) {
        return
    }

    const thumbPath = getThumbPath(file.id)
    if (file.type === "image") {
        await generateImageThumbnail(file, thumbPath, defaults.THUMB_SIZE)
    } else {
        await generateVideoThumbnail(ffmpegPath, file, thumbPath, defaults.THUMB_SIZE)
    }
}

program.parse(process.argv)
