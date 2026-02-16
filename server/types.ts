export interface IGDBExternalGame {
  category: number;
  uid: string;
}

export interface IGDBCover {
  url: string;
}

export interface IGDBPlatform {
  name: string;
}

export interface IGDBWebsite {
  category: number;
  url: string;
}

export interface IGDBGame {
  id: number;
  name: string;
  cover?: IGDBCover;
  platforms?: IGDBPlatform[];
  external_games?: IGDBExternalGame[];
  websites?: IGDBWebsite[];
  hypes?: number;
  follows?: number;
}

export interface GameRelease {
  id: number;
  name: string;
  coverUrl: string | null;
  platforms: string[];
  steamAppId: string | null;
  websiteUrl: string | null;
  hypes: number;
  follows: number;
}

export interface SteamReviewSummary {
  totalPositive: number;
  totalNegative: number;
  totalReviews: number;
  reviewScoreDesc: string;
}

export interface GameReleaseWithReviews extends GameRelease {
  steamReviews: SteamReviewSummary | null;
  steamDescription: string | null;
}

export interface MovieRelease {
  id: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string;
  director: string | null;
  directorId: number | null;
  cast: string[];
  overview: string;
  tmdbUrl: string;
  fridayDate: string;
  revenue: number | null;
  popularity?: number;
  isHorror?: boolean;
}

export interface DirectorFilm {
  title: string;
  year: string;
  posterUrl: string | null;
}

export interface AlbumRelease {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string;
  type: string;
  fridayDate: string;
  artistListeners?: number | null;
  inSpotifyLibrary?: boolean;
  genre?: string;
}

export interface ChartTrack {
  name: string;
  artist: string;
  playcount: number;
  listeners: number;
  url: string;
  imageUrl: string | null;
}

export interface ChartAlbum {
  name: string;
  artist: string;
  url: string;
  imageUrl: string | null;
  genre: string;
  releaseDate: string | null;
}

export interface ChartArtist {
  name: string;
  playcount: number;
  listeners: number;
  url: string;
  imageUrl: string | null;
}

export interface TopChartsResponse {
  topTracks: ChartTrack[];
  topAlbums: ChartAlbum[];
  topArtists: ChartArtist[];
  topAlbumsByGenre: Record<string, ChartAlbum[]>;
}
