import { ObscuraDom as ObscuraDomElement } from "./types/dom";
import { FileEvent } from "./types/event";
import { MediaFile } from "./types/media";

let files: MediaFile[] = [];
let isShuffled = false;
let elementMap = new Map();

const VIDEO_CACHE_TTL = 60 * 1000;
let cacheTTLMap = new Map();

let retryQueue: (() => void)[] = [];
window.addEventListener("connected", () => {
    if (retryQueue.length) {
        for (const retry of retryQueue) {
            retry();
        }
        retryQueue = [];
    }
});

init();

async function init() {
    const res = await fetch("/api/files");
    files = await res.json();

    const params = new URLSearchParams(window.location.search);
    isShuffled = params.has("shuffle");
    const fileList = isShuffled ? shuffleArray(files) : files;

    renderGrids(fileList);
    updateShuffledState(isShuffled);
}

function renderGrids(files: MediaFile[]) {
    const grid = getDomElementById("grid");

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        insertGridItem(file, grid);
    }
}

const eventSource = new EventSource("/api/events");

eventSource.onmessage = (evt) => {
    const data = JSON.parse(evt.data) as FileEvent;

    switch (data.action) {
        case "add":
            onAdd(data.file);
            break;
        case "remove":
            onRemove(data.file);
            break;
        case "update":
            onUpdate(data.file);
            break;
    }
};

function getDomElementById(id: string) {
    const grid = document.getElementById(id);
    if (!grid) {
        throw new DOMException("Couldn't find base element: grid");
    }
    return grid;
}

function onUpdate(file: MediaFile) {
    onRemove(file);
    onAdd(file);
}

function onRemove(file: MediaFile) {
    files = files.filter((f) => f.id !== file.id);
    removeGridItem(file.id);
}

function onAdd(file: MediaFile) {
    files.unshift(file);
    const grid = getDomElementById("grid");
    insertGridItem(file, grid, true);
}

eventSource.onopen = () => {
    window.dispatchEvent(new Event("connected"));
};

let previewWindow: ObscuraDomElement[] = [];
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                onVisible(entry.target);
            } else {
                if (previewWindow.includes(entry.target)) {
                    onEndOfVisibility(entry.target);
                }
            }
        });
    },
    { threshold: 1 },
);

function insertGridItem(file: MediaFile, grid: HTMLElement, prepend = false) {
    const preview = document.createElement("a");

    preview.className = "grid-item";
    preview.href = getFileSource(file.id, file.date);
    preview.id = file.id;
    preview.dataset.v = file.date;

    const media = document.createElement("img");
    media.src = getThumbSource(file.id, file.date);
    media.loading = "lazy";
    media.className = file.type === "image" ? "img" : "video";
    media.onerror = () => {
        if (!isServerReachable()) {
            retryQueue.push(() => {
                media.src = media.src;
            });
        }
    };
    preview.appendChild(media);

    if (file.type != "image") {
        const icon = document.createElement("span");
        icon.className = "play-icon";

        const iconImg = document.createElement("img");
        iconImg.src = "/assets/play_icon.svg";

        icon.appendChild(iconImg);
        preview.appendChild(icon);

        const vid = document.createElement("video");
        vid.preload = "none";
        vid.classList.add("video-preview", "fade");
        vid.muted = true;
        vid.loop = !isMobileDevice();

        preview.appendChild(vid);

        preview.onmouseenter = () => {
            if (!isMobileDevice()) {
                startVideoPreview(vid, file.id, file.date, media, icon);
            }
        };

        preview.onmouseleave = () => {
            if (!isMobileDevice()) {
                stopVideoPreview(vid, file.id, media, icon);
            }
        };
    } else if (file.isAnimated) {
        const icon = document.createElement("span");
        icon.className = "live-indicator";
        icon.innerText = "LIVE";
        preview.appendChild(icon);

        preview.onmouseenter = () => {
            if (!isMobileDevice()) {
                media.src = getFileSource(file.id, file.date);
            }
        };

        preview.onmouseleave = () => {
            if (!isMobileDevice()) {
                media.src = getThumbSource(file.id, file.date);
            }
        };
    }

    if (prepend) {
        grid.prepend(preview);
    } else {
        grid.appendChild(preview);
    }

    if (isMobileDevice() && file.type === "video") observer.observe(preview);
    elementMap.set(file.id, preview);
}

function getFileSource(fileId: string, date: string) {
    return `/api/files/${fileId}?v=${date}`;
}

function getThumbSource(fileId: string, date: string) {
    return `/api/thumb/${fileId}?v=${date}`;
}

function isServerReachable() {
    return eventSource.readyState === EventSource.OPEN;
}

function onVideoPlay(fileId: string) {
    clearTimeout(cacheTTLMap.get(fileId));
    cacheTTLMap.delete(fileId);
}

function onVideoPause(fileId: string, vid: HTMLVideoElement) {
    // Allow browser to free memory if the video hasn't been
    // played for a specified amount of time
    const timer = setTimeout(() => {
        vid.removeAttribute("src");
        vid.load();
        cacheTTLMap.delete(fileId);
    }, VIDEO_CACHE_TTL);

    cacheTTLMap.set(fileId, timer);
}

