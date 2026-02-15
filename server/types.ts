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
}

export interface GameRelease {
  id: number;
  name: string;
  coverUrl: string | null;
  platforms: string[];
  steamAppId: string | null;
  websiteUrl: string | null;
}

export interface SteamReviewSummary {
  totalPositive: number;
  totalNegative: number;
  totalReviews: number;
  reviewScoreDesc: string;
}

export interface GameReleaseWithReviews extends GameRelease {
  steamReviews: SteamReviewSummary | null;
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
}
