import { environment } from '../../../environments/environment';
import {
  Component,
  OnDestroy,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';

import {
  ApiService,
  RecentSearch
} from '../services/api.service';

import {
  homeOutline,
  searchOutline,
  libraryOutline,
  addOutline,
  musicalNotes,
  heart,
  person,
  peopleOutline,
  headsetOutline,
  addCircleOutline,
  ellipsisHorizontal,
  micOutline,
  radioOutline,
  albumsOutline,
  closeCircleOutline,
  swapVerticalOutline,
  arrowBackOutline,
  heartOutline,
  play,
  pause,
  close,
  volumeHigh,
  personOutline,
  settingsOutline,
  informationCircleOutline,
  logOutOutline,
  closeOutline,
  chevronForwardOutline,
  chevronDown,
  playSkipBack,
  playSkipForward,
  shuffle,
  repeat,
  cloudUploadOutline,
  documentAttachOutline,
  hourglassOutline,
  timeOutline
} from 'ionicons/icons';

interface Song {
  song_id: number;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  audio_url?: string;
  created_at?: string;
  color: string;
}

interface Playlist {
  playlist_id: number;
  user_id: number;
  name: string;
  created_at?: string;
  song_count: number;
  songs: Song[];
}

interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  audioUrl: string;
  sourceUrl: string;
  isPremium: boolean;
  raw: any;
}

interface User {
  user_id?: number;
  username?: string;
  name?: string;
  full_name?: string;
  firstname?: string;
  first_name?: string;
  email?: string;
}

interface LikedSong {
  id: number;
  user_id: number;
  song_title: string;
  artist: string;
  created_at?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon]
})

export class HomePage implements OnDestroy {

  private readonly apiUrl = environment.apiUrl;

  activeTab = 'home';

  // PROFILE DRAWER
  isDrawerOpen = false;

  playlistName = '';
  searchText = '';

  userName = 'User';
  userEmail = '';
  userInitial = 'U';
  userId: number | null = null;

  libraryFilter = 'playlists';
  sortNewestFirst = true;

  // PLAYLIST DATABASE
  playlists: Playlist[] = [];

  selectedPlaylist: Playlist | null = null;

  isLoadingPlaylists = false;
  isLoadingPlaylistSongs = false;
  isSavingPlaylist = false;

  likedSongs: string[] = [];
  likedSongRecords: LikedSong[] = [];

  isLoadingLikedSongId: number | null = null;

  searchResults: Song[] = [];
  isSearching = false;
  searchPerformed = false;
  searchError = '';

  // RECENT SEARCHES
  recentSearches: RecentSearch[] = [];
  isLoadingRecentSearches = false;

  // RECENTLY PLAYED SONGS
  recentPlayedSongs: Song[] = [];

  // UPLOAD MUSIC
  uploadTitle = '';
  uploadArtist = '';
  uploadAlbum = '';
  uploadGenre = '';

  selectedAudioFile: File | null = null;

  isUploading = false;
  uploadError = '';
  uploadSuccess = '';

  // MUSIC PLAYER AND QUEUE
  currentTrack: PlayerTrack | null = null;
  trackQueue: PlayerTrack[] = [];

  queueIndex = -1;

  isShuffleEnabled = false;

  repeatMode: 'off' | 'all' | 'one' = 'off';

  isPlaying = false;

  currentTime = 0;
  duration = 0;

  volume = 0.8;

  // FULL-SCREEN PLAYER STATE
  isPlayerExpanded = false;

  private audioPlayer: HTMLAudioElement | null = null;

  private searchRequestNumber = 0;

  categories = [
    { name: 'Music', color: '#e9148b', icon: 'musical-notes' },
    { name: 'Podcasts', color: '#08765f', icon: 'mic-outline' },
    { name: 'Chill', color: '#2948a5', icon: 'headset-outline' },
    { name: 'OPM', color: '#7900d8', icon: 'radio-outline' },
    { name: 'Favorites', color: '#7b478e', icon: 'heart' },
    { name: 'New Releases', color: '#a45b42', icon: 'albums-outline' }
  ];

