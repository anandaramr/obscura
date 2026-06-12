let files = []
let isShuffled = false
let elementMap = new Map()

const VIDEO_CACHE_TTL = 60 * 1000
let cacheTTLMap = new Map()

let retryQueue = []
window.addEventListener('connected', () => {
    if (retryQueue.length) {
        for (const retry of retryQueue) {
            retry()
        }
        retryQueue = []
    }
})

init()

async function init() {
    const res = await fetch('/api/files')
    files = await res.json()

    const params = new URLSearchParams(window.location.search)
    isShuffled = params.has('shuffle')
    const fileList = isShuffled ? shuffleArray(files) : files

    renderGrids(fileList)
    updateShuffledState(isShuffled)
}

function renderGrids(files) {
    const grid = document.getElementById('grid')

    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        insertGridItem(file, grid)
    }
}

const eventSource = new EventSource('/api/events')

eventSource.onmessage = evt => {
    const data = JSON.parse(evt.data)

    if (data.action === 'add') {
        onAdd(data.file)
    } else if (data.action === 'remove') {
        onRemove(data.file.id)
    } else if (data.action === 'update') {
        onUpdate(data.file)
    }
}

function onUpdate(file) {
    onRemove(file.id)
    onAdd(file)
}

function onRemove(fileId) {
    files = files.filter(f => f.id !== fileId)
    removeGridItem(fileId)
}

function onAdd(file) {
    files.unshift(file)
    const grid = document.getElementById('grid')
    insertGridItem(file, grid, true)
}

eventSource.onopen = () => {
    window.dispatchEvent(new Event('connected'))
}

let previewWindow = []
const observer = new IntersectionObserver(
    entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                onVisible(entry.target)
            } else {
                if (previewWindow.includes(entry.target)) {
                    onEndOfVisibility(entry.target)
                }
            }
        })
    },
    { threshold: 1 }
)

function insertGridItem(file, grid, prepend = false) {
    const preview = document.createElement('a')

    preview.className = 'grid-item'
    preview.href = getFileSource(file)
    preview.id = file.id

    const media = document.createElement('img')
    media.src = getThumbSource(file)
    media.loading = 'lazy'
    media.className = file.type === 'image' ? 'img' : 'video'
    media.onerror = () => {
        if (!isServerReachable()) {
            retryQueue.push(() => {
                media.src = media.src
            })
        }
    }
    preview.appendChild(media)

    if (file.type != 'image') {
        const icon = document.createElement('span')
        icon.className = 'play-icon'

        const iconImg = document.createElement('img')
        iconImg.src = '/play_icon.svg'

        icon.appendChild(iconImg)
        preview.appendChild(icon)

        const vid = document.createElement('video')
        vid.preload = 'none'
        vid.classList.add('video-preview', 'fade')
        vid.muted = true
        vid.loop = !isMobileDevice()

        preview.appendChild(vid)

        preview.onmouseenter = () => {
            if (!isMobileDevice()) {
                startVideoPreview(vid, file, media, icon)
            }
        }

        preview.onmouseleave = () => {
            if (!isMobileDevice()) {
                stopVideoPreview(vid, file.id, media, icon)
            }
        }
    } else if (file.isAnimated) {
        const icon = document.createElement('span')
        icon.className = 'live-indicator'
        icon.innerText = 'LIVE'
        preview.appendChild(icon)

        preview.onmouseenter = () => {
            if (!isMobileDevice()) {
                media.src = getFileSource(file)
            }
        }

        preview.onmouseleave = () => {
            if (!isMobileDevice()) {
                media.src = getThumbSource(file)
            }
        }
    }

    if (prepend) {
        grid.prepend(preview)
    } else {
        grid.appendChild(preview)
    }

    if (isMobileDevice() && file.type === 'video') observer.observe(preview)
    elementMap.set(file.id, preview)
}

function getFileSource(file) {
    return `/api/files/${file.id}?v=${file.date}`
}

function getThumbSource(file) {
    return `/api/thumb/${file.id}?v=${file.date}`
}

function isServerReachable() {
    return eventSource.readyState === EventSource.OPEN
}

function onVideoPlay(fileId) {
    clearTimeout(cacheTTLMap.get(fileId))
    cacheTTLMap.delete(fileId)
}

function onVideoPause(fileId, vid) {
    // Allow browser to free memory if the video hasn't been
    // played for a specified amount of time
    const timer = setTimeout(() => {
        vid.removeAttribute('src')
        vid.load()
        cacheTTLMap.delete(fileId)
    }, VIDEO_CACHE_TTL)

    cacheTTLMap.set(fileId, timer)
}

