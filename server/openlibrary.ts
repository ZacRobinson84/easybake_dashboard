export interface BookSearchResult {
  id: string;
  title: string;
  subtitle: string; // author name
  imageUrl: string | null;
  releaseDate: string; // first_publish_year as string
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status}`);
  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };

  return (data.docs ?? []).map((doc): BookSearchResult => {
    // key is like "/works/OL12345W" — extract the ID portion
    const rawKey = doc.key ?? '';
    const id = rawKey.startsWith('/works/') ? rawKey.slice(7) : rawKey;
    const imageUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null;
    return {
      id,
      title: doc.title ?? '',
      subtitle: doc.author_name?.[0] ?? '',
      imageUrl,
      releaseDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
    };
  });
}
