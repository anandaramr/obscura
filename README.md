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

To spin up Obscura, pass the path to your media gallery folder as the default argument:

```bash
obscura /path/to/your/media/gallery
```

### CLI Command Options

You can fully customize how the server binds, hosts, and reads from disk using flag configurations:

```bash
Usage: obscura [options] [directory]

Lightweight self-hosted media gallery server for local networks

Arguments:
  directory                    Directory to serve (default: ".")

Options:
  -v, --version                output the version number
  -a, --address <ip>           Address to bind to (default: "0.0.0.0")
  -p, --port <number>          Port to listen to (default: "4963")
  --disk-concurrency <number>  Maximum number of concurrent disk operations (default: "3")
  -h, --help                   display help for command
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