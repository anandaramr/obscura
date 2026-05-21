let files = []
let isShuffled = false
let elementMap = new Map()

const VIDEO_CACHE_TTL = 60 * 1000
let cacheTTLMap = new Map()

function onVideoPlay(fileId) {
    clearTimeout(cacheTTLMap.get(fileId))
    cacheTTLMap.delete(fileId)
}

function onVideoPause(fileId, vid) {
    const timer = setTimeout(() => {
        vid.removeAttribute('src')
        vid.load()
        cacheTTLMap.delete(fileId)
    }, VIDEO_CACHE_TTL)

    cacheTTLMap.set(fileId, timer)
}

init()

async function init() {
    const res = await fetch('/api/files')
    files = await res.json()

    params = new URLSearchParams(window.location.search)
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
    const grid = document.getElementById('grid')

    if (data.action === 'add') {
        insertGridItem(data.file, grid, true)
    } else if (data.action === 'remove') {
        removeGridItem(data.file.id)
    }
}

function insertGridItem(file, grid, prepend = false) {
    const preview = document.createElement('a')

    preview.className = 'grid-item'
    preview.href = `/api/files/${file.id}`
    preview.id = file.id

    const media = document.createElement('img')
    media.src = `/api/thumb/${file.id}`
    media.loading = 'lazy'
    media.className = file.type === 'image' ? 'img' : 'video'
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
        vid.loop = true

        preview.appendChild(vid)

        preview.onmouseenter = () => {
            if (window.matchMedia('(min-width: 769px)').matches) {
                if (!vid.src) {
                    vid.src = `/api/files/${file.id}`
                    vid.load()
                }

                vid.classList.remove('fade')
                media.classList.add('fade')
                icon.classList.add('fade')

                onVideoPlay(file.id)
                vid.currentTime = 0
                vid.play().catch(err => console.log('Play interrupted:', err))
            }
        }

        preview.onmouseleave = () => {
            if (window.matchMedia('(min-width: 769px)').matches) {
                vid.pause()
                onVideoPause(file.id, vid)

                vid.classList.add('fade')
                media.classList.remove('fade')
                icon.classList.remove('fade')
            }
        }
    }

    if (prepend) {
        grid.prepend(preview)
    } else {
        grid.appendChild(preview)
    }
    elementMap.set(file.id, preview)
}

function removeGridItem(fileId) {
    const child = elementMap.get(fileId)
    if (child) {
        const grid = document.getElementById('grid')
        grid.removeChild(child)
        elementMap.delete(child)
        files = files.filter(f => f.id !== fileId)
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
