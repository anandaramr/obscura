let files = [];

init();

async function init() {
    const res = await fetch("/api/files");
    files = await res.json();
    renderGrids(files);
}

function renderGrids(files) {
    const grid = document.getElementById("grid");

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const div = document.createElement("a")

        div.className = "grid-item"
        div.href = `/api/files/${file.id}`
        
        if (file.type == "image") {
            div.innerHTML = `<img src="/api/thumb/${file.id}" class="img" loading="lazy">`;
        } else {
            div.innerHTML = `<img src="/api/thumb/${file.id}" class="video" loading="lazy">`;
            div.innerHTML += `<span class="play-icon">▶</span>`;
        }

        grid.appendChild(div);
    }
}