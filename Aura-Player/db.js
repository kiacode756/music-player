const DB_NAME = "AuraPlayerDB";
const DB_VERSION = 2;
const STORE_NAME = "songs";

let db = null;
let openingPromise = null;


/* =========================
   OPEN DATABASE
========================= */

function openDatabase() {
    if (db) {
        return Promise.resolve(db);
    }

    if (openingPromise) {
        return openingPromise;
    }

    openingPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(
                new Error("IndexedDB is not supported by this browser.")
            );
            return;
        }

        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );

        request.onupgradeneeded = event => {
            const database = event.target.result;

            if (
                !database.objectStoreNames.contains(STORE_NAME)
            ) {
                database.createObjectStore(
                    STORE_NAME,
                    {
                        keyPath: "id",
                        autoIncrement: true
                    }
                );
            }
        };

        request.onsuccess = event => {
            db = event.target.result;

            db.onversionchange = () => {
                db.close();
                db = null;
            };

            resolve(db);
        };

        request.onerror = () => {
            reject(
                request.error ||
                new Error("Could not open Aura Player database.")
            );
        };

        request.onblocked = () => {
            console.warn(
                "Aura Player database upgrade is blocked by another tab."
            );
        };
    }).finally(() => {
        openingPromise = null;
    });

    return openingPromise;
}


/* =========================
   SAVE SONGS
========================= */

async function saveSongs(files) {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        const records = [];
        let requestCount = 0;

        files.forEach(file => {
            const record = {
                name: file.name,
                type: file.type || "audio/mpeg",
                size: file.size,
                lastModified: file.lastModified,
                blob: file,
                createdAt: Date.now()
            };

            const request = store.add(record);
            requestCount++;

            request.onsuccess = () => {
                records.push({
                    dbId: request.result,
                    kind: "file",
                    file
                });
            };

            request.onerror = () => {
                reject(
                    request.error ||
                    new Error("Could not save a song.")
                );
            };
        });

        transaction.oncomplete = () => {
            if (records.length !== requestCount) {
                reject(
                    new Error("Not all songs were saved.")
                );
                return;
            }

            records.sort(
                (a, b) => a.dbId - b.dbId
            );

            resolve(records);
        };

        transaction.onerror = () => {
            reject(
                transaction.error ||
                new Error("Could not save songs.")
            );
        };

        transaction.onabort = () => {
            reject(
                transaction.error ||
                new Error("Saving songs was aborted.")
            );
        };
    });
}


/* =========================
   LOAD ALL SONGS
========================= */

async function loadSongs() {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readonly"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        const request = store.getAll();

        request.onsuccess = () => {
            const records = request.result || [];

            records.sort(
                (a, b) => a.id - b.id
            );

            const entries = records.map(record => {
                const file = new File(
                    [record.blob],
                    record.name,
                    {
                        type:
                            record.type ||
                            record.blob?.type ||
                            "audio/mpeg",
                        lastModified:
                            record.lastModified ||
                            Date.now()
                    }
                );

                return {
                    dbId: record.id,
                    kind: "file",
                    file
                };
            });

            resolve(entries);
        };

        request.onerror = () => {
            reject(
                request.error ||
                new Error("Could not load saved songs.")
            );
        };
    });
}


/* =========================
   DELETE SONG
========================= */

async function deleteSong(dbId) {
    if (dbId == null) {
        return;
    }

    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        store.delete(dbId);

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(
                transaction.error ||
                new Error("Could not delete the song.")
            );
        };

        transaction.onabort = () => {
            reject(
                transaction.error ||
                new Error("Deleting the song was aborted.")
            );
        };
    });
}


/* =========================
   CLEAR ALL SONGS
========================= */

async function clearSongs() {
    await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store = transaction.objectStore(
            STORE_NAME
        );

        store.clear();

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(
                transaction.error ||
                new Error("Could not clear the playlist database.")
            );
        };

        transaction.onabort = () => {
            reject(
                transaction.error ||
                new Error("Clearing the playlist was aborted.")
            );
        };
    });
}
