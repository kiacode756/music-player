# Aura Player

A polished browser-based local music player built with HTML, CSS and vanilla JavaScript.

## Features

- Local audio file playback
- Persistent playlist using IndexedDB
- Playlist survives page/app restarts on the same browser profile and origin
- Remove individual songs
- Clear playlist
- Search playlist
- Previous / next
- Shuffle
- Repeat Off / All / One
- Progress and seeking
- Player volume and mute
- Drag & drop audio files
- ID3 metadata and embedded album art (via jsmediatags)
- Direct audio URL import
- Direct audio URL download + add to playlist when the remote server allows CORS and the user is authorized to use the file
- Keyboard shortcuts: Space, Left/Right arrows
- Responsive layout

## Local persistence

Aura Player stores imported audio files in the browser's IndexedDB database named `AuraPlayerDB`.

Closing or refreshing the app does not remove the saved playlist. The data is local to the current browser profile/origin. Clearing site data, private/incognito storage, or browser storage can remove it.

## Service-link policy

Aura Player does not rip or convert media from YouTube, Spotify or SoundCloud page URLs.

For SoundCloud, downloads are available only where the uploader has enabled the platform's official download feature and the user has the required access/sign-in. In that case, use the official SoundCloud download flow and then drag the downloaded audio file into Aura Player.

The URL importer can download direct audio-file URLs (for example an authorized `.mp3` URL) when the server permits CORS.

## Run

Use a local web server from the project directory. For example:

```powershell
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

Do not open `index.html` directly with `file://` when testing persistence.

## Next steps

- Electron desktop packaging
- Capacitor mobile packaging
- Media Session API integration
- Custom themes
- Equalizer UI
- Optional cloud sync