  constructor(
    private apiService: ApiService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {

    addIcons({
      homeOutline,
      searchOutline,
      libraryOutline,
      addOutline,
      musicalNotes,
      heart,
      person,
      peopleOutline,
      headsetOutline,
      addCircleOutline,
      ellipsisHorizontal,
      micOutline,
      radioOutline,
      albumsOutline,
      closeCircleOutline,
      swapVerticalOutline,
      arrowBackOutline,
      heartOutline,
      play,
      pause,
      close,
      volumeHigh,
      personOutline,
      settingsOutline,
      informationCircleOutline,
      logOutOutline,
      closeOutline,
      chevronForwardOutline,
      chevronDown,
      playSkipBack,
      playSkipForward,
      shuffle,
      repeat,
      cloudUploadOutline,
      documentAttachOutline,
      hourglassOutline,
      timeOutline
    });

    this.loadUser();
  }

  get greeting(): string {

    const hour = new Date().getHours();

    if (hour < 12) return 'morning';

    if (hour < 18) return 'afternoon';

    return 'evening';
  }

  // ==========================================
  // LOAD LOGGED-IN USER
  // ==========================================

  loadUser() {

    const savedUser = localStorage.getItem('melodifyUser');

    if (!savedUser) {

      console.warn('No logged-in user found.');

      return;
    }

    try {

      const parsedData = JSON.parse(savedUser);

      const user: User =
        parsedData.user ||
        parsedData.data?.user ||
        parsedData.data ||
        parsedData;

      const actualName =
        user.username ||
        user.name ||
        user.full_name ||
        user.firstname ||
        user.first_name ||
        '';

      if (actualName.trim()) {

        this.userName = actualName.trim();

        this.userInitial = this.userName.charAt(0).toUpperCase();
      }

      this.userEmail = user.email || '';

      this.userId = user.user_id ?? null;

      if (this.userId !== null) {

        this.loadLikedSongs();

        this.loadRecentSearches();

        this.loadRecentPlayedSongs();

        this.loadPlaylists();

      } else {

        console.error('User ID is missing.');
      }

    } catch (error) {

      console.error('Unable to read user information:', error);
    }
  }

  // ==========================================
  // RECENTLY PLAYED SONGS
  // ==========================================

  private getRecentPlayedStorageKey(): string | null {

    if (this.userId === null) return null;

    return `melodifyRecentPlayed_${this.userId}`;
  }

  loadRecentPlayedSongs() {

    const storageKey = this.getRecentPlayedStorageKey();

    if (!storageKey) {

      this.recentPlayedSongs = [];

      return;
    }

    try {

      const savedSongs = localStorage.getItem(storageKey);

      if (!savedSongs) {

        this.recentPlayedSongs = [];

        return;
      }

      const parsedSongs = JSON.parse(savedSongs);

      this.recentPlayedSongs = Array.isArray(parsedSongs)
        ? parsedSongs
        : [];

    } catch (error) {

      console.error('Unable to load recently played songs:', error);

      this.recentPlayedSongs = [];
    }
  }

  private saveRecentPlayedSong(track: PlayerTrack) {

    if (this.userId === null) return;

    const storageKey = this.getRecentPlayedStorageKey();

    if (!storageKey) return;

    const originalSong = track.raw || {};

    const song: Song = {

      song_id: Number(originalSong.song_id ?? track.id),

      title: track.title,

      artist: track.artist,

      album: originalSong.album || '',

      genre: originalSong.genre || '',

      audio_url:
        originalSong.audio_url ||
        (track.audioUrl.startsWith('http://127.0.0.1:8000')
          ? track.audioUrl.replace('http://127.0.0.1:8000', '')
          : track.audioUrl),

      created_at: originalSong.created_at || '',

      color: originalSong.color ||
        'linear-gradient(135deg,#5425db,#9c9cce)'
    };

    this.recentPlayedSongs = this.recentPlayedSongs.filter(
      item => item.song_id !== song.song_id
    );

    this.recentPlayedSongs.unshift(song);

    this.recentPlayedSongs = this.recentPlayedSongs.slice(0, 10);

    try {

      localStorage.setItem(
        storageKey,
        JSON.stringify(this.recentPlayedSongs)
      );

    } catch (error) {

      console.error('Unable to save recently played songs:', error);
    }
  }

  clearRecentPlayedSongs() {

    if (this.userId === null) return;

    if (this.recentPlayedSongs.length === 0) return;

    const confirmed = confirm(
      'Are you sure you want to clear your Recently Played songs?'
    );

    if (!confirmed) return;

    const storageKey = this.getRecentPlayedStorageKey();

    if (storageKey) {

      localStorage.removeItem(storageKey);
    }

    this.recentPlayedSongs = [];
  }

  playRecentSong(song: Song) {

    this.playSong(song);
  }

  // ==========================================
  // RECENT SEARCHES
  // ==========================================

  async loadRecentSearches() {

    if (this.userId === null) {

      this.recentSearches = [];

      return;
    }

    const requestedUserId = this.userId;

    this.isLoadingRecentSearches = true;

    try {

      const records = await this.apiService.getRecentSearches(
        requestedUserId
      );

      if (this.userId !== requestedUserId) return;

      this.recentSearches = Array.isArray(records)
        ? records
        : [];

    } catch (error) {

      console.error('Unable to load recent searches:', error);

      if (this.userId === requestedUserId) {
        this.recentSearches = [];
      }

    } finally {

      if (this.userId === requestedUserId) {
        this.isLoadingRecentSearches = false;
      }
    }
  }

  async saveRecentSearch(value: string) {

    const keyword = value.trim();

    if (!keyword || this.userId === null) return;

    try {

      await this.apiService.addRecentSearch(
        this.userId,
        keyword
      );

      await this.loadRecentSearches();

    } catch (error) {

      console.error('Unable to save recent search:', error);
    }
  }

  async submitSearch(value?: string) {

    const keyword = (value ?? this.searchText).trim();

    if (!keyword) {

      this.clearSearch();

      return;
    }

    this.searchText = keyword;

    await this.searchDatabaseSongs(keyword);

    await this.saveRecentSearch(keyword);
  }

  async searchFromRecent(searchQuery: string) {

    this.activeTab = 'search';

    this.searchText = searchQuery;

    await this.submitSearch(searchQuery);
  }

  async removeRecentSearch(searchId: number) {

    if (this.userId === null) return;

    try {

      await this.apiService.deleteRecentSearch(
        searchId,
        this.userId
      );

      await this.loadRecentSearches();

    } catch (error) {

      console.error('Unable to remove recent search:', error);

      alert('Hindi maalis ang recent search. Pakisubukan ulit.');
    }
  }

  async clearRecentSearches() {

    if (this.userId === null) return;

    if (this.recentSearches.length === 0) return;

    const confirmed = confirm(
      'Are you sure you want to clear all your recent searches?'
    );

    if (!confirmed) return;

    try {

      await this.apiService.clearRecentSearches(this.userId);

      this.recentSearches = [];

    } catch (error) {

      console.error('Unable to clear recent searches:', error);

      alert('Hindi ma-clear ang recent searches.');
    }
  }

  // ==========================================
  // PROFILE DRAWER CONTROLS
  // ==========================================

  openProfile() {

    this.isDrawerOpen = true;
  }

  closeDrawer() {

    this.isDrawerOpen = false;
  }

  toggleDrawer() {

    this.isDrawerOpen = !this.isDrawerOpen;
  }

  navigateFromDrawer(tab: string, filter?: string) {

    this.closeDrawer();

    this.changeTab(tab);

    if (filter) {

      this.setLibraryFilter(filter);
    }
  }

  openAccountSettings() {

    this.closeDrawer();

    alert(
      'ACCOUNT SETTINGS\n\n' +
      'Username: ' + this.userName +
      '\nEmail: ' + this.userEmail +
      '\n\nMore account settings will be available in a future update.'
    );
  }

  showAbout() {

    this.closeDrawer();

    alert(
      'ABOUT MELODIFY\n\n' +
      'Melodify - Your Music, Your Space.\n\n' +
      'Discover music, organize your playlists, ' +
      'and save your favorite songs in one place.'
    );
  }

  // ==========================================
  // DATABASE MUSIC SEARCH
  // ==========================================

  async searchDatabaseSongs(value: string) {

    this.searchText = value;

    const keyword = value.trim();

    const requestNumber = ++this.searchRequestNumber;

    if (!keyword) {

      this.searchResults = [];

      this.searchPerformed = false;

      this.searchError = '';

      this.isSearching = false;

      return;
    }

    this.isSearching = true;

    this.searchPerformed = true;

    this.searchError = '';

    try {

      const response = await fetch(
        `${this.apiUrl}/songs?search=${encodeURIComponent(keyword)}`
      );

      const result = await response.json();

      if (requestNumber !== this.searchRequestNumber) return;

      if (!response.ok) {

        this.searchResults = [];

        this.searchError = result.message || 'Unable to search songs.';

        return;
      }

      const records = Array.isArray(result)
        ? result
        : result.songs || [];

      this.searchResults = records.map((song: any) =>
        this.mapDatabaseSong(song)
      );

    } catch (error) {

      console.error('Search error:', error);

      if (requestNumber === this.searchRequestNumber) {

        this.searchResults = [];

        this.searchError =
          'Hindi makakonekta sa FastAPI backend. Tiyaking tumatakbo ang Uvicorn.';
      }

    } finally {

      if (requestNumber === this.searchRequestNumber) {

        this.isSearching = false;
      }
    }
  }

  private mapDatabaseSong(song: any): Song {

    return {

      song_id: Number(song.song_id),

      title: song.title || '',

      artist: song.artist || '',

      album: song.album || '',

      genre: song.genre || '',

      audio_url: song.audio_url || '',

      created_at: song.created_at || '',

      color: 'linear-gradient(135deg,#5425db,#9c9cce)'
    };
  }

  clearSearch() {

    this.searchText = '';

    this.searchResults = [];

    this.searchPerformed = false;

    this.searchError = '';

    this.isSearching = false;

    this.searchRequestNumber++;
  }

  // ==========================================
  // UPLOAD MUSIC TO MYSQL DATABASE
  // ==========================================

  onAudioFileSelected(event: Event) {

    const input = event.target as HTMLInputElement;

    const file = input.files?.[0] ?? null;

    this.uploadError = '';

    this.uploadSuccess = '';

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.mp3')) {

      this.selectedAudioFile = null;

      input.value = '';

      this.uploadError = 'MP3 files only ang puwedeng i-upload.';

      return;
    }

    if (file.size === 0) {

      this.selectedAudioFile = null;

      input.value = '';

      this.uploadError = 'Walang laman ang napiling file.';

      return;
    }

    if (file.size > 25 * 1024 * 1024) {

      this.selectedAudioFile = null;

      input.value = '';

      this.uploadError = 'Maximum file size ay 25 MB lamang.';

      return;
    }

    this.selectedAudioFile = file;

    if (!this.uploadTitle.trim()) {

      this.uploadTitle = file.name.replace(/\.mp3$/i, '');
    }
  }

