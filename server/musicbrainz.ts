import type { AlbumRelease } from './types.ts';

let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getUpcomingFriday(): string {
  const now = new Date();
  const day = now.getDay();
  let diff: number;
  if (day === 6) {
    diff = -1;
  } else if (day === 0) {
    diff = -2;
  } else {
    diff = 5 - day;
  }
  const friday = new Date(now);
  friday.setDate(friday.getDate() + diff);
  return formatDate(friday);
}

interface MBReleaseArtistCredit {
  name: string;
}

interface MBReleaseGroup {
  id: string;
  'primary-type'?: string;
}

interface MBCoverArtArchive {
  front: boolean;
}

interface MBRelease {
  id: string;
  title: string;
  date?: string;
  status?: string;
  'artist-credit'?: MBReleaseArtistCredit[];
  'release-group'?: MBReleaseGroup;
  'cover-art-archive'?: MBCoverArtArchive;
}

export async function fetchUpcomingFridayAlbums(): Promise<AlbumRelease[]> {
  const friday = getUpcomingFriday();

  const query = `date:${friday} AND (primarytype:Album OR primarytype:EP) AND status:Official`;
  const url = `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&fmt=json&limit=100`;

  const res = await rateLimitedFetch(url, {
    headers: {
      'User-Agent': 'BakeBoard/1.0 (contact@email.com)',
    },
  });

  if (!res.ok) throw new Error(`MusicBrainz search failed: ${res.status}`);
  const data = (await res.json()) as { releases: MBRelease[] };

  const releases = data.releases ?? [];

  // Deduplicate by release-group id
  const seen = new Set<string>();
  const unique: MBRelease[] = [];
  for (const release of releases) {
    const rgId = release['release-group']?.id;
    if (!rgId || seen.has(rgId)) continue;
    seen.add(rgId);
    unique.push(release);
  }

  return unique.map((release): AlbumRelease => {
    const artist = release['artist-credit']?.map((c) => c.name).join(', ') ?? 'Unknown Artist';
    const rgId = release['release-group']?.id;
    return {
      id: release.id,
      title: release.title,
      artist,
      coverUrl: rgId
        ? `https://coverartarchive.org/release-group/${rgId}/front-500`
        : `https://coverartarchive.org/release/${release.id}/front-500`,
      releaseDate: release.date ?? friday,
      type: release['release-group']?.['primary-type'] ?? 'Album',
      fridayDate: friday,
    };
  });
}
