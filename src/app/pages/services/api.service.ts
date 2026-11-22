import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface SavedSong {
  song_id: number;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  audio_url: string;
  created_at: string;
  audio_filename?: string | null;
  audio_mime_type?: string | null;
  audio_size?: number | null;
  has_audio?: boolean;
}

export interface SaveSongResponse {
  message: string;
  song_id?: number;
  audio_url?: string;
  filename?: string;
  size?: number;
}

export interface RecentSearch {
  id: number;
  user_id: number;
  search_query: string;
  searched_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly apiUrl = environment.apiUrl;

  async uploadSong(
    file: File,
    title: string,
    artist: string,
    album: string = '',
    genre: string = ''
  ): Promise<SaveSongResponse> {

    if (!file) {
      throw new Error('Pumili muna ng MP3 file.');
    }

    if (!file.name.toLowerCase().endsWith('.mp3')) {
      throw new Error('MP3 files only ang puwedeng i-upload.');
    }

    if (file.size === 0) {
      throw new Error('Walang laman ang napiling file.');
    }

    if (file.size > 25 * 1024 * 1024) {
      throw new Error('Maximum file size ay 25 MB lamang.');
    }

    if (!title.trim() || !artist.trim()) {
      throw new Error('Ilagay ang song title at artist.');
    }

    if (title.trim().length > 150 || artist.trim().length > 150) {
      throw new Error('Masyadong mahaba ang title o artist.');
    }

    if (album.trim().length > 150 || genre.trim().length > 100) {
      throw new Error('Masyadong mahaba ang album o genre.');
    }

    const formData = new FormData();

    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('artist', artist.trim());
    formData.append('album', album.trim());
    formData.append('genre', genre.trim());

    const response = await fetch(
      `${this.apiUrl}/songs/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ?? 'Hindi na-upload ang MP3 file.'
      );
    }

    return result as SaveSongResponse;
  }

  getSongAudioUrl(songId: number): string {
    return `${this.apiUrl}/songs/${songId}/audio`;
  }

  async getSongs(search: string = ''): Promise<SavedSong[]> {

    const response = await fetch(
      `${this.apiUrl}/songs?search=${encodeURIComponent(search)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve songs: ${response.status}`);
    }

    const result = await response.json();

    if (!Array.isArray(result.songs)) {
      throw new Error('Unexpected songs database response.');
    }

    return result.songs.map((song: SavedSong) => ({
      ...song,
      audio_url: song.has_audio
        ? this.getSongAudioUrl(song.song_id)
        : song.audio_url
    })) as SavedSong[];
  }

  async getRecentSearches(userId: number): Promise<RecentSearch[]> {

    if (!userId) {
      return [];
    }

    const response = await fetch(
      `${this.apiUrl}/recent-searches?user_id=${encodeURIComponent(userId)}`
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ?? 'Hindi makuha ang recent searches.'
      );
    }

    return (result.recent_searches || []) as RecentSearch[];
  }

  async addRecentSearch(
    userId: number,
    searchQuery: string
  ): Promise<void> {

    if (!userId || !searchQuery.trim()) {
      return;
    }

    const response = await fetch(
      `${this.apiUrl}/recent-searches`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          search_query: searchQuery.trim()
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ?? 'Hindi ma-save ang recent search.'
      );
    }
  }

  async deleteRecentSearch(
    searchId: number,
    userId: number
  ): Promise<void> {

    const response = await fetch(
      `${this.apiUrl}/recent-searches/${searchId}?user_id=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE'
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ?? 'Hindi ma-delete ang recent search.'
      );
    }
  }

  async clearRecentSearches(userId: number): Promise<void> {

    if (!userId) {
      return;
    }

    const response = await fetch(
      `${this.apiUrl}/recent-searches?user_id=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE'
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ?? 'Hindi ma-clear ang recent searches.'
      );
    }
  }

}