  clearSelectedAudioFile() {

    this.selectedAudioFile = null;

    this.uploadError = '';

    this.uploadSuccess = '';

    const input = document.getElementById(
      'musicFile'
    ) as HTMLInputElement | null;

    if (input) {

      input.value = '';
    }
  }

  async uploadMusic() {

    this.uploadError = '';

    this.uploadSuccess = '';

    if (!this.selectedAudioFile) {

      this.uploadError = 'Pumili muna ng MP3 file.';

      return;
    }

    if (!this.uploadTitle.trim() || !this.uploadArtist.trim()) {

      this.uploadError = 'Ilagay ang song title at artist.';

      return;
    }

    if (this.isUploading) return;

    const uploadedTitle = this.uploadTitle.trim();

    this.isUploading = true;

    try {

      const result = await this.apiService.uploadSong(
        this.selectedAudioFile,
        this.uploadTitle,
        this.uploadArtist,
        this.uploadAlbum,
        this.uploadGenre
      );

      this.uploadSuccess =
        result.message || 'Successfully uploaded your song!';

      this.uploadTitle = '';

      this.uploadArtist = '';

      this.uploadAlbum = '';

      this.uploadGenre = '';

      this.selectedAudioFile = null;

      const input = document.getElementById(
        'musicFile'
      ) as HTMLInputElement | null;

      if (input) {

        input.value = '';
      }

      alert(
        'UPLOAD SUCCESSFUL!\n\n' +
        uploadedTitle +
        '\n\nThe song has been saved to the Melodify database.'
      );

      this.activeTab = 'search';

      this.searchText = uploadedTitle;

      await this.searchDatabaseSongs(uploadedTitle);

    } catch (error) {

      console.error('Music upload error:', error);

      this.uploadError =
        error instanceof Error
          ? error.message
          : 'Hindi na-upload ang kanta. Pakisubukan ulit.';

    } finally {

      this.isUploading = false;
    }
  }

  // ==========================================
  // PLAYLIST DATABASE - LOAD
  // ==========================================

  get sortedPlaylists(): Playlist[] {

    const result = [...this.playlists];

    return this.sortNewestFirst ? result.reverse() : result;
  }

  async loadPlaylists() {

    if (this.userId === null) {

      this.playlists = [];

      return;
    }

    const requestedUserId = this.userId;

    this.isLoadingPlaylists = true;

    try {

      const response = await fetch(
        `${this.apiUrl}/playlists?user_id=${encodeURIComponent(requestedUserId)}`
      );

      const result = await response.json();

      if (this.userId !== requestedUserId) return;

      if (!response.ok) {

        throw new Error(result.message || 'Unable to load playlists.');
      }

      const records = Array.isArray(result)
        ? result
        : result.playlists || [];

      this.playlists = records.map((item: any) => ({

        playlist_id: Number(item.playlist_id),

        user_id: Number(item.user_id),

        name: item.name || '',

        created_at: item.created_at || '',

        song_count: Number(item.song_count || 0),

        songs: []

      }));

    } catch (error) {

      console.error('Unable to load playlists:', error);

      if (this.userId === requestedUserId) {

        this.playlists = [];

        alert(
          'Hindi ma-load ang playlists. Tiyaking tumatakbo ang FastAPI backend.'
        );
      }

    } finally {

      if (this.userId === requestedUserId) {

        this.isLoadingPlaylists = false;

        this.cdr.detectChanges();
      }
    }
  }

