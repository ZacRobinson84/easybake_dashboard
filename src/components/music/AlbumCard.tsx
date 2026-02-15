import { useRef, useState } from 'react';
import ColorThief from 'colorthief';
import { Music2 } from 'lucide-react';

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

interface AlbumCardProps {
  title: string;
  artist: string;
  coverUrl: string | null;
  type: string;
}

export default function AlbumCard({ title, artist, coverUrl, type }: AlbumCardProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [imgFailed, setImgFailed] = useState(false);

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

  const hasGradient = !!gradientStyle;

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg ring-2 ring-white/70 bg-white transition-all hover:shadow-lg">
      <div className="relative overflow-hidden rounded-t-lg bg-gray-100 aspect-[1/1]">
        {coverUrl && !imgFailed ? (
          <img
            ref={imgRef}
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            onError={() => setImgFailed(true)}
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex w-full h-full items-center justify-center text-gray-400">
            <Music2 className="h-12 w-12" />
          </div>
        )}
      </div>
      <div className="flex-1 border-t-2 border-white/20 p-3" style={gradientStyle}>
        <p className={`line-clamp-2 text-sm font-semibold ${hasGradient ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className={`mt-1 line-clamp-1 text-xs ${hasGradient ? 'text-white/80' : 'text-gray-500'}`}>
          {artist}
        </p>
        {type === 'EP' && (
          <span className={`mt-1 inline-block text-[10px] font-medium ${hasGradient ? 'text-white/60' : 'text-gray-400'}`}>
            EP
          </span>
        )}
      </div>
    </div>
  );
}
