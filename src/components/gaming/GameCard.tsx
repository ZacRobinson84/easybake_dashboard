import { Gamepad2, ThumbsUp } from 'lucide-react';

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
}

export default function GameCard({ name, coverUrl, platforms, steamAppId, websiteUrl, steamReviews }: GameCardProps) {
  const href = steamAppId
    ? `https://store.steampowered.com/app/${steamAppId}`
    : websiteUrl ?? `https://store.steampowered.com/search/?term=${encodeURIComponent(name)}`;

  const content = (
    <>
      <div className="overflow-hidden rounded-t-lg bg-gray-100">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={name}
            className="w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <Gamepad2 className="h-12 w-12" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{name}</h3>
        {platforms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {platforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {platform}
              </span>
            ))}
          </div>
        )}
        {steamReviews && (
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <ThumbsUp className="h-3 w-3" />
            <span>{steamReviews.totalReviews.toLocaleString()} reviews</span>
            <span className="text-gray-400">·</span>
            <span>{steamReviews.reviewScoreDesc}</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-indigo-200 hover:shadow-lg"
    >
      {content}
    </a>
  );
}
