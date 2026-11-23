from fastapi import FastAPI, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from urllib.parse import quote


app = FastAPI(title="Melodify API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Accept-Ranges",
        "Content-Range",
        "Content-Length",
        "Content-Type"
    ]
)


def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="melodify_db"
    )


MAX_AUDIO_SIZE = 25 * 1024 * 1024


class RegisterRequest(BaseModel):
    username: str = ""
    email: str = ""
    password: str = ""


class LoginRequest(BaseModel):
    email: str = ""
    password: str = ""


class LikedSongRequest(BaseModel):
    user_id: int | str | None = None
    song_title: str = ""
    artist: str = ""


class RemoveLikedSongRequest(BaseModel):
    user_id: int | str | None = None


class RecentSearchRequest(BaseModel):
    user_id: int | str | None = None
    search_query: str = ""


class PlaylistRequest(BaseModel):
    user_id: int | str | None = None
    name: str = ""


class PlaylistSongRequest(BaseModel):
    user_id: int | str | None = None
    song_id: int | None = None


@app.post("/api/register")
def register(data: RegisterRequest):

    username = data.username.strip()
    email = data.email.strip()
    password = data.password

    if not username or not email or not password:
        return JSONResponse(
            content={"message": "Punan ang lahat ng fields."},
            status_code=400
        )

    hashed_password = generate_password_hash(password)

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO users (username, email, password)
            VALUES (%s, %s, %s)
            """,
            (username, email, hashed_password)
        )

        connection.commit()

        return JSONResponse(
            content={"message": "Matagumpay ang registration!"},
            status_code=201
        )

    except mysql.connector.Error as error:
        print("Registration error:", error)

        return JSONResponse(
            content={
                "message": "Hindi na-save ang account. Baka nagamit na ang username o email."
            },
            status_code=400
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/login")
def login(data: LoginRequest):

    email = data.email.strip()
    password = data.password

    if not email or not password:
        return JSONResponse(
            content={"message": "Ilagay ang email at password."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT user_id, username, email, password
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        user = cursor.fetchone()

        if not user or not check_password_hash(user[3], password):
            return JSONResponse(
                content={"message": "Mali ang email o password."},
                status_code=401
            )

        return {
            "message": "Login Successful!",
            "user": {
                "user_id": user[0],
                "username": user[1],
                "email": user[2]
            }
        }

    except mysql.connector.Error as error:
        print("Login error:", error)

        return JSONResponse(
            content={"message": "May problema sa database."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/songs")
def get_songs(search: str = ""):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                song_id,
                title,
                artist,
                audio_url,
                created_at,
                audio_filename,
                audio_mime_type,
                audio_size,
                (audio_data IS NOT NULL) AS has_audio
            FROM songs
        """

        if search.strip():
            keyword = f"%{search.strip()}%"

            cursor.execute(
                query + """
                WHERE title LIKE %s
                   OR artist LIKE %s
                ORDER BY created_at DESC
                """,
                (keyword, keyword)
            )

        else:
            cursor.execute(
                query + """
                ORDER BY created_at DESC
                """
            )

        songs = cursor.fetchall()

        for song in songs:
            if song["has_audio"]:
                song["audio_url"] = (
                    f"/api/songs/{song['song_id']}/audio"
                )

            song["has_audio"] = bool(song["has_audio"])

        return {
            "songs": songs,
            "total": len(songs)
        }

    except mysql.connector.Error as error:
        print("Get songs error:", error)

        return JSONResponse(
            content={
                "message": "Hindi makuha ang songs mula sa database."
            },
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/songs/upload")
async def upload_song(
    file: UploadFile = File(...),
    title: str = Form(...),
    artist: str = Form(...)
):

    title = title.strip()
    artist = artist.strip()

    if not title or not artist:
        return JSONResponse(
            content={
                "message": "Song title and artist are required."
            },
            status_code=400
        )

    if len(title) > 150 or len(artist) > 150:
        return JSONResponse(
            content={"message": "Title or artist is too long."},
            status_code=400
        )

    filename = (file.filename or "").replace("\\", "/").split("/")[-1]

    if not filename.lower().endswith(".mp3"):
        await file.close()

        return JSONResponse(
            content={"message": "MP3 files only are allowed."},
            status_code=400
        )

    allowed_types = [
        "audio/mpeg",
        "audio/mp3",
        "application/octet-stream"
    ]

    if file.content_type and file.content_type not in allowed_types:
        await file.close()

        return JSONResponse(
            content={"message": "Invalid audio file type."},
            status_code=400
        )

    try:
        audio_bytes = await file.read(MAX_AUDIO_SIZE + 1)
    finally:
        await file.close()

    if not audio_bytes:
        return JSONResponse(
            content={"message": "The selected audio file is empty."},
            status_code=400
        )

    if len(audio_bytes) > MAX_AUDIO_SIZE:
        return JSONResponse(
            content={"message": "Maximum MP3 file size is 25 MB."},
            status_code=413
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT song_id
            FROM songs
            WHERE title = %s AND artist = %s
            LIMIT 1
            """,
            (title, artist)
        )

        existing_song = cursor.fetchone()

        if existing_song:
            return JSONResponse(
                content={
                    "message": "Nasa Melodify database na ang kantang ito.",
                    "song_id": existing_song["song_id"]
                },
                status_code=409
            )

        cursor.execute(
            """
            INSERT INTO songs (
                title,
                artist,
                audio_url,
                audio_data,
                audio_filename,
                audio_mime_type,
                audio_size
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                title,
                artist,
                "",
                audio_bytes,
                filename,
                "audio/mpeg",
                len(audio_bytes)
            )
        )

        new_song_id = cursor.lastrowid
        audio_url = f"/api/songs/{new_song_id}/audio"

        cursor.execute(
            """
            UPDATE songs
            SET audio_url = %s
            WHERE song_id = %s
            """,
            (audio_url, new_song_id)
        )

        connection.commit()

        return JSONResponse(
            content={
                "message": "Matagumpay na na-upload ang kanta sa Melodify!",
                "song_id": new_song_id,
                "audio_url": audio_url,
                "filename": filename,
                "size": len(audio_bytes)
            },
            status_code=201
        )

    except mysql.connector.Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("Upload song error:", error)

        return JSONResponse(
            content={
                "message": "Hindi na-save ang MP3 sa database."
            },
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/songs/{song_id}/audio")
def stream_song(
    song_id: int,
    range_header: str | None = Header(
        default=None,
        alias="Range"
    )
):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT audio_data, audio_mime_type, audio_filename
            FROM songs
            WHERE song_id = %s
            """,
            (song_id,)
        )

        song = cursor.fetchone()

        if not song or song["audio_data"] is None:
            return JSONResponse(
                content={"message": "Audio file not found."},
                status_code=404
            )

        audio_data = bytes(song["audio_data"])
        file_size = len(audio_data)

        if file_size == 0:
            return JSONResponse(
                content={"message": "Audio file is empty."},
                status_code=404
            )

        mime_type = song["audio_mime_type"] or "audio/mpeg"
        filename = song["audio_filename"] or f"song-{song_id}.mp3"

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Disposition": (
                "inline; filename*=UTF-8''" + quote(filename)
            ),
            "Cache-Control": "no-cache"
        }

        if not range_header:
            headers["Content-Length"] = str(file_size)

            return Response(
                content=audio_data,
                media_type=mime_type,
                headers=headers,
                status_code=200
            )

        if not range_header.startswith("bytes="):
            return Response(
                status_code=416,
                headers={
                    **headers,
                    "Content-Range": f"bytes */{file_size}"
                }
            )

        try:
            range_value = range_header[6:].strip()

            if "," in range_value:
                raise ValueError("Multiple ranges are not supported.")

            start_text, end_text = range_value.split("-", 1)

            if start_text:
                start = int(start_text)

                if start < 0 or start >= file_size:
                    raise ValueError("Invalid starting byte.")

                if end_text:
                    end = int(end_text)

                    if end < start:
                        raise ValueError("Invalid ending byte.")

                    end = min(end, file_size - 1)
                else:
                    end = file_size - 1

            else:
                suffix_length = int(end_text)

                if suffix_length <= 0:
                    raise ValueError("Invalid suffix length.")

                start = max(0, file_size - suffix_length)
                end = file_size - 1

        except (ValueError, TypeError):
            return Response(
                status_code=416,
                headers={
                    **headers,
                    "Content-Range": f"bytes */{file_size}"
                }
            )

        audio_chunk = audio_data[start:end + 1]

        headers["Content-Length"] = str(len(audio_chunk))
        headers["Content-Range"] = (
            f"bytes {start}-{end}/{file_size}"
        )

        return Response(
            content=audio_chunk,
            media_type=mime_type,
            headers=headers,
            status_code=206
        )

    except mysql.connector.Error as error:
        print("Stream song error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-play ang audio file."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/songs/{song_id}")
def get_song(song_id: int):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                song_id,
                title,
                artist,
                audio_url,
                created_at,
                audio_filename,
                audio_mime_type,
                audio_size,
                (audio_data IS NOT NULL) AS has_audio
            FROM songs
            WHERE song_id = %s
            """,
            (song_id,)
        )

        song = cursor.fetchone()

        if not song:
            return JSONResponse(
                content={
                    "message": "Hindi makita ang kantang hinahanap."
                },
                status_code=404
            )

        if song["has_audio"]:
            song["audio_url"] = f"/api/songs/{song_id}/audio"

        song["has_audio"] = bool(song["has_audio"])

        return {"song": song}

    except mysql.connector.Error as error:
        print("Get single song error:", error)

        return JSONResponse(
            content={"message": "Hindi makuha ang song."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/liked-songs")
def get_liked_songs(user_id: str = ""):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, user_id, song_title, artist, created_at
            FROM liked_songs
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (int(user_id),)
        )

        songs = cursor.fetchall()

        return {"liked_songs": songs}

    except mysql.connector.Error as error:
        print("Get liked songs error:", error)

        return JSONResponse(
            content={"message": "Hindi makuha ang liked songs."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/liked-songs")
def add_liked_song(data: LikedSongRequest):

    user_id = data.user_id
    song_title = data.song_title.strip()
    artist = data.artist.strip()

    if user_id is None or not str(user_id).isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    if not song_title or not artist:
        return JSONResponse(
            content={"message": "Song title and artist are required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO liked_songs (user_id, song_title, artist)
            VALUES (%s, %s, %s)
            """,
            (int(user_id), song_title, artist)
        )

        connection.commit()

        return JSONResponse(
            content={"message": "Song added to Liked Songs!"},
            status_code=201
        )

    except mysql.connector.IntegrityError:
        return JSONResponse(
            content={
                "message": "Nasa Liked Songs mo na ang kantang ito."
            },
            status_code=409
        )

    except mysql.connector.Error as error:
        print("Add liked song error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-save ang liked song."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/liked-songs/{song_id}")
def remove_liked_song(
    song_id: int,
    data: RemoveLikedSongRequest
):

    user_id = data.user_id

    if user_id is None or not str(user_id).isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM liked_songs
            WHERE id = %s AND user_id = %s
            """,
            (song_id, int(user_id))
        )

        connection.commit()

        if cursor.rowcount == 0:
            return JSONResponse(
                content={
                    "message": "Song not found in this user's Liked Songs."
                },
                status_code=404
            )

        return {
            "message": "Song removed from Liked Songs."
        }

    except mysql.connector.Error as error:
        print("Remove liked song error:", error)

        return JSONResponse(
            content={"message": "Hindi maalis ang liked song."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/recent-searches")
def get_recent_searches(user_id: str = ""):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, user_id, search_query, searched_at
            FROM recent_searches
            WHERE user_id = %s
            ORDER BY searched_at DESC
            LIMIT 10
            """,
            (int(user_id),)
        )

        searches = cursor.fetchall()

        return {
            "recent_searches": searches,
            "total": len(searches)
        }

    except mysql.connector.Error as error:
        print("Get recent searches error:", error)

        return JSONResponse(
            content={"message": "Hindi makuha ang recent searches."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/recent-searches")
def add_recent_search(data: RecentSearchRequest):

    user_id = data.user_id
    search_query = data.search_query.strip()

    if user_id is None or not str(user_id).isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    if not search_query:
        return JSONResponse(
            content={"message": "Search query is required."},
            status_code=400
        )

    if len(search_query) > 255:
        return JSONResponse(
            content={"message": "Search query is too long."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO recent_searches (user_id, search_query)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE
                searched_at = CURRENT_TIMESTAMP
            """,
            (int(user_id), search_query)
        )

        connection.commit()

        return JSONResponse(
            content={"message": "Search saved successfully."},
            status_code=201
        )

    except mysql.connector.Error as error:
        print("Save recent search error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-save ang recent search."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/recent-searches/{search_id}")
def delete_recent_search(
    search_id: int,
    user_id: str = ""
):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM recent_searches
            WHERE id = %s AND user_id = %s
            """,
            (search_id, int(user_id))
        )

        connection.commit()

        if cursor.rowcount == 0:
            return JSONResponse(
                content={"message": "Recent search not found."},
                status_code=404
            )

        return {
            "message": "Recent search deleted successfully."
        }

    except mysql.connector.Error as error:
        print("Delete recent search error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-delete ang recent search."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/recent-searches")
def clear_recent_searches(user_id: str = ""):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM recent_searches
            WHERE user_id = %s
            """,
            (int(user_id),)
        )

        connection.commit()

        return {
            "message": "Recent searches cleared successfully."
        }

    except mysql.connector.Error as error:
        print("Clear recent searches error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-clear ang recent searches."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/playlists")
def get_playlists(user_id: str = ""):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                p.playlist_id,
                p.user_id,
                p.playlist_name AS name,
                p.created_at,
                COUNT(ps.playlist_song_id) AS song_count
            FROM playlists p
            LEFT JOIN playlist_songs ps
                ON p.playlist_id = ps.playlist_id
            WHERE p.user_id = %s
            GROUP BY
                p.playlist_id,
                p.user_id,
                p.playlist_name,
                p.created_at
            ORDER BY p.created_at DESC
            """,
            (int(user_id),)
        )

        playlists = cursor.fetchall()

        return {
            "playlists": playlists,
            "total": len(playlists)
        }

    except mysql.connector.Error as error:
        print("Get playlists error:", error)

        return JSONResponse(
            content={"message": "Hindi makuha ang playlists."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/playlists")
def create_playlist(data: PlaylistRequest):

    user_id = data.user_id
    name = data.name.strip()

    if user_id is None or not str(user_id).isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    if not name:
        return JSONResponse(
            content={"message": "Playlist name is required."},
            status_code=400
        )

    if len(name) > 150:
        return JSONResponse(
            content={"message": "Playlist name is too long."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO playlists (user_id, playlist_name)
            VALUES (%s, %s)
            """,
            (int(user_id), name)
        )

        playlist_id = cursor.lastrowid
        connection.commit()

        return JSONResponse(
            content={
                "message": "Playlist created successfully!",
                "playlist_id": playlist_id,
                "user_id": int(user_id),
                "name": name
            },
            status_code=201
        )

    except mysql.connector.IntegrityError:
        return JSONResponse(
            content={
                "message": "May playlist ka nang kapareho ang pangalan."
            },
            status_code=409
        )

    except mysql.connector.Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("Create playlist error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-create ang playlist."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.put("/api/playlists/{playlist_id}")
def rename_playlist(
    playlist_id: int,
    data: PlaylistRequest
):

    user_id = data.user_id
    name = data.name.strip()

    if user_id is None or not str(user_id).isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    if not name or len(name) > 150:
        return JSONResponse(
            content={"message": "Invalid playlist name."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE playlists
            SET playlist_name = %s
            WHERE playlist_id = %s
              AND user_id = %s
            """,
            (name, playlist_id, int(user_id))
        )

        connection.commit()

        if cursor.rowcount == 0:
            cursor.execute(
                """
                SELECT playlist_id
                FROM playlists
                WHERE playlist_id = %s
                  AND user_id = %s
                """,
                (playlist_id, int(user_id))
            )

            if not cursor.fetchone():
                return JSONResponse(
                    content={"message": "Playlist not found."},
                    status_code=404
                )

        return {
            "message": "Playlist renamed successfully!",
            "name": name
        }

    except mysql.connector.IntegrityError:
        return JSONResponse(
            content={
                "message": "May playlist ka nang kapareho ang pangalan."
            },
            status_code=409
        )

    except mysql.connector.Error as error:
        print("Rename playlist error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-rename ang playlist."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    user_id: str = ""
):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE FROM playlists
            WHERE playlist_id = %s
              AND user_id = %s
            """,
            (playlist_id, int(user_id))
        )

        connection.commit()

        if cursor.rowcount == 0:
            return JSONResponse(
                content={"message": "Playlist not found."},
                status_code=404
            )

        return {
            "message": "Playlist deleted successfully!"
        }

    except mysql.connector.Error as error:
        print("Delete playlist error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-delete ang playlist."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/playlists/{playlist_id}/songs")
def get_playlist_songs(
    playlist_id: int,
    user_id: str = ""
):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT playlist_id
            FROM playlists
            WHERE playlist_id = %s
              AND user_id = %s
            """,
            (playlist_id, int(user_id))
        )

        playlist = cursor.fetchone()

        if not playlist:
            return JSONResponse(
                content={"message": "Playlist not found."},
                status_code=404
            )

        cursor.execute(
            """
            SELECT
                s.song_id,
                s.title,
                s.artist,
                s.audio_url,
                s.created_at,
                s.audio_filename,
                s.audio_mime_type,
                s.audio_size,
                (s.audio_data IS NOT NULL) AS has_audio
            FROM playlist_songs ps
            INNER JOIN songs s
                ON ps.song_id = s.song_id
            WHERE ps.playlist_id = %s
            ORDER BY ps.playlist_song_id DESC
            """,
            (playlist_id,)
        )

        songs = cursor.fetchall()

        for song in songs:
            if song["has_audio"]:
                song["audio_url"] = (
                    f"/api/songs/{song['song_id']}/audio"
                )

            song["has_audio"] = bool(song["has_audio"])

        return {
            "songs": songs,
            "total": len(songs)
        }

    except mysql.connector.Error as error:
        print("Get playlist songs error:", error)

        return JSONResponse(
            content={"message": "Hindi makuha ang playlist songs."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/playlists/{playlist_id}/songs")
def add_song_to_playlist(
    playlist_id: int,
    data: PlaylistSongRequest
):

    user_id = data.user_id
    song_id = data.song_id

    if user_id is None or not str(user_id).isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    if song_id is None:
        return JSONResponse(
            content={"message": "Song ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT playlist_id
            FROM playlists
            WHERE playlist_id = %s
              AND user_id = %s
            """,
            (playlist_id, int(user_id))
        )

        if not cursor.fetchone():
            return JSONResponse(
                content={"message": "Playlist not found."},
                status_code=404
            )

        cursor.execute(
            """
            SELECT song_id
            FROM songs
            WHERE song_id = %s
            """,
            (song_id,)
        )

        if not cursor.fetchone():
            return JSONResponse(
                content={"message": "Song not found."},
                status_code=404
            )

        cursor.execute(
            """
            INSERT INTO playlist_songs (playlist_id, song_id)
            VALUES (%s, %s)
            """,
            (playlist_id, song_id)
        )

        connection.commit()

        return JSONResponse(
            content={"message": "Song added to playlist!"},
            status_code=201
        )

    except mysql.connector.IntegrityError:
        return JSONResponse(
            content={"message": "Nasa playlist na ang kantang ito."},
            status_code=409
        )

    except mysql.connector.Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("Add playlist song error:", error)

        return JSONResponse(
            content={"message": "Hindi ma-add ang song sa playlist."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/playlists/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(
    playlist_id: int,
    song_id: int,
    user_id: str = ""
):

    if not user_id.isdigit():
        return JSONResponse(
            content={"message": "Valid user ID is required."},
            status_code=400
        )

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            DELETE ps
            FROM playlist_songs ps
            INNER JOIN playlists p
                ON ps.playlist_id = p.playlist_id
            WHERE ps.playlist_id = %s
              AND ps.song_id = %s
              AND p.user_id = %s
            """,
            (playlist_id, song_id, int(user_id))
        )

        connection.commit()

        if cursor.rowcount == 0:
            return JSONResponse(
                content={"message": "Song not found in this playlist."},
                status_code=404
            )

        return {
            "message": "Song removed from playlist!"
        }

    except mysql.connector.Error as error:
        print("Remove playlist song error:", error)

        return JSONResponse(
            content={"message": "Hindi maalis ang song sa playlist."},
            status_code=500
        )

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()