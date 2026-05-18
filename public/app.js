let files = []

init()

async function init() {
    const res = await fetch("/api/files")
    files = await res.json()
    renderGrids(files)
}

function renderGrids(files) {
    const grid = document.getElementById("grid")

    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const preview = document.createElement("a")

        preview.className = "grid-item"
        preview.href = `/api/files/${file.id}`

        const media = document.createElement("img")
        media.src = `/api/thumb/${file.id}`
        media.loading = "lazy"
        media.className = file.type === "image" ? "img" : "video"
        preview.appendChild(media)

        if (file.type != "image") {
            const icon = document.createElement("span")
            icon.className = "play-icon"

            const iconImg = document.createElement("img")
            iconImg.src = "/play_icon.svg"

            icon.appendChild(iconImg)
            preview.appendChild(icon)
        }

        grid.appendChild(preview)
    }
}
