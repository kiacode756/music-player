const audio = document.getElementById("audio");
const player = document.getElementById("player");
const albumArt = document.getElementById("albumArt");
const songTitle = document.getElementById("songTitle");
const artistText = document.getElementById("artist");
const playingIndicator = document.getElementById("playingIndicator");

const playButton = document.getElementById("play");
const previousButton = document.getElementById("previous");
const nextButton = document.getElementById("next");
const shuffleButton = document.getElementById("shuffle");
const repeatButton = document.getElementById("repeat");
const muteButton = document.getElementById("muteButton");
const volumeSlider = document.getElementById("volume");

const progress = document.getElementById("progress");
const currentTimeText = document.getElementById("currentTime");
const durationText = document.getElementById("duration");

const playlistElement = document.getElementById("playlist");
const playlistCount = document.getElementById("playlistCount");
const searchInput = document.getElementById("searchInput");

const fileInput = document.getElementById("fileInput");
const addMusicButton = document.getElementById("addMusic");
const clearPlaylistButton = document.getElementById("clearPlaylist");
const dropZone = document.getElementById("dropZone");

const importUrlButton = document.getElementById("importUrlButton");
const urlModal = document.getElementById("urlModal");
const closeUrlModal = document.getElementById("closeUrlModal");
const audioUrlInput = document.getElementById("audioUrlInput");
const addUrlButton = document.getElementById("addUrlButton");
const downloadUrlButton = document.getElementById("downloadUrlButton");
const openYoutube = document.getElementById("openYoutube");
const openSpotify = document.getElementById("openSpotify");
const openSoundcloud = document.getElementById("openSoundcloud");
const toast = document.getElementById("toast");

const DEFAULT_COVER = "assets/default-cover.svg";

let playlist = [];
let currentIndex = -1;
let currentFile = null;
let currentObjectUrl = null;
let artworkObjectUrl = null;
let playlistSearch = "";
let shuffleEnabled = false;
let repeatMode = "off";
let metadataRequestId = 0;
let lastVolume = 1;
let databaseReady = false;


/* =========================
   TOAST
========================= */

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


/* =========================
   FORMAT TIME
========================= */

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}


/* =========================
   FILE HELPERS
========================= */

function normalizeFiles(fileList) {
    return Array.from(fileList || []).filter(file => {
        return (
            file &&
            file.type &&
            file.type.startsWith("audio/")
        );
    });
}


/* =========================
   ADD FILES TO PLAYLIST
========================= */

async function addFilesToPlaylist(files, options = {}) {
    const {
        showMessage = true
    } = options;

    const audioFiles = normalizeFiles(files);

    if (audioFiles.length === 0) {
        if (showMessage) {
            showToast("No supported audio files found.");
        }

        return false;
    }

    try {
        await openDatabase();
        databaseReady = true;

        const entries = await saveSongs(
            audioFiles
        );

        const wasEmpty = playlist.length === 0;

        playlist.push(...entries);

        renderPlaylist();

        if (wasEmpty) {
            await loadSong(0);
        }

        if (showMessage) {
            showToast(
                `${audioFiles.length} song${
                    audioFiles.length === 1 ? "" : "s"
                } added`
            );
        }

        return true;
    } catch (error) {
        console.error(
            "Could not save songs:",
            error
        );

        showToast(
            "Could not save the songs to local storage."
        );

        return false;
    }
}


/* =========================
   URL CLEANUP
========================= */

function releaseObjectUrl() {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
}


function releaseArtworkUrl() {
    if (artworkObjectUrl) {
        URL.revokeObjectURL(artworkObjectUrl);
        artworkObjectUrl = null;
    }
}


/* =========================
   PLAYLIST COUNT
========================= */

function updatePlaylistCount() {
    const count = playlist.length;

    playlistCount.textContent =
        `${count} song${count === 1 ? "" : "s"}`;
}


/* =========================
   RENDER PLAYLIST
========================= */

