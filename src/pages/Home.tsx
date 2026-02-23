import { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useAuth } from '../AuthContext';
import WatchedItemsWidget from '../components/home/WatchedItemsWidget';
import NewsWidget from '../components/home/NewsWidget';

interface ForecastEntry {
  dt: number;
  main: { temp_min: number; temp_max: number };
  weather: { icon: string; description: string }[];
}

interface DaySummary {
  label: string;
  dayName: string;
  high: number;
  low: number;
  icon: string;
  description: string;
}

const FALLBACK_LAT = 44.98;
const FALLBACK_LON = -64.13;

export default function Home() {
  const { authFetch } = useAuth();
  const [days, setDays] = useState<DaySummary[]>([]);
  const [cityName, setCityName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = (lat: number, lon: number) => {
      authFetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          return res.json();
        })
        .then((data: {
          current: { name: string; main: { temp: number; temp_min: number; temp_max: number }; weather: { icon: string; description: string }[] };
          forecast: { city: { name: string }; list: ForecastEntry[] };
        }) => {
          setCityName(data.current.name);

          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const todayDn = dayNames[new Date().getDay()];

          // Today from current weather
          const summaries: DaySummary[] = [{
            label: 'Today',
            dayName: todayDn,
            high: Math.round(data.current.main.temp_max),
            low: Math.round(data.current.main.temp_min),
            icon: data.current.weather[0].icon,
            description: data.current.weather[0].description,
          }];

          // Group forecast entries by local date
          const toLocalDate = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const today = toLocalDate(new Date());
          const grouped = new Map<string, ForecastEntry[]>();
          for (const entry of data.forecast.list) {
            const key = toLocalDate(new Date(entry.dt * 1000));
            if (key === today) continue;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(entry);
          }

          for (const [dateKey, entries] of grouped) {
            if (summaries.length >= 5) break;
            const highs = entries.map((e) => e.main.temp_max);
            const lows = entries.map((e) => e.main.temp_min);
            const middayEntry = entries.find((e) => {
              const h = new Date(e.dt * 1000).getHours();
              return h >= 11 && h <= 14;
            }) || entries[Math.floor(entries.length / 2)];

            const date = new Date(dateKey + 'T12:00:00');
            const dn = dayNames[date.getDay()];
            summaries.push({
              label: dn,
              dayName: dn,
              high: Math.round(Math.max(...highs)),
              low: Math.round(Math.min(...lows)),
              icon: middayEntry.weather[0].icon,
              description: middayEntry.weather[0].description,
            });
          }

          setDays(summaries);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to fetch weather');
          setLoading(false);
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(FALLBACK_LAT, FALLBACK_LON),
        { timeout: 5000 },
      );
    } else {
      fetchWeather(FALLBACK_LAT, FALLBACK_LON);
    }
  }, []);

  const containerStyle = { clipPath: 'polygon(0 0, calc(100% - 2.25rem) 0, 100% 2.25rem, 100% 100%, 0 100%)' };

  return (
    <div className="p-6 md:p-10 space-y-6">
      {/* Weather Widget */}
      <div className="max-w-xl rounded-xl bg-[#BB7044]/15 p-4" style={containerStyle}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="h-4 w-4 text-white/50" />
            <h2 className="text-base font-semibold text-white/70 font-nunito-black">
              {cityName || '5-Day Forecast'}
            </h2>
          </div>
          <div className="h-px flex-1 bg-white/15 mr-2" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && days.length === 0 && (
          <div className="py-10 text-center text-gray-500">
            No forecast data available
          </div>
        )}

        {!loading && !error && days.length > 0 && (
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {days.map((day, i) => {
              const positionColors = [
                'bg-amber-500/15',
                'bg-rose-500/15',
                'bg-sky-500/15',
                'bg-emerald-500/15',
                'bg-indigo-500/15',
              ];
              return (
              <div
                key={day.label}
                className={`flex flex-col items-center rounded-lg p-2 sm:p-3 ${positionColors[i]}`}
              >
                <span className="text-xs font-semibold text-white/70 sm:text-sm">{day.label}</span>
                <img
                  src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                  alt={day.description}
                  className="h-10 w-10 sm:h-12 sm:w-12"
                />
                <span className="text-sm font-bold text-white">{day.high}°</span>
                <span className="text-xs text-white/40">{day.low}°</span>
                <span className="mt-1 text-center text-[10px] leading-tight text-white/50 sm:text-xs">
                  {day.description}
                </span>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* News Widget */}
      <NewsWidget />

      {/* Watched Items Widget */}
      <WatchedItemsWidget />
    </div>
  );
}
