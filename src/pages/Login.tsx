import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Login failed');
      setPassword('');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#E8CEBF] p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#BB7044]/15 p-8">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/bread_cat.png" alt="Logo" className="h-16 w-16 rounded-full" />
          <h1 className="text-xl font-bold text-white">Dashboard Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/25"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
