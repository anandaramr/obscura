# Obscura API

Base URL: `/api`

All endpoints return JSON unless otherwise noted.

## Files

### List files
`GET /api/files`

Returns all files sorted by date descending.

**Response** `200 OK`
```json
[
  {
    "id": "4186824008a4299b7587c6902d00e6df",
    "name": "beach_volleyball.mp4",
    "type": "video",
    "date": "2026-05-25T22:15:30.000Z",
    "size": 45102080,
    "isAnimated": false
  },
  {
    "id": "4316e0adec899c7fdd40bb55d47900e4",
    "name": "sunset.jpg",
    "type": "image",
    "date": "2026-05-25T23:11:00.000Z",
    "size": 2048576,
    "isAnimated": false
  }
]
```

### Get file
`GET /api/files/:id`

Returns the raw file for rendering in the browser.

**Responses**
- `200` — raw file bytes
- `404` — file not found

## Thumbnails

### Get thumbnail
`GET /api/thumb/:id`

Returns a JPEG thumbnail for the file. Generated on first request and cached to disk. Images below the cache threshold are returned as-is without processing. Thumbnail generation is subject to the configured disk concurrency limit.

**Responses**
- `200` — JPEG thumbnail (or original file if below cache threshold)
- `404` — file not found
- `500` — thumbnail generation failed

## Events

### Subscribe to file changes
`GET /api/events`

Opens a server-sent events stream. Emits an event whenever a file is added or removed from the gallery directory. Reconnect and re-fetch `/api/files` if the connection drops.

**Event shape**
```json
{ "action": "add" | "remove", "file": { ...FileMetadata } }
```