function renderPlaylist() {
    playlistElement.innerHTML = "";

    updatePlaylistCount();

    let visibleCount = 0;

    playlist.forEach((entry, index) => {
        const file = entry.file;
        const name = file.name;

        if (
            playlistSearch &&
            !name.toLowerCase().includes(
                playlistSearch
            )
        ) {
            return;
        }

        visibleCount++;

        const item = document.createElement("div");

        item.className =
            `playlist-item${
                index === currentIndex
                    ? " active"
                    : ""
            }`;

        const title = document.createElement("span");
        title.className = "playlist-title";
        title.textContent = name;
        title.title = name;

        const removeButton = document.createElement("button");
        removeButton.className = "remove-song";
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.title = "Remove song";
        removeButton.setAttribute(
            "aria-label",
            `Remove ${name}`
        );

        removeButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                removeSong(index);
            }
        );

        item.append(
            title,
            removeButton
        );

        item.addEventListener(
            "click",
            () => loadSong(index)
        );

        playlistElement.appendChild(item);
    });

    if (
        visibleCount === 0 &&
        playlistSearch
    ) {
        const empty = document.createElement("div");
        empty.className = "playlist-empty";
        empty.textContent = "No songs found";
        playlistElement.appendChild(empty);
    }

    const activeItem =
        playlistElement.querySelector(".active");

    if (activeItem) {
        activeItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }
}


/* =========================
   LOAD SONG
========================= */

async function loadSong(
    index,
    autoplay = true
) {
    if (
        index < 0 ||
        index >= playlist.length
    ) {
        return;
    }

    currentIndex = index;
    currentFile = playlist[currentIndex].file;

    metadataRequestId++;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    releaseObjectUrl();
    releaseArtworkUrl();

    currentObjectUrl =
        URL.createObjectURL(
            currentFile
        );

    audio.src = currentObjectUrl;
    audio.volume =
        Number(
            volumeSlider.value
        );
    audio.muted = false;

    progress.value = 0;
    progress.max = 0;
    currentTimeText.textContent = "0:00";
    durationText.textContent = "0:00";

    songTitle.textContent =
        currentFile.name;
    artistText.textContent =
        "Unknown Artist";
    albumArt.src = DEFAULT_COVER;

    updateMuteIcon();
    renderPlaylist();
    readMetadata(
        currentFile,
        metadataRequestId
    );

    if (!autoplay) {
        return;
    }

    try {
        await audio.play();
    } catch {
        // Autoplay can be blocked; user can press Play.
    }
}


/* =========================
   REMOVE SONG
========================= */

async function removeSong(index) {
    if (
        index < 0 ||
        index >= playlist.length
    ) {
        return;
    }

    const entry = playlist[index];
    const removingCurrent =
        index === currentIndex;

    try {
        if (entry.dbId != null) {
            await deleteSong(entry.dbId);
        }
    } catch (error) {
        console.error(
            "Could not delete song from database:",
            error
        );

        showToast(
            "Could not remove the song from storage."
        );

        return;
    }

    playlist.splice(index, 1);

    if (playlist.length === 0) {
        resetPlayerUI();
        showToast("Playlist cleared");
        return;
    }

    if (removingCurrent) {
        const nextIndex =
            Math.min(
                index,
                playlist.length - 1
            );

        currentIndex = -1;

        await loadSong(nextIndex);
        return;
    }

    if (index < currentIndex) {
        currentIndex--;
    }

    renderPlaylist();
}


/* =========================
   RESET PLAYER UI
========================= */

function resetPlayerUI() {
    metadataRequestId++;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    releaseObjectUrl();
    releaseArtworkUrl();

    playlist = [];
    currentIndex = -1;
    currentFile = null;

    songTitle.textContent =
        "No Song Selected";
    artistText.textContent =
        "Unknown Artist";
    albumArt.src = DEFAULT_COVER;

    progress.value = 0;
    progress.max = 0;
    currentTimeText.textContent = "0:00";
    durationText.textContent = "0:00";

    playlistSearch = "";
    searchInput.value = "";

    player.classList.remove(
        "is-playing"
    );

    renderPlaylist();
    updateMuteIcon();
}


/* =========================
   CLEAR PLAYLIST
========================= */

async function clearPlaylist() {
    if (!playlist.length) {
        return;
    }

    try {
        await clearSongs();
        databaseReady = true;
        resetPlayerUI();
        showToast("Playlist cleared");
    } catch (error) {
        console.error(
            "Could not clear database:",
            error
        );

        showToast(
            "Could not clear the saved playlist."
        );
    }
}


