#!/usr/bin/env node

import dotenv from "dotenv"
dotenv.config({ quiet: true })

import { Command } from "commander"
import manifest from "../package.json" with { type: "json" }
import { defaults, parseAddress, parseDirectory, parseDiskConcurrency, parsePort } from "./config.js"
import startServer from "./server.js"
import type { ServerConfig } from "./types.js"

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

        try {
            const config: ServerConfig = {
                galleryDir: galleryDir,
                address: address,
                port: port,
                thumbSize: defaults.THUMB_SIZE,
                imgCacheThreshold: defaults.IMG_CACHE_THRESHOLD,
                diskConcurrency: diskConcurrency
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

program.parse(process.argv)