let currentPreview: ObscuraDomElement | null = null;
function onVisible(preview: ObscuraDomElement) {
    const vid = preview.getElementsByClassName(
        "video-preview",
    )[0] as HTMLVideoElement;
    if (!vid) return;

    addToPreviewWindow(preview);
    vid.onended = () => {
        const idx = previewWindow.indexOf(preview);
        if (previewWindow.length == 1) {
            vid.play().catch((reason: any) =>
                console.log(`Play interrupted: ${reason}`),
            );
            return;
        }

        stopMobilePreview(idx);
        startMobilePreview((idx + 1) % previewWindow.length);
    };

    if (!currentPreview) startMobilePreview(0);
}

const getPosition = (element: ObscuraDomElement) =>
    element.getBoundingClientRect().top;
function addToPreviewWindow(preview: ObscuraDomElement) {
    // inserts elements sorted according to their relative position
    // ASSUMES elements are added only during scroll and no elements
    // would be added between
    if (
        previewWindow.length &&
        getPosition(preview) < getPosition(previewWindow[0])
    ) {
        previewWindow.unshift(preview);
    } else {
        previewWindow.push(preview);
    }
}

function onEndOfVisibility(preview: ObscuraDomElement) {
    const idx = previewWindow.indexOf(preview);
    const isCurrentlyPlaying = currentPreview == preview;

    stopMobilePreview(idx);
    previewWindow.splice(idx, 1);
    if (isCurrentlyPlaying && previewWindow.length)
        startMobilePreview(idx % previewWindow.length);
}

function stopMobilePreview(idx: number) {
    const preview = previewWindow[idx];
    if (currentPreview != preview) return;

    const vid = preview.getElementsByClassName(
        "video-preview",
    )[0] as HTMLVideoElement;
    const media = preview.getElementsByClassName(
        "video",
    )[0] as HTMLImageElement;
    const icon = preview.getElementsByClassName("play-icon")[0];

    stopVideoPreview(vid, preview.id, media, icon);
    currentPreview = null;
}

function startMobilePreview(idx: number) {
    const preview = previewWindow[idx];
    currentPreview = preview;

    const vid = preview.getElementsByClassName(
        "video-preview",
    )[0] as HTMLVideoElement;
    if (!vid) return;

    const media = preview.getElementsByTagName("img")[0] as HTMLImageElement;
    const icon = preview.getElementsByTagName("span")[0];
    startVideoPreview(vid, preview.id, preview.dataset?.v || "", media, icon);
}

function stopVideoPreview(
    vid: HTMLVideoElement,
    id: string,
    media: HTMLImageElement,
    icon: Element,
) {
    vid.pause();
    onVideoPause(id, vid);

    vid.classList.add("fade");
    media.classList.remove("fade");
    icon.classList.remove("blink");
    icon.classList.remove("fade");
}

function startVideoPreview(
    vid: HTMLVideoElement,
    fileId: string,
    lastModified: string,
    media: HTMLImageElement,
    icon: Element,
) {
    icon.classList.add("blink");
    vid.addEventListener(
        "playing",
        () => {
            icon.classList.remove("blink");
            icon.classList.add("fade");
        },
        { once: true },
    );

    if (needsVideoLoading(vid)) {
        vid.src = getFileSource(fileId, lastModified);
        vid.load();
    }

    vid.classList.remove("fade");
    media.classList.add("fade");

    onVideoPlay(fileId);
    vid.currentTime = 0;
    vid.play().catch((reason: any) => console.log("Play interrupted:", reason));
}

function needsVideoLoading(vid: HTMLVideoElement) {
    return (
        !vid.src ||
        vid.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
        vid.error
    );
}

function isMobileDevice() {
    return !window.matchMedia("(min-width: 769px)").matches;
}

function removeGridItem(fileId: string) {
    const child = elementMap.get(fileId);
    if (child) {
        const grid = getDomElementById("grid");
        grid.removeChild(child);
        elementMap.delete(fileId);
    }
}

function shuffleGrid() {
    const shuffledIds = shuffleArray(files.map((f) => f.id));
    const grid = document.getElementById("grid") as ObscuraDomElement;
    grid.replaceChildren(
        ...shuffledIds.map((id) => elementMap.get(id)).filter(Boolean),
    );

    updateShuffledState(true);
}

function unShuffleGrid() {
    const grid = document.getElementById("grid") as ObscuraDomElement;
    grid.replaceChildren(
        ...files.map((f) => elementMap.get(f.id)).filter(Boolean),
    );
    updateShuffledState(false);
}

function updateShuffledState(newState: boolean) {
    isShuffled = newState;
    const button = getDomElementById("shuffle-btn");
    const url = new URL(window.location.toString());

    if (newState) {
        button.classList.add("active");
        button.classList.remove("inactive");
        url.searchParams.set("shuffle", "1");
    } else {
        button.classList.remove("active");
        button.classList.add("inactive");
        url.searchParams.delete("shuffle");
    }
    history.replaceState({ shuffle: newState }, "", url);
}

function toggleShuffle() {
    if (isShuffled) {
        unShuffleGrid();
    } else {
        shuffleGrid();
    }
}

function shuffleArray<T>(array: T[]): T[] {
    let copy = [...array];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
