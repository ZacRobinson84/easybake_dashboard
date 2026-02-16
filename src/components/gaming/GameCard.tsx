import { useRef, useState } from 'react';
import ColorThief from 'colorthief';
import { Gamepad2, ThumbsUp, X } from 'lucide-react';

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

interface GameCardProps {
  name: string;
  coverUrl: string | null;
  platforms: string[];
  steamAppId: string | null;
  websiteUrl: string | null;
  steamReviews: {
    totalPositive: number;
    totalNegative: number;
    totalReviews: number;
    reviewScoreDesc: string;
  } | null;
  steamDescription: string | null;
}

export default function GameCard({ name, coverUrl, platforms, steamAppId, websiteUrl, steamReviews, steamDescription }: GameCardProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [flipped, setFlipped] = useState(false);

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
      // silently ignore — fallback to default white
    }
  };

  const href = steamAppId
    ? `https://store.steampowered.com/app/${steamAppId}`
    : websiteUrl ?? `https://store.steampowered.com/search/?term=${encodeURIComponent(name)}`;

  const hasGradient = !!gradientStyle;
  const reversedGradientStyle: React.CSSProperties | undefined = gradientStyle?.background
    ? { background: (gradientStyle.background as string).replace('to top', 'to bottom') }
    : undefined;

  const handleCoverClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (steamDescription) {
      setFlipped(!flipped);
    }
  };

  // Cards without a description: entire card is a link (original behavior)
  if (!steamDescription) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-full flex-col overflow-hidden rounded-lg ring-2 ring-white/70 bg-white transition-all hover:border-indigo-200 hover:shadow-lg"
      >
        <div className="overflow-hidden rounded-t-lg bg-gray-100 aspect-[3/4]">
          {coverUrl ? (
            <img
              ref={imgRef}
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              src={coverUrl}
              alt={name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <Gamepad2 className="h-12 w-12" />
            </div>
          )}
        </div>
        <div className="flex-1 border-t-2 border-white/20 p-3" style={gradientStyle}>
          <h3 className={`line-clamp-2 text-sm font-semibold ${hasGradient ? 'text-white' : 'text-gray-900'}`}>{name}</h3>
          {platforms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {platforms.map((platform) => (
                <span
                  key={platform}
                  className={`rounded-full px-2 py-0.5 text-xs ${hasGradient ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {platform}
                </span>
              ))}
            </div>
          )}
          {steamReviews && (
            <div className={`mt-2 flex items-center gap-1 text-xs ${hasGradient ? 'text-white/80' : 'text-gray-500'}`}>
              <ThumbsUp className="h-3 w-3" />
              <span>{steamReviews.totalReviews.toLocaleString()} reviews</span>
              {steamReviews.reviewScoreDesc && !steamReviews.reviewScoreDesc.includes('user reviews') && (
                <>
                  <span className={hasGradient ? 'text-white/60' : 'text-gray-400'}>·</span>
                  <span>{steamReviews.reviewScoreDesc}</span>
                </>
              )}
            </div>
          )}
        </div>
      </a>
    );
  }

  // Cards with a description: cover area is clickable to flip, info section links to Steam
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg ring-2 ring-white/70 bg-white transition-all hover:shadow-lg">
      <div
        className="relative overflow-hidden rounded-t-lg bg-gray-100 cursor-pointer aspect-[3/4]"
        onClick={handleCoverClick}
      >
        {!flipped ? (
          <>
            {coverUrl ? (
              <img
                ref={imgRef}
                crossOrigin="anonymous"
                onLoad={handleImageLoad}
                src={coverUrl}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <Gamepad2 className="h-12 w-12" />
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col w-full h-full overflow-y-auto p-3"
            style={reversedGradientStyle ?? { background: 'linear-gradient(to top, #c4b5fd, #8b5cf6)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">
                About
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
                className="flex-shrink-0 p-0.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-white/90">
              {steamDescription}
            </p>
          </div>
        )}
      </div>
      <div className="flex-1 border-t-2 border-white/20 p-3" style={gradientStyle}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`line-clamp-2 text-sm font-semibold hover:underline ${hasGradient ? 'text-white' : 'text-gray-900'}`}
        >
          {name}
        </a>
        {platforms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {platforms.map((platform) => (
              <span
                key={platform}
                className={`rounded-full px-2 py-0.5 text-xs ${hasGradient ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {platform}
              </span>
            ))}
          </div>
        )}
        {steamReviews && (
          <div className={`mt-2 flex items-center gap-1 text-xs ${hasGradient ? 'text-white/80' : 'text-gray-500'}`}>
            <ThumbsUp className="h-3 w-3" />
            <span>{steamReviews.totalReviews.toLocaleString()} reviews</span>
            {steamReviews.reviewScoreDesc && !steamReviews.reviewScoreDesc.includes('user reviews') && (
              <>
                <span className={hasGradient ? 'text-white/60' : 'text-gray-400'}>·</span>
                <span>{steamReviews.reviewScoreDesc}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