  // ==========================================
  // LOAD SONGS INSIDE A PLAYLIST
  // ==========================================

  async loadPlaylistSongs(playlistId: number) {

    if (this.userId === null) return;

    const requestedUserId = this.userId;

    this.isLoadingPlaylistSongs = true;

    try {

      const response = await fetch(
        `${this.apiUrl}/playlists/${playlistId}/songs?user_id=${encodeURIComponent(requestedUserId)}`
      );

      const result = await response.json();

      if (this.userId !== requestedUserId) return;

      if (!response.ok) {

        throw new Error(result.message || 'Unable to load playlist songs.');
      }

      const records = Array.isArray(result)
        ? result
        : result.songs || [];

      const songs: Song[] = records.map((song: any) =>
        this.mapDatabaseSong(song)
      );

      const playlist = this.playlists.find(
        item => item.playlist_id === playlistId
      );

      if (playlist) {

        playlist.songs = songs;

        playlist.song_count = songs.length;
      }

      if (this.selectedPlaylist?.playlist_id === playlistId) {

        this.selectedPlaylist.songs = songs;

        this.selectedPlaylist.song_count = songs.length;
      }

    } catch (error) {

      console.error('Unable to load playlist songs:', error);

      alert('Hindi ma-load ang mga kanta sa playlist.');

    } finally {

      this.isLoadingPlaylistSongs = false;

      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // CREATE PLAYLIST
  // ==========================================

  async addPlaylist() {

    const name = this.playlistName.trim();

    if (!name) {

      alert('Please enter a playlist name.');

      return;
    }

    if (this.userId === null) {

      alert('Hindi makita ang logged-in account. Mag-login ulit.');

      return;
    }

    if (this.isSavingPlaylist) return;

    this.isSavingPlaylist = true;

    try {

      const response = await fetch(`${this.apiUrl}/playlists`, {

        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          user_id: this.userId,

          name: name
        })
      });

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi nagawa ang playlist.');

        return;
      }

      this.playlistName = '';

      await this.loadPlaylists();

      this.activeTab = 'library';

      this.libraryFilter = 'playlists';

      this.selectedPlaylist = null;

      alert('Playlist created successfully!');

    } catch (error) {

      console.error('Create playlist error:', error);

      alert('Hindi makakonekta sa FastAPI backend.');

    } finally {

      this.isSavingPlaylist = false;
    }
  }

  // ==========================================
  // EDIT PLAYLIST
  // ==========================================

  editPlaylist(id: number) {

    const action = prompt(
      'Type R to rename or D to delete this playlist.'
    );

    if (action?.toLowerCase() === 'r') {

      this.renamePlaylist(id);

    } else if (action?.toLowerCase() === 'd') {

      this.deletePlaylist(id);
    }
  }

  // ==========================================
  // RENAME PLAYLIST
  // ==========================================

  async renamePlaylist(id: number) {

    const playlist = this.playlists.find(
      item => item.playlist_id === id
    );

    if (!playlist) return;

    const newName = prompt(
      'Enter new playlist name:',
      playlist.name
    );

    if (newName === null) return;

    const trimmedName = newName.trim();

    if (!trimmedName) {

      alert('Playlist name cannot be empty.');

      return;
    }

    if (this.userId === null) return;

    try {

      const response = await fetch(
        `${this.apiUrl}/playlists/${id}`,
        {
          method: 'PUT',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({

            user_id: this.userId,

            name: trimmedName
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi na-update ang playlist.');

        return;
      }

      await this.loadPlaylists();

      if (this.selectedPlaylist?.playlist_id === id) {

        this.selectedPlaylist.name = trimmedName;
      }

      alert('Playlist renamed successfully!');

    } catch (error) {

      console.error('Rename playlist error:', error);

      alert('Hindi makakonekta sa FastAPI backend.');
    }
  }

  // ==========================================
  // DELETE PLAYLIST
  // ==========================================

  async deletePlaylist(id: number) {

    if (this.userId === null) return;

    const confirmed = confirm(
      'Are you sure you want to delete this playlist?'
    );

    if (!confirmed) return;

    try {

      const response = await fetch(
        `${this.apiUrl}/playlists/${id}?user_id=${encodeURIComponent(this.userId)}`,
        {
          method: 'DELETE'
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi na-delete ang playlist.');

        return;
      }

      if (this.selectedPlaylist?.playlist_id === id) {

        this.selectedPlaylist = null;
      }

      await this.loadPlaylists();

      alert('Playlist deleted successfully!');

    } catch (error) {

      console.error('Delete playlist error:', error);

      alert('Hindi makakonekta sa FastAPI backend.');
    }
  }

  // ==========================================
  // OPEN PLAYLIST
  // ==========================================

  async openPlaylist(playlist: Playlist | string) {

    if (playlist === 'Liked Songs') {

      await this.openLikedSongs();

      return;
    }

    const selected = typeof playlist === 'string'
      ? this.playlists.find(item => item.name === playlist)
      : playlist;

    if (!selected) return;

    this.selectedPlaylist = selected;

    await this.loadPlaylistSongs(selected.playlist_id);
  }

  // ==========================================
  // CLOSE PLAYLIST DETAILS
  // ==========================================

  closePlaylistDetails() {

    this.selectedPlaylist = null;
  }

  // ==========================================
  // ADD SONG TO PLAYLIST
  // ==========================================

  async addSongToPlaylist(id: number) {

    const playlist = this.playlists.find(
      item => item.playlist_id === id
    );

    if (!playlist) return;

    if (this.searchResults.length === 0) {

      alert('Search for a song first before adding it to a playlist.');

      this.changeTab('search');

      return;
    }

    const songOptions = this.searchResults
      .map((song, index) =>
        (index + 1) + '. ' + song.title + ' - ' + song.artist
      )
      .join('\n');

    const choice = prompt(
      'Choose a song by entering its number:\n\n' + songOptions
    );

    if (choice === null) return;

    const selectedSong = this.searchResults[Number(choice) - 1];

    if (!selectedSong) {

      alert('Invalid song selection.');

      return;
    }

    await this.addSongToPlaylistById(
      playlist.playlist_id,
      selectedSong
    );
  }

  // ==========================================
  // ADD SONG TO SELECTED PLAYLIST
  // ==========================================

  async addSongToPlaylistById(
    playlistId: number,
    song: Song
  ) {

    if (this.userId === null) return;

    try {

      const response = await fetch(
        `${this.apiUrl}/playlists/${playlistId}/songs`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({

            user_id: this.userId,

            song_id: song.song_id
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi naidagdag ang kanta.');

        return;
      }

      await this.loadPlaylistSongs(playlistId);

      await this.loadPlaylists();

      alert(
        song.title + ' added to ' +
        (this.selectedPlaylist?.name ||
          this.playlists.find(item => item.playlist_id === playlistId)?.name ||
          'playlist') + '!'
      );

    } catch (error) {

      console.error('Add song to playlist error:', error);

      alert('Hindi makakonekta sa FastAPI backend.');
    }
  }

  // ==========================================
  // CHOOSE PLAYLIST FROM SEARCH
  // ==========================================

  async choosePlaylistForSong(song: Song) {

    if (this.playlists.length === 0) {

      alert('Create a playlist first.');

      this.changeTab('create');

      return;
    }

    const options = this.playlists
      .map((playlist, index) =>
        (index + 1) + '. ' + playlist.name
      )
      .join('\n');

    const choice = prompt(
      'Choose a playlist for ' + song.title + ':\n\n' + options
    );

    if (choice === null) return;

    const playlist = this.playlists[Number(choice) - 1];

    if (!playlist) {

      alert('Invalid playlist selection.');

      return;
    }

    await this.addSongToPlaylistById(
      playlist.playlist_id,
      song
    );
  }

  // ==========================================
  // REMOVE SONG FROM PLAYLIST
  // ==========================================

  async removeSongFromPlaylist(id: number) {

    const playlist = this.playlists.find(
      item => item.playlist_id === id
    );

    if (!playlist) return;

    if (playlist.songs.length === 0) {

      await this.loadPlaylistSongs(id);
    }

    if (playlist.songs.length === 0) {

      alert('There are no songs to remove.');

      return;
    }

    const options = playlist.songs
      .map((song, index) =>
        (index + 1) + '. ' + song.title + ' - ' + song.artist
      )
      .join('\n');

    const choice = prompt(
      'Choose a song number to remove:\n\n' + options
    );

    if (choice === null) return;

    const index = Number(choice) - 1;

    if (index < 0 || index >= playlist.songs.length) {

      alert('Invalid selection.');

      return;
    }

    const selectedSong = playlist.songs[index];

    await this.removePlaylistSong(selectedSong.song_id);
  }

  async removePlaylistSong(songId: number) {

    if (this.userId === null || !this.selectedPlaylist) return;

    const playlistId = this.selectedPlaylist.playlist_id;

    const confirmed = confirm(
      'Remove this song from the playlist?'
    );

    if (!confirmed) return;

    try {

      const response = await fetch(
        `${this.apiUrl}/playlists/${playlistId}/songs/${songId}?user_id=${encodeURIComponent(this.userId)}`,
        {
          method: 'DELETE'
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi maalis ang kanta.');

        return;
      }

      await this.loadPlaylistSongs(playlistId);

      await this.loadPlaylists();

      alert('Song removed from playlist.');

    } catch (error) {

      console.error('Remove playlist song error:', error);

      alert('Hindi makakonekta sa FastAPI backend.');
    }
  }

  // ==========================================
  // PLAY SONG FROM PLAYLIST
  // ==========================================

  async playPlaylistSong(song: Song) {

    if (!song.audio_url) {

      alert(
        'Wala pang audio file ang "' + song.title + '".'
      );

      return;
    }

    if (!this.selectedPlaylist) {

      await this.playSong(song);

      return;
    }

    const playlistSongs = this.selectedPlaylist.songs
      .filter(item => !!item.audio_url);

    if (playlistSongs.length === 0) {

      alert('Walang available na audio files sa playlist na ito.');

      return;
    }

    this.trackQueue = playlistSongs.map(
      item => this.toPlayerTrack(item)
    );

    const selectedTrack = this.toPlayerTrack(song);

    this.queueIndex = this.trackQueue.findIndex(
      item => item.id === selectedTrack.id
    );

    if (this.queueIndex < 0) {

      this.trackQueue.push(selectedTrack);

      this.queueIndex = this.trackQueue.length - 1;
    }

    await this.playTrack(selectedTrack);
  }

  // ==========================================
  // CHANGE PAGE
  // ==========================================

  changeTab(tab: string) {

    this.activeTab = tab;

    if (tab !== 'search') {

      this.clearSearch();
    }

    if (tab === 'library' && this.userId !== null) {

      this.loadPlaylists();
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  logout() {

    const confirmed = confirm('Are you sure you want to log out?');

    if (!confirmed) return;

    this.closeDrawer();

    this.stopExternalMusic();

    this.recentSearches = [];

    this.recentPlayedSongs = [];

    this.likedSongs = [];

    this.likedSongRecords = [];

    this.playlists = [];

    this.selectedPlaylist = null;

    localStorage.removeItem('melodifyUser');

    localStorage.removeItem('loggedInUser');

    localStorage.removeItem('user');

    window.location.href = '/login';
  }

  // ==========================================
  // CATEGORY
  // ==========================================

  selectCategory(category: string) {

    if (category === 'Favorites') {

      this.libraryFilter = 'playlists';

      this.changeTab('library');

      return;
    }

    this.changeTab('search');

    alert('Search for a song related to ' + category + '.');
  }

  // ==========================================
  // LIBRARY FILTER
  // ==========================================

  setLibraryFilter(filter: string) {

    this.libraryFilter = filter;

    if (filter === 'liked') {

      this.selectedPlaylist = null;

      this.loadLikedSongs();

    } else {

      this.selectedPlaylist = null;

      this.loadPlaylists();
    }
  }

  togglePlaylistSort() {

    this.sortNewestFirst = !this.sortNewestFirst;
  }

  // ==========================================
  // LIKED SONGS
  // ==========================================

  async loadLikedSongs() {

    if (this.userId === null) return;

    const requestedUserId = this.userId;

    try {

      const response = await fetch(
        `${this.apiUrl}/liked-songs?user_id=${encodeURIComponent(requestedUserId)}`
      );

      const result = await response.json();

      if (this.userId !== requestedUserId) return;

      if (!response.ok) {

        console.error('Unable to load liked songs:', result);

        return;
      }

      const records: LikedSong[] = Array.isArray(result)
        ? result
        : result.liked_songs || result.songs || [];

      this.likedSongRecords = records;

      this.likedSongs = records.map(song => song.song_title);

    } catch (error) {

      console.error('Error loading liked songs:', error);

      alert(
        'Hindi makuha ang Liked Songs. Tiyaking tumatakbo ang FastAPI backend.'
      );
    }
  }

  async openLikedSongs() {

    this.activeTab = 'library';

    this.libraryFilter = 'liked';

    this.selectedPlaylist = null;

    await this.loadLikedSongs();
  }

  async playLikedSong(likedSong: LikedSong) {

    if (this.isLoadingLikedSongId !== null) return;

    this.isLoadingLikedSongId = likedSong.id;

    try {

      const response = await fetch(`${this.apiUrl}/songs`);

      if (!response.ok) {

        throw new Error('Unable to retrieve songs from the database.');
      }

      const result = await response.json();

      const records = Array.isArray(result)
        ? result
        : result.songs || [];

      const matchedSong = records.find((song: any) => {

        const databaseTitle = String(song.title || '')
          .trim()
          .toLowerCase();

        const databaseArtist = String(song.artist || '')
          .trim()
          .toLowerCase();

        const likedTitle = likedSong.song_title
          .trim()
          .toLowerCase();

        const likedArtist = likedSong.artist
          .trim()
          .toLowerCase();

        return (
          databaseTitle === likedTitle &&
          databaseArtist === likedArtist
        );
      });

      if (!matchedSong) {

        alert(
          'Hindi makita ang audio file ng "' +
          likedSong.song_title +
          '" sa music database.'
        );

        return;
      }

      if (!matchedSong.audio_url) {

        alert(
          'Wala pang audio file ang "' +
          likedSong.song_title +
          '".'
        );

        return;
      }

      const song = this.mapDatabaseSong(matchedSong);

      await this.playSong(song);

    } catch (error) {

      console.error('Unable to play liked song:', error);

      alert(
        'Hindi ma-play ang liked song. ' +
        'Tiyaking tumatakbo ang FastAPI backend.'
      );

    } finally {

      this.isLoadingLikedSongId = null;

      this.cdr.detectChanges();
    }
  }

  async addSongToLibrary(song: Song) {

    if (this.userId === null) {

      alert('Hindi makita ang logged-in account. Mag-login ulit.');

      return;
    }

    const alreadyLiked = this.likedSongRecords.some(
      item =>
        item.song_title.toLowerCase() === song.title.toLowerCase() &&
        item.artist.toLowerCase() === song.artist.toLowerCase()
    );

    if (alreadyLiked) {

      alert('This song is already in Liked Songs.');

      return;
    }

    try {

      const response = await fetch(`${this.apiUrl}/liked-songs`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          user_id: this.userId,

          song_title: song.title,

          artist: song.artist
        })
      });

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi na-save ang song.');

        return;
      }

      await this.loadLikedSongs();

      alert(song.title + ' added to Liked Songs!');

    } catch (error) {

      console.error('Error saving liked song:', error);

      alert('Hindi makakonekta sa FastAPI backend.');
    }
  }

  async removeLikedSong(songId: number) {

    if (this.userId === null) return;

    const confirmed = confirm('Remove this song from Liked Songs?');

    if (!confirmed) return;

    try {

      const response = await fetch(
        `${this.apiUrl}/liked-songs/${songId}`,
        {
          method: 'DELETE',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ user_id: this.userId })
        }
      );

      const result = await response.json();

      if (!response.ok) {

        alert(result.message || 'Hindi maalis ang song.');

        return;
      }

      await this.loadLikedSongs();

      alert('Song removed from Liked Songs.');

    } catch (error) {

      console.error('Error removing liked song:', error);

      alert('Hindi makakonekta sa FastAPI backend.');
    }
  }

  // ==========================================
  // MUSIC PLAYER
  // ==========================================

  async playSong(song: Song) {

    if (!song.audio_url) {

      alert(
        'Selected song: ' + song.title +
        '\nArtist: ' + song.artist +
        '\n\nWala pang audio file na naka-save para sa kantang ito.'
      );

      return;
    }

    await this.prepareTrackQueue(song);

    const track = this.toPlayerTrack(song);

    this.queueIndex = this.trackQueue.findIndex(
      item => item.id === track.id
    );

    if (this.queueIndex < 0) {

      this.trackQueue = [track];

      this.queueIndex = 0;
    }

    await this.playTrack(track);
  }

  // ==========================================
  // PREPARE MUSIC QUEUE
  // ==========================================

  private async prepareTrackQueue(selectedSong: Song) {

    try {

      const response = await fetch(`${this.apiUrl}/songs`);

      if (!response.ok) {

        throw new Error('Unable to load music queue.');
      }

      const result = await response.json();

      const records = Array.isArray(result)
        ? result
        : result.songs || [];

      const availableTracks: PlayerTrack[] = records
        .filter((song: any) => !!song.audio_url)
        .map((song: any) =>
          this.toPlayerTrack(this.mapDatabaseSong(song))
        );

      const selectedTrack = this.toPlayerTrack(selectedSong);

      const alreadyIncluded = availableTracks.some(
        track => track.id === selectedTrack.id
      );

      if (!alreadyIncluded) {

        availableTracks.push(selectedTrack);
      }

      const uniqueTracks = Array.from(
        new Map(
          availableTracks.map(track => [track.id, track])
        ).values()
      );

      this.trackQueue = uniqueTracks;

    } catch (error) {

      console.error('Unable to prepare music queue:', error);

      this.trackQueue = this.searchResults
        .filter(item => !!item.audio_url)
        .map(item => this.toPlayerTrack(item));

      const selectedTrack = this.toPlayerTrack(selectedSong);

      if (!this.trackQueue.some(item => item.id === selectedTrack.id)) {

        this.trackQueue.push(selectedTrack);
      }
    }
  }

  private toPlayerTrack(song: Song): PlayerTrack {

    return {

      id: String(song.song_id),

      title: song.title,

      artist: song.artist,

      imageUrl: '',

      audioUrl: song.audio_url
        ? (
            song.audio_url.startsWith('/')
              ? `http://127.0.0.1:8000${song.audio_url}`
              : song.audio_url
          )
        : '',

      sourceUrl: '',

      isPremium: false,

      raw: song
    };
  }

  // ==========================================
  // UPDATE PLAYER PROGRESS
  // ==========================================

  private updatePlayerProgress(player: HTMLAudioElement) {

    if (this.audioPlayer !== player) return;

    const audioDuration = player.duration;
    const audioCurrentTime = player.currentTime;

    this.ngZone.run(() => {

      if (this.audioPlayer !== player) return;

      this.duration =
        Number.isFinite(audioDuration) && audioDuration > 0
          ? audioDuration
          : 0;

      this.currentTime =
        Number.isFinite(audioCurrentTime) && audioCurrentTime >= 0
          ? audioCurrentTime
          : 0;

      this.cdr.detectChanges();
    });
  }

  // ==========================================
  // PLAY TRACK
  // ==========================================

  private async playTrack(
    track: PlayerTrack,
    forceNew = false
  ) {

    if (!track.audioUrl) {

      alert('Walang available na audio file para sa kantang ito.');

      return;
    }

    if (
      !forceNew &&
      this.currentTrack?.id === track.id &&
      this.audioPlayer
    ) {

      this.isPlayerExpanded = true;

      await this.toggleExternalPlayback();

      return;
    }

    this.stopExternalMusic(false);

    this.currentTrack = track;

    this.isPlayerExpanded = true;

    this.isPlaying = false;

    this.currentTime = 0;

    this.duration = 0;

    const player = new Audio(track.audioUrl);

    player.preload = 'metadata';

    player.volume = this.volume;

    this.audioPlayer = player;

    player.onloadedmetadata = () => {
      this.updatePlayerProgress(player);
    };

    player.ontimeupdate = () => {
      this.updatePlayerProgress(player);
    };

    player.ondurationchange = () => {
      this.updatePlayerProgress(player);
    };

    player.onseeked = () => {
      this.updatePlayerProgress(player);
    };

    player.onplay = () => {

      if (this.audioPlayer !== player) return;

      this.ngZone.run(() => {

        if (this.audioPlayer !== player) return;

        this.isPlaying = true;

        this.saveRecentPlayedSong(track);

        this.updatePlayerProgress(player);

        this.cdr.detectChanges();
      });
    };

    player.onpause = () => {

      if (this.audioPlayer !== player) return;

      this.ngZone.run(() => {

        if (this.audioPlayer !== player) return;

        this.isPlaying = false;

        this.updatePlayerProgress(player);

        this.cdr.detectChanges();
      });
    };

    player.onended = () => {

      if (this.audioPlayer !== player) return;

      this.ngZone.run(() => this.handleTrackEnded());
    };

    player.onerror = () => {

      if (this.audioPlayer !== player) return;

      this.ngZone.run(() => {

        this.isPlaying = false;

        this.cdr.detectChanges();
      });

      alert('Hindi ma-play ang kantang ito. Maaaring unavailable ang audio file.');
    };

    try {

      await player.play();

      if (this.audioPlayer !== player) return;

      this.ngZone.run(() => {

        this.isPlaying = true;

        this.updatePlayerProgress(player);

        this.cdr.detectChanges();
      });

    } catch (error) {

      console.error('Music playback error:', error);

      if (this.audioPlayer !== player) return;

      this.ngZone.run(() => {

        this.isPlaying = false;

        this.cdr.detectChanges();
      });

      alert('Hindi ma-play ang music. Subukan ang ibang kanta.');
    }
  }

  // ==========================================
  // FULL-SCREEN PLAYER CONTROLS
  // ==========================================

  openFullPlayer() {

    if (!this.currentTrack) return;

    this.isPlayerExpanded = true;
  }

  minimizePlayer() {

    if (!this.currentTrack) return;

    this.isPlayerExpanded = false;
  }

  // ==========================================
  // NEXT TRACK
  // ==========================================

  async nextTrack() {

    if (!this.currentTrack || this.trackQueue.length === 0) {

      return;
    }

    const actualCurrentIndex = this.trackQueue.findIndex(
      track => track.id === this.currentTrack?.id
    );

    if (actualCurrentIndex >= 0) {

      this.queueIndex = actualCurrentIndex;
    }

    if (this.trackQueue.length === 1) {

      if (
        this.repeatMode === 'all' ||
        this.repeatMode === 'one'
      ) {

        if (this.audioPlayer) {

          this.audioPlayer.currentTime = 0;

          try {

            await this.audioPlayer.play();

          } catch (error) {

            console.error('Repeat playback error:', error);
          }
        }
      }

      return;
    }

    let nextIndex: number;

    if (this.isShuffleEnabled) {

      const possibleIndexes = this.trackQueue
        .map((_, index) => index)
        .filter(index => index !== this.queueIndex);

      const randomPosition = Math.floor(
        Math.random() * possibleIndexes.length
      );

      nextIndex = possibleIndexes[randomPosition];

    } else {

      nextIndex = this.queueIndex + 1;

      if (nextIndex >= this.trackQueue.length) {

        if (this.repeatMode === 'all') {

          nextIndex = 0;

        } else {

          if (this.audioPlayer) {

            this.audioPlayer.pause();
          }

          this.isPlaying = false;

          this.currentTime = this.duration;

          this.cdr.detectChanges();

          return;
        }
      }
    }

    const next = this.trackQueue[nextIndex];

    if (!next) return;

    this.queueIndex = nextIndex;

    await this.playTrack(next, true);
  }

  // ==========================================
  // PREVIOUS TRACK
  // ==========================================

  async previousTrack() {

    if (!this.audioPlayer || !this.currentTrack) return;

    if (this.currentTime > 3) {

      this.audioPlayer.currentTime = 0;

      this.currentTime = 0;

      this.cdr.detectChanges();

      return;
    }

    if (this.trackQueue.length <= 1) {

      this.audioPlayer.currentTime = 0;

      this.currentTime = 0;

      this.cdr.detectChanges();

      return;
    }

    const actualCurrentIndex = this.trackQueue.findIndex(
      track => track.id === this.currentTrack?.id
    );

    if (actualCurrentIndex >= 0) {

      this.queueIndex = actualCurrentIndex;
    }

    let previousIndex = this.queueIndex - 1;

    if (previousIndex < 0) {

      previousIndex = this.repeatMode === 'all'
        ? this.trackQueue.length - 1
        : 0;
    }

    const previous = this.trackQueue[previousIndex];

    if (!previous) return;

    this.queueIndex = previousIndex;

    await this.playTrack(previous, true);
  }

  // ==========================================
  // SHUFFLE ON/OFF
  // ==========================================

  toggleShuffle() {

    this.isShuffleEnabled = !this.isShuffleEnabled;

    console.log(
      this.isShuffleEnabled
        ? 'Shuffle Enabled'
        : 'Shuffle Disabled'
    );
  }

  // ==========================================
  // REPEAT CYCLE
  // ==========================================

  toggleRepeat() {

    if (this.repeatMode === 'off') {

      this.repeatMode = 'all';

    } else if (this.repeatMode === 'all') {

      this.repeatMode = 'one';

    } else {

      this.repeatMode = 'off';
    }
  }

  // ==========================================
  // AUTOMATIC NEXT WHEN CURRENT TRACK ENDS
  // ==========================================

  async handleTrackEnded() {

    if (this.repeatMode === 'one' && this.audioPlayer) {

      this.audioPlayer.currentTime = 0;

      try {

        await this.audioPlayer.play();

      } catch (error) {

        console.error('Repeat-one playback error:', error);

        this.isPlaying = false;
      }

      this.cdr.detectChanges();

      return;
    }

    if (this.isShuffleEnabled && this.trackQueue.length > 1) {

      await this.nextTrack();

      return;
    }

    if (this.queueIndex < this.trackQueue.length - 1) {

      await this.nextTrack();

      return;
    }

    if (this.repeatMode === 'all' && this.trackQueue.length > 1) {

      await this.nextTrack();

      return;
    }

    this.isPlaying = false;

    this.currentTime = this.duration;

    this.cdr.detectChanges();
  }

  // ==========================================
  // PLAY / PAUSE
  // ==========================================

  async toggleExternalPlayback() {

    if (!this.audioPlayer || !this.currentTrack) return;

    if (this.isPlaying) {

      this.audioPlayer.pause();

      this.isPlaying = false;

      return;
    }

    try {

      await this.audioPlayer.play();

      this.ngZone.run(() => {

        if (!this.audioPlayer) return;

        this.isPlaying = true;

        this.updatePlayerProgress(this.audioPlayer);

        this.cdr.detectChanges();
      });

    } catch (error) {

      console.error('Playback error:', error);

      this.isPlaying = false;

      alert('Hindi maituloy ang playback. Subukan ulit.');
    }
  }

  // ==========================================
  // SEEK MUSIC
  // ==========================================

  seekMusic(event: Event) {

    const input = event.target as HTMLInputElement;

    if (!this.audioPlayer) return;

    const nextTime = Number(input.value);

    const audioDuration = this.audioPlayer.duration;

    if (
      !Number.isFinite(nextTime) ||
      !Number.isFinite(audioDuration) ||
      audioDuration <= 0
    ) {
      return;
    }

    const safeTime = Math.max(
      0,
      Math.min(nextTime, audioDuration)
    );

    this.audioPlayer.currentTime = safeTime;

    this.currentTime = safeTime;

    this.cdr.detectChanges();
  }

  // ==========================================
  // CHANGE MUSIC VOLUME
  // ==========================================

  changeMusicVolume(event: Event) {

    const input = event.target as HTMLInputElement;

    const nextVolume = Number(input.value);

    if (!Number.isFinite(nextVolume)) return;

    this.volume = Math.min(1, Math.max(0, nextVolume));

    if (this.audioPlayer) {

      this.audioPlayer.volume = this.volume;
    }
  }

  // ==========================================
  // FORMAT MUSIC TIME
  // ==========================================

  formatMusicTime(seconds: number): string {

    if (!Number.isFinite(seconds) || seconds < 0) {

      return '0:00';
    }

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  // ==========================================
  // STOP MUSIC PLAYER
  // ==========================================

  stopExternalMusic(clearQueue = true) {

    if (this.audioPlayer) {

      const oldPlayer = this.audioPlayer;

      this.audioPlayer = null;

      oldPlayer.pause();

      oldPlayer.onloadedmetadata = null;

      oldPlayer.ontimeupdate = null;

      oldPlayer.ondurationchange = null;

      oldPlayer.onseeked = null;

      oldPlayer.onplay = null;

      oldPlayer.onpause = null;

      oldPlayer.onended = null;

      oldPlayer.onerror = null;

      oldPlayer.removeAttribute('src');

      oldPlayer.load();
    }

    this.currentTrack = null;

    this.isPlaying = false;

    this.currentTime = 0;

    this.duration = 0;

    this.isPlayerExpanded = false;

    if (clearQueue) {

      this.trackQueue = [];

      this.queueIndex = -1;
    }
  }

  ngOnDestroy() {

    this.stopExternalMusic();
  }

  // ==========================================
  // OTHER FUNCTIONS
  // ==========================================

  openArtist(artistName: string) {

    this.changeTab('search');

    this.searchDatabaseSongs(artistName);
  }

  showCollaborativeMessage() {

    alert('Collaborative Playlist will be available in a future update.');
  }
}