/* =========================
   NEXT / SHUFFLE / REPEAT
========================= */

function getNextIndex(isAutomatic) {
    if (!playlist.length) {
        return -1;
    }

    if (
        shuffleEnabled &&
        playlist.length > 1
    ) {
        let nextIndex;

        do {
            nextIndex =
                Math.floor(
                    Math.random() *
                    playlist.length
                );
        } while (
            nextIndex === currentIndex
        );

        return nextIndex;
    }

    if (
        isAutomatic &&
        repeatMode === "one"
    ) {
        return currentIndex;
    }

    if (
        currentIndex <
        playlist.length - 1
    ) {
        return currentIndex + 1;
    }

    if (
        repeatMode === "all"
    ) {
        return 0;
    }

    if (!isAutomatic) {
        return 0;
    }

    return -1;
}


/* =========================
   MUTE ICON
========================= */

function updateMuteIcon() {
    const muted =
        audio.muted ||
        audio.volume === 0;

    muteButton.textContent =
        muted ? "🔇" : "🔊";

    muteButton.title =
        muted ? "Unmute" : "Mute";

    muteButton.setAttribute(
        "aria-label",
        muted ? "Unmute" : "Mute"
    );
}


/* =========================
   REPEAT BUTTON
========================= */

function updateRepeatButton() {
    const active =
        repeatMode !== "off";

    repeatButton.classList.toggle(
        "active",
        active
    );

    repeatButton.setAttribute(
        "aria-pressed",
        String(active)
    );

    repeatButton.textContent =
        repeatMode === "one"
            ? "↻¹"
            : "↻";

    repeatButton.title =
        `Repeat: ${
            repeatMode === "off"
                ? "Off"
                : repeatMode === "all"
                    ? "All"
                    : "One"
        }`;
}


/* =========================
   METADATA
========================= */

function readMetadata(file, requestId) {
    if (
        typeof jsmediatags ===
        "undefined"
    ) {
        return;
    }

    jsmediatags.read(
        file,
        {
            onSuccess: tag => {
                if (
                    requestId !==
                    metadataRequestId
                ) {
                    return;
                }

                if (
                    file !== currentFile
                ) {
                    return;
                }

                const tags =
                    tag.tags || {};

                songTitle.textContent =
                    tags.title?.trim() ||
                    file.name;

                artistText.textContent =
                    tags.artist?.trim() ||
                    "Unknown Artist";

                if (tags.picture) {
                    const picture =
                        tags.picture;

                    const bytes =
                        new Uint8Array(
                            picture.data
                        );

                    const blob =
                        new Blob(
                            [bytes],
                            {
                                type:
                                    picture.format ||
                                    "image/jpeg"
                            }
                        );

                    releaseArtworkUrl();

                    artworkObjectUrl =
                        URL.createObjectURL(
                            blob
                        );

                    albumArt.src =
                        artworkObjectUrl;
                }
            },

            onError: error => {
                console.warn(
                    "Metadata read failed:",
                    error
                );
            }
        }
    );
}


/* =========================
   URL MODAL
========================= */

function openUrlModal() {
    urlModal.classList.remove(
        "hidden"
    );

    urlModal.setAttribute(
        "aria-hidden",
        "false"
    );

    audioUrlInput.focus();
}


function closeModal() {
    urlModal.classList.add(
        "hidden"
    );

    urlModal.setAttribute(
        "aria-hidden",
        "true"
    );
}


function getParsedUrl() {
    const rawUrl =
        audioUrlInput.value.trim();

    if (!rawUrl) {
        showToast("Enter a URL");
        return null;
    }

    try {
        return new URL(rawUrl);
    } catch {
        showToast("That URL is not valid");
        return null;
    }
}


function isPlatformUrl(url) {
    const hostname =
        url.hostname.toLowerCase();

    return {
        youtube:
            hostname.includes(
                "youtube.com"
            ) ||
            hostname.includes(
                "youtu.be"
            ),

        spotify:
            hostname.includes(
                "spotify.com"
            ),

        soundcloud:
            hostname.includes(
                "soundcloud.com"
            )
    };
}


