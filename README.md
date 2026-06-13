# Obscura

A self-hosted media gallery server for local networks. Given a directory, Obscura indexes your photos and videos, generates thumbnails, and exposes a web interface accessible to any device on the same network.

## Prerequisites

Before running Obscura, ensure you have the following software installed on your machine:

1. **Node.js** (v18.x or higher recommended)
2. **npm** (comes bundled with Node)

## Installation

You can install Obscura globally to invoke it directly from your terminal, or execute it directly using `npx`.

### Global Installation

```bash
npm install -g @anandaramr/obscura
```

> **Note:** Installation includes `ffmpeg-static` (~77MB), a bundled ffmpeg binary required for processing video thumbnails. If you already have ffmpeg installed on your system, you can skip it by running `npm install -g @anandaramr/obscura --no-optional` and set the `FFMPEG_PATH` environment variable to your ffmpeg binary path.

### Direct Execution (Without Installation)

```bash
npx @anandaramr/obscura [directory]
```

## Usage

### Starting the server

```bash
obscura [directory] [options]
```

Serves the specified directory (defaults to the current directory). Open the displayed URL on any device in your local network to browse the gallery.

```bash
obscura /path/to/media
obscura -p 8080                           # custom port
obscura -a 192.168.1.10 /path/to/media    # bind to specific interface
```

| Flag | Description | Default |
|------|-------------|---------|
| `-a, --address <ip>` | Address to bind to | `0.0.0.0` |
| `-p, --port <number>` | Port to listen on | `4963` |
| `--disk-concurrency <number>` | Max concurrent disk operations | `3` |
| `-v, --version` | Print version | |
| `-h, --help` | Show help | |

### Indexing a directory

Pre-build the cache for a directory. Useful for large libraries.

```bash
obscura index /path/to/media
obscura index /path/to/media --refresh   # rebuild, overwriting existing cache
```

| Flag | Description |
|------|-------------|
| `-r, --refresh` | Overwrite existing cache entries |

### Managing the cache

Inspect and manage the application cache.

```bash
obscura cache stats   # show cache size and storage statistics
obscura cache clean   # delete all cached data
```

## Environment Variables

Obscura natively honors standard system environment variables or values declared inside a local `.env` file at the root of the application directory:

| Environment Variable | Description |
| --- | --- |
| `DIRECTORY` | Absolute or relative path to target media directory |
| `ADDRESS` | Network IP address to bind server instance onto | 
| `PORT` | Local network port to open for the server instance |
| `DISK_CONCURRENCY` | Maximum allowed parallel disk I/O operational ceiling |
| `FFMPEG_PATH` | Path to ffmpeg binary (if it exists; unnecessary if installed without `--no-optional` flag) |

## API

Obscura exposes a REST API for building custom clients. See [API.md](./API.md) for full documentation.