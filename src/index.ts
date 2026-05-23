#!/usr/bin/env node

import dotenv from "dotenv"
dotenv.config({ quiet: true })

import { Command } from "commander"
import manifest from "../package.json" with { type: "json" }
import { defaults } from "./config.js"
import path from "path"
import { validateDirectory } from "./file.js"
import startServer from "./server.js"
import type { ServerConfig } from "./types.js"

const program = new Command()

program
    .name("obscura")
    .description("Lightweight self-hosted media gallery server for local networks")
    .version(manifest.version)

program
    .argument("[directory]", "Directory to serve", process.env.DIRECTORY ?? defaults.DIRECTORY)
    .option("-a, --address <ip>", "Address to bind to", process.env.ADDRESS ?? defaults.ADDRESS)
    .option("-p, --port <number>", "Port to listen to",  String(parseInt(process.env.PORT ?? `${defaults.PORT}`)))
    .action(async (directory, options) => {
        try {
            // Get absolute directory
            const galleryDir = path.resolve(process.cwd(), directory)
            const { error } = validateDirectory(galleryDir)
            if (error) {
                throw new Error(error)
            }

            const config: ServerConfig = {
                galleryDir: galleryDir,
                address: options.address,
                port: options.port,
                thumbSize: defaults.THUMB_SIZE,
                imgCacheThreshold: defaults.IMG_CACHE_THRESHOLD,
                diskConcurrency: parseInt(process.env.DISK_CONCURRENCY ?? '') || defaults.DISK_CONCURRENCY
            }

            const close = await startServer(config)

            process.on("SIGINT", async () => {
                await close()
                process.exit(0)
            })
        } catch (error) {
            console.error(`\x1b[31m[Obscura Startup Error]\x1b[0m`)
            console.error(error)
            process.exit(1)
        }
    })

program.parse(process.argv)