function setProviderLinks(url) {
    const providers =
        isPlatformUrl(url);

    openYoutube.href =
        providers.youtube
            ? url.href
            : "#";

    openSpotify.href =
        providers.spotify
            ? url.href
            : "#";

    openSoundcloud.href =
        providers.soundcloud
            ? url.href
            : "#";
}


/* =========================
   DIRECT AUDIO URL IMPORT
========================= */

async function fetchAudioFile(url) {
    const response =
        await fetch(
            url.href,
            {
                mode: "cors"
            }
        );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}`
        );
    }

    const blob =
        await response.blob();

    const mime =
        blob.type || "";

    const extension =
        getExtensionFromUrl(
            url,
            mime
        );

    if (
        !mime.startsWith("audio/") &&
        !looksLikeAudioUrl(url)
    ) {
        throw new Error(
            "URL does not return an audio file"
        );
    }

    const lastPart =
        decodeURIComponent(
            url.pathname
                .split("/")
                .pop() ||
            "online-audio"
        );

    const baseName =
        lastPart
            .replace(
                /[^a-z0-9._ -]/gi,
                "_"
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim() ||
        "online-audio";

    const fileName =
        /\.[a-z0-9]{2,5}$/i.test(
            baseName
        )
            ? baseName
            : `${baseName}.${extension}`;

    return new File(
        [blob],
        fileName,
        {
            type:
                mime ||
                mimeFromExtension(
                    extension
                )
        }
    );
}


function looksLikeAudioUrl(url) {
    const path =
        url.pathname.toLowerCase();

    return /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)$/i.test(
        path
    );
}


function mimeFromExtension(extension) {
    const map = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        oga: "audio/ogg",
        m4a: "audio/mp4",
        aac: "audio/aac",
        flac: "audio/flac",
        webm: "audio/webm"
    };

    return (
        map[extension] ||
        "audio/mpeg"
    );
}


function getExtensionFromUrl(
    url,
    mime
) {
    const mimeMap = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/aac": "aac",
        "audio/flac": "flac",
        "audio/webm": "webm"
    };

    if (mimeMap[mime]) {
        return mimeMap[mime];
    }

    const match =
        url.pathname.match(
            /\.([a-z0-9]{2,5})$/i
        );

    return match
        ? match[1].toLowerCase()
        : "mp3";
}


async function addDirectAudioFromUrl(
    shouldDownload
) {
    const url =
        getParsedUrl();

    if (!url) {
        return;
    }

    const providers =
        isPlatformUrl(url);

    setProviderLinks(url);

    if (
        providers.youtube ||
        providers.spotify ||
        providers.soundcloud
    ) {
        showToast(
            "Use the platform's official download option, or provide an authorized direct audio URL."
        );

        return;
    }

    const button =
        shouldDownload
            ? downloadUrlButton
            : addUrlButton;

    const originalText =
        button.textContent;

    addUrlButton.disabled = true;
    downloadUrlButton.disabled = true;

    button.textContent =
        shouldDownload
            ? "Downloading..."
            : "Adding...";

    try {
        const file =
            await fetchAudioFile(
                url
            );

        const added =
            await addFilesToPlaylist(
                [file],
                {
                    showMessage: false
                }
            );

        if (!added) {
            return;
        }

        if (shouldDownload) {
            triggerDownload(file);
        }

        showToast(
            shouldDownload
                ? "Downloaded and added to playlist"
                : "Audio added from URL"
        );

        audioUrlInput.value = "";
        closeModal();
    } catch (error) {
        console.error(error);

        showToast(
            "Could not access that audio URL. CORS or server permissions may be blocking it."
        );
    } finally {
        addUrlButton.disabled = false;
        downloadUrlButton.disabled = false;
        button.textContent =
            originalText;
    }
}


function triggerDownload(file) {
    const url =
        URL.createObjectURL(file);

    const anchor =
        document.createElement("a");

    anchor.href = url;
    anchor.download = file.name;

    document.body.appendChild(
        anchor
    );

    anchor.click();
    anchor.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}


/* =========================
   UI EVENTS
========================= */

addMusicButton.addEventListener(
    "click",
    () => fileInput.click()
);

fileInput.addEventListener(
    "change",
    async () => {
        await addFilesToPlaylist(
            fileInput.files
        );

        fileInput.value = "";
    }
);

clearPlaylistButton.addEventListener(
    "click",
    clearPlaylist
);

searchInput.addEventListener(
    "input",
    () => {
        playlistSearch =
            searchInput.value
                .trim()
                .toLowerCase();

        renderPlaylist();
    }
);

playButton.addEventListener(
    "click",
    async () => {
        if (!currentFile) {
            return;
        }

        try {
            if (audio.paused) {
                await audio.play();
            } else {
                audio.pause();
            }
        } catch (error) {
            console.error(error);
            showToast(
                "Playback could not start"
            );
        }
    }
);

previousButton.addEventListener(
    "click",
    () => {
        if (!playlist.length) {
            return;
        }

        const previousIndex =
            currentIndex <= 0
                ? playlist.length - 1
                : currentIndex - 1;

        loadSong(previousIndex);
    }
);

nextButton.addEventListener(
    "click",
    () => {
        const nextIndex =
            getNextIndex(false);

        if (nextIndex !== -1) {
            loadSong(nextIndex);
        }
    }
);

shuffleButton.addEventListener(
    "click",
    () => {
        shuffleEnabled =
            !shuffleEnabled;

        shuffleButton.classList.toggle(
            "active",
            shuffleEnabled
        );

        shuffleButton.setAttribute(
            "aria-pressed",
            String(shuffleEnabled)
        );

        shuffleButton.title =
            shuffleEnabled
                ? "Shuffle: On"
                : "Shuffle: Off";
    }
);

repeatButton.addEventListener(
    "click",
    () => {
        repeatMode =
            repeatMode === "off"
                ? "all"
                : repeatMode === "all"
                    ? "one"
                    : "off";

        updateRepeatButton();
    }
);

muteButton.addEventListener(
    "click",
    () => {
        if (
            audio.muted ||
            audio.volume === 0
        ) {
            audio.muted = false;
            audio.volume =
                lastVolume || 1;

            volumeSlider.value =
                String(audio.volume);
        } else {
            lastVolume =
                audio.volume;

            audio.muted = true;
        }

        updateMuteIcon();
    }
);

volumeSlider.addEventListener(
    "input",
    () => {
        audio.volume =
            Number(volumeSlider.value);

        if (audio.volume > 0) {
            lastVolume =
                audio.volume;

            audio.muted = false;
        }

        updateMuteIcon();
    }
);

progress.addEventListener(
    "input",
    () => {
        if (
            Number.isFinite(
                audio.duration
            )
        ) {
            audio.currentTime =
                Number(
                    progress.value
                );
        }
    }
);

audio.addEventListener(
    "play",
    () => {
        playButton.textContent = "⏸";
        playButton.title = "Pause";
        playButton.setAttribute(
            "aria-label",
            "Pause"
        );

        player.classList.add(
            "is-playing"
        );
    }
);

audio.addEventListener(
    "pause",
    () => {
        playButton.textContent = "▶";
        playButton.title = "Play";
        playButton.setAttribute(
            "aria-label",
            "Play"
        );

        player.classList.remove(
            "is-playing"
        );
    }
);

audio.addEventListener(
    "loadedmetadata",
    () => {
        if (!Number.isFinite(audio.duration)) {
            progress.max = 0;
            progress.value = 0;
            currentTimeText.textContent = "0:00";
            durationText.textContent = "0:00";
            return;
        }

        progress.max =
            audio.duration;

        progress.value = 0;
        currentTimeText.textContent = "0:00";
        durationText.textContent =
            formatTime(audio.duration);
    }
);

audio.addEventListener(
    "timeupdate",
    () => {
        if (!Number.isFinite(audio.duration)) {
            return;
        }

        progress.value =
            audio.currentTime;

        currentTimeText.textContent =
            formatTime(
                audio.currentTime
            );
    }
);

audio.addEventListener(
    "ended",
    () => {
        const nextIndex =
            getNextIndex(true);

        if (nextIndex !== -1) {
            loadSong(nextIndex);
        }
    }
);


/* =========================
   DRAG & DROP
========================= */

function hasAudioItems(dataTransfer) {
    return Array.from(
        dataTransfer?.items || []
    ).some(item => {
        return (
            item.kind === "file" &&
            (
                item.type.startsWith("audio/") ||
                item.type === ""
            )
        );
    });
}

[
    "dragenter",
    "dragover"
].forEach(eventName => {
    dropZone.addEventListener(
        eventName,
        event => {
            event.preventDefault();

            if (
                hasAudioItems(
                    event.dataTransfer
                )
            ) {
                player.classList.add(
                    "drag-over"
                );

                event.dataTransfer.dropEffect =
                    "copy";
            }
        }
    );
});

dropZone.addEventListener(
    "dragleave",
    event => {
        if (
            !dropZone.contains(
                event.relatedTarget
            )
        ) {
            player.classList.remove(
                "drag-over"
            );
        }
    }
);

dropZone.addEventListener(
    "drop",
    event => {
        event.preventDefault();

        player.classList.remove(
            "drag-over"
        );

        addFilesToPlaylist(
            event.dataTransfer.files
        );
    }
);

document.addEventListener(
    "dragover",
    event => event.preventDefault()
);

document.addEventListener(
    "drop",
    event => {
        if (
            !player.contains(
                event.target
            )
        ) {
            event.preventDefault();
        }
    }
);


/* =========================
   URL MODAL EVENTS
========================= */

importUrlButton.addEventListener(
    "click",
    openUrlModal
);

closeUrlModal.addEventListener(
    "click",
    closeModal
);

urlModal.addEventListener(
    "click",
    event => {
        if (
            event.target.dataset.closeModal !==
            undefined
        ) {
            closeModal();
        }
    }
);

addUrlButton.addEventListener(
    "click",
    () => addDirectAudioFromUrl(false)
);

downloadUrlButton.addEventListener(
    "click",
    () => addDirectAudioFromUrl(true)
);

audioUrlInput.addEventListener(
    "input",
    () => {
        const rawUrl =
            audioUrlInput.value.trim();

        if (!rawUrl) {
            openYoutube.href = "#";
            openSpotify.href = "#";
            openSoundcloud.href = "#";
            return;
        }

        try {
            setProviderLinks(
                new URL(rawUrl)
            );
        } catch {
            openYoutube.href = "#";
            openSpotify.href = "#";
            openSoundcloud.href = "#";
        }
    }
);


/* =========================
   KEYBOARD SHORTCUTS
========================= */

document.addEventListener(
    "keydown",
    event => {
        if (
            event.key === "Escape" &&
            !urlModal.classList.contains(
                "hidden"
            )
        ) {
            closeModal();
        }

        if (
            event.target === searchInput ||
            event.target === audioUrlInput
        ) {
            return;
        }

        if (
            event.code === "Space"
        ) {
            event.preventDefault();
            playButton.click();
        }

        if (
            event.key === "ArrowRight"
        ) {
            if (
                currentFile &&
                Number.isFinite(
                    audio.duration
                )
            ) {
                audio.currentTime =
                    Math.min(
                        audio.duration,
                        audio.currentTime + 5
                    );
            }
        }

        if (
            event.key === "ArrowLeft"
        ) {
            if (
                currentFile &&
                Number.isFinite(
                    audio.duration
                )
            ) {
                audio.currentTime =
                    Math.max(
                        0,
                        audio.currentTime - 5
                    );
            }
        }
    }
);


/* =========================
   INITIALIZE PLAYER
========================= */

async function initializePlayer() {
    try {
        await openDatabase();
        databaseReady = true;

        playlist = await loadSongs();

        renderPlaylist();

        if (playlist.length) {
            await loadSong(
                0,
                false
            );
        }

        console.log(
            `Aura Player Database ready. Loaded ${playlist.length} saved song${playlist.length === 1 ? "" : "s"}.`
        );
    } catch (error) {
        databaseReady = false;

        console.error(
            "Database initialization failed:",
            error
        );

        showToast(
            "Local database is unavailable. Run the app through a local server."
        );

        renderPlaylist();
    }
}


/* =========================
   CLEANUP
========================= */

window.addEventListener(
    "beforeunload",
    () => {
        releaseObjectUrl();
        releaseArtworkUrl();
    }
);


updateMuteIcon();
updateRepeatButton();
initializePlayer();
