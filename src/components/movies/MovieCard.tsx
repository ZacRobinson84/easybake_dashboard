import { useRef, useState } from 'react';
import ColorThief from 'colorthief';
import { Film, Skull, X } from 'lucide-react';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

interface DirectorFilm {
  title: string;
  year: string;
  posterUrl: string | null;
}

interface MovieCardProps {
  title: string;
  posterUrl: string | null;
  director: string | null;
  directorId: number | null;
  cast: string[];
  tmdbUrl: string;
  isHorror?: boolean;
}

export default function MovieCard({ title, posterUrl, director, directorId, cast, tmdbUrl, isHorror }: MovieCardProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [flipped, setFlipped] = useState(false);
  const [filmography, setFilmography] = useState<DirectorFilm[] | null>(null);
  const [filmoLoading, setFilmoLoading] = useState(false);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    try {
      const colorThief = new ColorThief();
      const [r, g, b] = colorThief.getColor(img);
      const [h, s] = rgbToHsl(r, g, b);
      const [r1, g1, b1] = hslToRgb(h, Math.min(s, 0.5), 0.74);
      const [r2, g2, b2] = hslToRgb(h, Math.min(s, 0.6), 0.60);
      setGradientStyle({
        background: `linear-gradient(to top, rgb(${r1},${g1},${b1}), rgb(${r2},${g2},${b2}))`,
      });
    } catch {
      // fallback to default
    }
  };

  const handlePosterClick = () => {
    if (!directorId) return;
    if (!flipped && filmography === null && !filmoLoading) {
      setFilmoLoading(true);
      fetch(`/api/movies/director/${directorId}/filmography`)
        .then((res) => res.json())
        .then((data: DirectorFilm[]) => {
          setFilmography(data);
          setFilmoLoading(false);
        })
        .catch(() => {
          setFilmography([]);
          setFilmoLoading(false);
        });
    }
    setFlipped(!flipped);
  };

  const hasGradient = !!gradientStyle;
  const reversedGradientStyle: React.CSSProperties | undefined = gradientStyle?.background
    ? { background: (gradientStyle.background as string).replace('to top', 'to bottom') }
    : undefined;

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg ring-2 ring-white/70 bg-white transition-all hover:shadow-lg">
      <div
        className="relative overflow-hidden rounded-t-lg bg-gray-100 aspect-[2/3] cursor-pointer"
        onClick={handlePosterClick}
      >
        {!flipped ? (
          <>
            {posterUrl ? (
              <img
                ref={imgRef}
                crossOrigin="anonymous"
                onLoad={handleImageLoad}
                src={posterUrl}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex w-full h-full items-center justify-center text-gray-400">
                <Film className="h-12 w-12" />
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col w-full h-full overflow-y-auto p-2"
            style={reversedGradientStyle ?? { background: 'linear-gradient(to top, #c4b5fd, #8b5cf6)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide truncate">
                {director}'s Films
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
                className="flex-shrink-0 p-0.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {filmoLoading ? (
              <div className="flex-1 flex items-center justify-center text-white/70 text-xs">Loading...</div>
            ) : (
              <ul className="space-y-0.5">
                {filmography?.map((film, i) => (
                  <li key={i} className="text-[11px] leading-tight text-white/90 truncate">
                    {film.title} {film.year && <span className="text-white/60">({film.year})</span>}
                  </li>
                ))}
                {filmography?.length === 0 && (
                  <li className="text-xs text-white/60">No films found</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="relative flex-1 border-t-2 border-white/20 p-3" style={gradientStyle}>
        {isHorror && <Skull className="absolute top-1.5 right-1.5 h-5 w-5 text-white" />}
        <a
          href={tmdbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`line-clamp-2 text-sm font-semibold hover:underline ${hasGradient ? 'text-white' : 'text-gray-900'}`}
        >
          {title}
        </a>
        {director && (
          <p className={`mt-1 text-xs ${hasGradient ? 'text-white/80' : 'text-gray-500'}`}>
            Dir. {director}
          </p>
        )}
        {cast.length > 0 && (
          <p className={`mt-1 line-clamp-2 text-xs ${hasGradient ? 'text-white/70' : 'text-gray-400'}`}>
            {cast.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