let currentPreview = null
function onVisible(preview) {
    const vid = preview.getElementsByClassName('video-preview')[0]
    if (!vid) return

    addToPreviewWindow(preview)
    vid.onended = evt => {
        const idx = previewWindow.indexOf(preview)
        if (previewWindow.length == 1) {
            vid.play().catch(err => console.log(`Play interrupted: ${err}`))
            return
        }

        stopMobilePreview(idx)
        startMobilePreview((idx + 1) % previewWindow.length)
    }

    if (!currentPreview) startMobilePreview(0)
}

const getPosition = element => element.getBoundingClientRect().top
function addToPreviewWindow(preview) {
    // inserts elements sorted according to their relative position
    // ASSUMES elements are added only during scroll and no elements
    // would be added between
    if (previewWindow.length && getPosition(preview) < getPosition(previewWindow[0])) {
        previewWindow.unshift(preview)
    } else {
        previewWindow.push(preview)
    }
}

function onEndOfVisibility(preview) {
    const idx = previewWindow.indexOf(preview)
    const isCurrentlyPlaying = currentPreview == preview

    stopMobilePreview(idx)
    previewWindow.splice(idx, 1)
    if (isCurrentlyPlaying && previewWindow.length) startMobilePreview(idx % previewWindow.length)
}

function stopMobilePreview(idx) {
    const preview = previewWindow[idx]
    if (currentPreview != preview) return

    const vid = preview.getElementsByClassName('video-preview')[0]
    const media = preview.getElementsByClassName('video')[0]
    const icon = preview.getElementsByClassName('play-icon')[0]

    stopVideoPreview(vid, preview.id, media, icon)
    currentPreview = null
}

function startMobilePreview(idx) {
    const preview = previewWindow[idx]
    currentPreview = preview

    const vid = preview.getElementsByClassName('video-preview')[0]
    if (!vid) return

    const media = preview.getElementsByTagName('img')[0]
    const icon = preview.getElementsByTagName('span')[0]
    startVideoPreview(vid, preview.id, media, icon)
}

function stopVideoPreview(vid, id, media, icon) {
    vid.pause()
    onVideoPause(id, vid)

    vid.classList.add('fade')
    media.classList.remove('fade')
    icon.classList.remove('blink')
    icon.classList.remove('fade')
}

function startVideoPreview(vid, file, media, icon) {
    icon.classList.add('blink')
    vid.addEventListener(
        'playing',
        () => {
            icon.classList.remove('blink')
            icon.classList.add('fade')
        },
        { once: true }
    )

    if (needsVideoLoading(vid)) {
        vid.src = getFileSource(file)
        vid.load()
    }

    vid.classList.remove('fade')
    media.classList.add('fade')

    onVideoPlay(file.id)
    vid.currentTime = 0
    vid.play().catch(err => console.log('Play interrupted:', err))
}

function needsVideoLoading(vid) {
    return !vid.src || vid.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || vid.error
}

function isMobileDevice() {
    return !window.matchMedia('(min-width: 769px)').matches
}

function removeGridItem(fileId) {
    const child = elementMap.get(fileId)
    if (child) {
        const grid = document.getElementById('grid')
        grid.removeChild(child)
        elementMap.delete(fileId)
    }
}

function shuffleGrid() {
    const shuffledIds = shuffleArray(files.map(f => f.id))
    const grid = document.getElementById('grid')
    grid.replaceChildren(...shuffledIds.map(id => elementMap.get(id)).filter(Boolean))

    updateShuffledState(true)
}

function unShuffleGrid() {
    const grid = document.getElementById('grid')
    grid.replaceChildren(...files.map(f => elementMap.get(f.id)).filter(Boolean))
    updateShuffledState(false)
}

function updateShuffledState(newState) {
    isShuffled = newState
    const button = document.getElementById('shuffle-btn')
    const url = new URL(window.location)

    if (newState) {
        button.classList.add('active')
        button.classList.remove('inactive')
        url.searchParams.set('shuffle', '1')
    } else {
        button.classList.remove('active')
        button.classList.add('inactive')
        url.searchParams.delete('shuffle')
    }
    history.replaceState({ shuffle: newState }, '', url)
}

function toggleShuffle() {
    if (isShuffled) {
        unShuffleGrid()
    } else {
        shuffleGrid()
    }
}

function shuffleArray(array) {
    let copy = [...array]
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}
