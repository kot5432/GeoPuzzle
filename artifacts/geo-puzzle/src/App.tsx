import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Compass, Camera, Check, ChevronRight, CircleHelp, Clock3, Crosshair, Eye, Github, History, Home, Info, Instagram, KeyRound, LockKeyhole, LogOut, Mail, MapPinned, Menu, Navigation, PartyPopper, Route as RouteIcon, ShieldCheck, Sparkles, Target, UserRound, X, type LucideIcon } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
const SESSION_KEY = 'geopuzzle-session';
const USERS_KEY = 'geopuzzle-users';
const MISSION_KEY = 'geopuzzle-mission';

type Session = { email: string; displayName: string; joinedAt: string };
type MissionState = { distance: number; verified: boolean; captured: boolean; completed: boolean; photo?: string };

const destination = {
  name: '神楽坂の赤城神社',
  romanized: 'Akagi Shrine, Kagurazaka',
  city: '東京都 新宿区',
  clue: '石段の先で、街の喧騒が一度だけ消える場所。',
  detail: '隈研吾の建築と、静かな境内。神楽坂の路地から探してみよう。',
  walk: '徒歩 8分',
  distance: '0.6 km',
  color: '#d87351',
};

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const initialMission: MissionState = { distance: 420, verified: false, captured: false, completed: false };

function saveMission(next: MissionState) {
  localStorage.setItem(MISSION_KEY, JSON.stringify(next));
}

function useSession() {
  const [session, setSession] = useState<Session | null>(() => readStorage<Session | null>(SESSION_KEY, null));
  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };
  return { session, setSession, signOut };
}

function App() {
  const auth = useSession();
  useEffect(() => {
    document.title = 'GeoPuzzle — 旅先の謎を解く';
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link');
    icon.rel = 'icon';
    icon.href = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#173640"/><path d="M32 10c-10 0-18 8-18 18 0 13 18 27 18 27s18-14 18-27c0-10-8-18-18-18Z" fill="#f1c66b"/><circle cx="32" cy="28" r="6" fill="#173640"/></svg>')}`;
    document.head.appendChild(icon);
    const description = document.querySelector('meta[name="description"]') ?? document.createElement('meta');
    description.setAttribute('name', 'description');
    description.setAttribute('content', 'GeoPuzzleで、日本の街に隠れたランドマークを探す。');
    document.head.appendChild(description);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/auth"><AuthPage onSignedIn={auth.setSession} /></Route>
              <Route path="/navigate"><Protected session={auth.session}><NavigatePage /></Protected></Route>
              <Route path="/capture"><Protected session={auth.session}><CapturePage /></Protected></Route>
              <Route path="/complete"><Protected session={auth.session}><CompletePage /></Protected></Route>
              <Route path="/profile"><Protected session={auth.session}><ProfilePage session={auth.session} onSignOut={auth.signOut} /></Protected></Route>
              <Route path="/"><AppShell session={auth.session} onSignOut={auth.signOut}><HomePage session={auth.session} /></AppShell></Route>
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Protected({ session, children }: { session: Session | null; children: ReactNode }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!session) setLocation('/auth');
  }, [session, setLocation]);
  return session ? <>{children}</> : <LoadingScreen />;
}

function LoadingScreen() {
  return <main className="min-h-[100dvh] bg-[#f4f0e6] flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-[#d7dfd6] border-t-[#1e7471] animate-spin" aria-label="読み込み中" /></main>;
}

function AppShell({ session, onSignOut, children }: { session: Session | null; onSignOut: () => void; children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/', label: 'ホーム', icon: Home },
    { href: '/navigate', label: '探索', icon: Compass },
    { href: '/profile', label: '記録', icon: History },
  ];
  return (
    <div className="grain min-h-[100dvh] bg-[#f4f0e6] text-[#20373f]">
      <header className="relative z-20 border-b border-[#d6d8ca] bg-[#f4f0e6]/90 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#173640] text-[#f1c66b] shadow-[4px_4px_0_#d6a957]"><MapPinned size={21} strokeWidth={2.5} /></span>
            <span><span className="block font-display text-[17px] font-extrabold tracking-tight">GeoPuzzle</span><span className="block font-mono text-[8px] uppercase tracking-[.24em] text-[#668078]">歩いて、見つける。</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="メインナビゲーション">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} data-testid={`link-nav-${label}`} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${location === href ? 'bg-[#d9e5dc] text-[#176a69]' : 'text-[#667771] hover:bg-[#e7e8de] hover:text-[#20373f]'}`}><Icon size={16} />{label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {session ? <Link href="/profile" className="hidden items-center gap-2 rounded-full bg-[#e5eadf] py-1.5 pl-1.5 pr-3 text-sm font-semibold sm:flex" data-testid="link-header-profile"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#dd7552] text-xs font-bold text-white">{initials(session.displayName)}</span>{session.displayName}</Link> : <Link href="/auth" data-testid="link-header-auth" className="rounded-full bg-[#173640] px-4 py-2 text-sm font-bold text-[#f4f0e6]">ログイン</Link>}
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-lg p-2 text-[#48625f] md:hidden" aria-label="メニューを開く" data-testid="button-open-menu"><Menu size={23} /></button>
          </div>
        </div>
        {menuOpen && <div className="absolute left-0 right-0 top-[72px] border-b border-[#d6d8ca] bg-[#f4f0e6] p-3 shadow-lg md:hidden">{navItems.map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} key={href} href={href} data-testid={`link-mobile-nav-${label}`} className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold hover:bg-[#e7e8de]"><Icon size={18} />{label}</Link>)}{session && <button onClick={onSignOut} type="button" className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-semibold text-[#b24d3d]" data-testid="button-mobile-logout"><LogOut size={18} />ログアウト</button>}</div>}
      </header>
      {children}
      <nav className="mobile-bottom-nav safe-bottom fixed bottom-0 left-0 right-0 z-30 hidden items-center justify-around border-t border-[#d6d8ca] bg-[#f4f0e6]/95 px-2 pt-2 backdrop-blur-lg md:hidden" aria-label="モバイルナビゲーション">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-bottom-nav-${label}`} className={`flex min-w-[70px] flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold ${location === href ? 'text-[#176a69]' : 'text-[#7b8981]'}`}><Icon size={20} /><span>{label}</span></Link>)}
      </nav>
    </div>
  );
}

function HomePage({ session }: { session: Session | null }) {
  const [, setLocation] = useLocation();
  const [mission] = useState(() => readStorage<MissionState>(MISSION_KEY, initialMission));
  const greeting = session ? `${session.displayName}さん、` : '今日の旅に、';
  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
      <section className="grid items-stretch gap-6 lg:grid-cols-[1.12fr_.88fr]">
        <div className="relative min-h-[425px] overflow-hidden rounded-[28px] bg-[#173640] p-7 text-[#f6f0e2] shadow-[0_22px_55px_rgba(26,57,64,.16)] sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#f1c66b]/20" /><div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-[#f1c66b]/20" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#122c34] to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="animate-rise"><div className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[.24em] text-[#f1c66b]"><Sparkles size={15} /> mission 04 / 12</div><p className="mb-3 text-sm text-[#b2c2b4]">{greeting}次のランドマークを探そう。</p><h1 className="max-w-[560px] font-display text-4xl font-extrabold leading-[1.04] tracking-[-.04em] sm:text-6xl">街の中に、<br /><span className="text-[#f1c66b]">まだ知らない</span><br />景色がある。</h1></div>
            <div className="animate-rise delay-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 font-mono text-[10px] uppercase tracking-[.2em] text-[#91aaa0]">today's clue</p><p className="max-w-[340px] text-sm leading-relaxed text-[#d8e0d5]">「石段の先で、街の喧騒が一度だけ消える場所。」</p></div><button type="button" onClick={() => setLocation(session ? '/navigate' : '/auth')} className="group flex shrink-0 items-center justify-between gap-5 rounded-full bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[4px_4px_0_#a74e3b] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-start-mission"><span>{session ? '探索を再開' : '旅をはじめる'}</span><ChevronRight size={18} className="transition-transform group-hover:translate-x-1" /></button></div>
          </div>
        </div>
        <MapPreview />
      </section>
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Target} number={mission.completed ? '04' : '03'} label="見つけた場所" accent="teal" />
        <StatCard icon={RouteIcon} number="12.8" label="歩いた距離 / km" accent="gold" />
        <StatCard icon={Clock3} number="02:41" label="今月の探索時間" accent="coral" />
      </section>
      <section className="mt-12 grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
        <div><p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.24em] text-[#668078]">how it works</p><h2 className="font-display text-3xl font-extrabold leading-tight tracking-[-.03em]">4つの手がかりで、<br />街を読み解く。</h2><p className="mt-4 max-w-sm text-sm leading-7 text-[#65756e]">答えを検索するのではなく、足で近づき、目で確かめる。GeoPuzzleは旅を小さな冒険に変えます。</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <StepCard index="01" title="手がかりを読む" text="場所を示す短い謎を受け取る。" icon={Eye} /><StepCard index="02" title="歩いて近づく" text="地図を頼りに、答えのそばへ。" icon={Navigation} /><StepCard index="03" title="現地で証明する" text="範囲内に入ると、謎がほどける。" icon={Crosshair} /><StepCard index="04" title="記念に残す" text="一枚の写真で旅を完了。" icon={Camera} />
        </div>
      </section>
    </main>
  );
}

function MapPreview() {
  return <div className="relative min-h-[425px] overflow-hidden rounded-[28px] border border-[#cfd8cb] bg-[#dbe5d8] shadow-[0_14px_38px_rgba(31,53,62,.08)]"><div className="map-grid absolute inset-0" /><div className="map-water -right-12 top-8 h-56 w-48 rotate-12 opacity-80" /><div className="map-water -bottom-16 -left-16 h-48 w-72 -rotate-12 opacity-50" /><div className="map-road left-[12%] top-[34%] w-[78%] rotate-[22deg]" /><div className="map-road left-[18%] top-[65%] w-[70%] rotate-[-14deg]" /><div className="map-road left-[42%] top-[10%] w-[64%] rotate-[78deg] opacity-40" /><div className="absolute left-[18%] top-[20%] rounded-full bg-[#f4f0e6]/75 px-3 py-1 font-mono text-[9px] font-bold tracking-[.14em] text-[#618073]">神楽坂</div><div className="absolute left-[54%] top-[46%] grid h-5 w-5 place-items-center rounded-full bg-[#e47750] text-white map-pin"><span className="h-1.5 w-1.5 rounded-full bg-white" /></div><div className="absolute bottom-5 left-5 right-5 flex items-end justify-between"><div className="rounded-2xl bg-[#f4f0e6]/90 p-4 backdrop-blur-sm"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#668078]">hidden landmark</p><p className="mt-1 font-display text-lg font-bold text-[#20373f]">神楽坂の赤城神社</p></div><div className="grid h-11 w-11 place-items-center rounded-full bg-[#173640] text-[#f1c66b]"><Compass size={20} /></div></div></div>;
}

function StatCard({ icon: Icon, number, label, accent }: { icon: LucideIcon; number: string; label: string; accent: string }) {
  const colors: Record<string, string> = { teal: 'bg-[#d7e7df] text-[#1e7471]', gold: 'bg-[#f2e4bc] text-[#a7761f]', coral: 'bg-[#f4ddd3] text-[#bc5c43]' };
  return <div className="flex items-center gap-4 rounded-2xl border border-[#dedfd4] bg-[#f9f7f0] p-4"><div className={`grid h-11 w-11 place-items-center rounded-xl ${colors[accent]}`}><Icon size={20} /></div><div><p className="font-display text-2xl font-extrabold">{number}</p><p className="text-xs text-[#718078]">{label}</p></div></div>;
}

function StepCard({ index, title, text, icon: Icon }: { index: string; title: string; text: string; icon: LucideIcon }) {
  return <div className="group rounded-2xl border border-[#dedfd4] bg-[#f9f7f0] p-5 transition-transform hover:-translate-y-1"><div className="flex items-center justify-between"><span className="font-mono text-[10px] text-[#dd7552]">{index}</span><Icon size={19} className="text-[#1e7471]" /></div><h3 className="mt-7 font-display text-lg font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#718078]">{text}</p></div>;
}

function AuthPage({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [oauthNote, setOauthNote] = useState('');

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalized = email.trim().toLowerCase();
    if (!name.trim() && mode === 'signup') return setError('表示名を入力してください。');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return setError('メールアドレスの形式を確認してください。');
    if (password.length < 8) return setError('パスワードは8文字以上で入力してください。');
    const users = readStorage<{ email: string; password: string; displayName: string }[]>(USERS_KEY, []);
    const found = users.find((user) => user.email === normalized);
    if (mode === 'signin' && (!found || found.password !== password)) return setError('メールアドレスまたはパスワードが一致しません。');
    if (mode === 'signup' && found) return setError('このメールアドレスはすでに登録されています。');
    const displayName = mode === 'signup' ? name.trim() : found?.displayName ?? normalized.split('@')[0];
    if (mode === 'signup') localStorage.setItem(USERS_KEY, JSON.stringify([...users, { email: normalized, password, displayName }]));
    const session = { email: normalized, displayName, joinedAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    onSignedIn(session);
    setNotice(mode === 'signup' ? 'アカウントを作成しました。' : 'おかえりなさい。');
    setLocation('/');
  };

  return <main className="grain grid min-h-[100dvh] bg-[#173640] lg:grid-cols-[.86fr_1.14fr]">
    <section className="relative hidden overflow-hidden p-10 text-[#f4f0e6] lg:flex lg:flex-col lg:justify-between"><div className="absolute -left-28 top-20 h-96 w-96 rounded-full border border-[#f1c66b]/15" /><div className="absolute bottom-20 right-10 h-64 w-64 rounded-full border border-[#f1c66b]/10" /><div className="relative"><Link href="/" className="flex items-center gap-3" data-testid="link-auth-brand"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#f1c66b] text-[#173640]"><MapPinned size={21} /></span><span className="font-display text-lg font-extrabold">GeoPuzzle</span></Link></div><div className="relative max-w-md"><p className="mb-5 font-mono text-[10px] uppercase tracking-[.25em] text-[#f1c66b]">a different kind of guide</p><h1 className="font-display text-6xl font-extrabold leading-[.98] tracking-[-.05em]">旅の答えは、<br /><span className="text-[#f1c66b]">歩いた先</span>にある。</h1><p className="mt-7 max-w-sm text-sm leading-7 text-[#b6c7bb]">地図に載っている場所ではなく、あなたが見つけた瞬間を記録する。</p></div><p className="relative font-mono text-[10px] tracking-[.2em] text-[#88a39a]">TOKYO / KYOTO / EVERYWHERE</p></section>
    <section className="flex items-center justify-center bg-[#f4f0e6] px-5 py-10 sm:px-8"><div className="w-full max-w-[430px] animate-rise"><div className="mb-10 lg:hidden"><Link href="/" className="flex items-center gap-3" data-testid="link-auth-mobile-brand"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#173640] text-[#f1c66b]"><MapPinned size={21} /></span><span className="font-display text-lg font-extrabold">GeoPuzzle</span></Link></div><p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">{mode === 'signin' ? 'welcome back' : 'make your first route'}</p><h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-.04em]">{mode === 'signin' ? '探索を続ける。' : '旅をはじめる。'}</h2><p className="mt-3 text-sm text-[#718078]">{mode === 'signin' ? '記録した場所と、次の手がかりが待っています。' : '無料でアカウントを作成して、最初の謎へ。'}</p><form onSubmit={submit} className="mt-8 space-y-4" noValidate>{mode === 'signup' && <Field label="表示名" icon={UserRound} value={name} onChange={setName} type="text" autoComplete="name" placeholder="旅人" testId="input-display-name" />}{<Field label="メールアドレス" icon={Mail} value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@example.com" testId="input-email" />}{<Field label="パスワード" icon={KeyRound} value={password} onChange={setPassword} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="8文字以上" testId="input-password" />}<div aria-live="polite">{error && <p className="rounded-xl bg-[#f5ded7] px-4 py-3 text-sm font-semibold text-[#a8493d]" data-testid="status-auth-error">{error}</p>}{notice && <p className="rounded-xl bg-[#d9e9dd] px-4 py-3 text-sm font-semibold text-[#1f7064]" data-testid="status-auth-notice">{notice}</p>}</div><button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-submit-auth">{mode === 'signin' ? 'ログイン' : 'アカウントを作成'}<ChevronRight size={17} /></button></form><div className="my-7 flex items-center gap-3 text-xs text-[#8a978d]"><span className="h-px flex-1 bg-[#d9dbd0]" />または<span className="h-px flex-1 bg-[#d9dbd0]" /></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setOauthNote('Googleログインは現在準備中です。メールアドレスでログインしてください。')} className="flex items-center justify-center gap-2 rounded-xl border border-[#d4d8cc] bg-[#faf8f1] px-3 py-3 text-sm font-semibold text-[#7b857e]" data-testid="button-oauth-google"><span className="font-display font-bold text-[#db6d4d]">G</span> Google</button><button type="button" onClick={() => setOauthNote('GitHubログインは現在準備中です。メールアドレスでログインしてください。')} className="flex items-center justify-center gap-2 rounded-xl border border-[#d4d8cc] bg-[#faf8f1] px-3 py-3 text-sm font-semibold text-[#7b857e]" data-testid="button-oauth-github"><Github size={16} /> GitHub</button></div>{oauthNote && <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#e9e8df] px-4 py-3 text-xs leading-5 text-[#63756d]" data-testid="status-oauth-note"><Info size={15} className="mt-0.5 shrink-0 text-[#dd7552]" />{oauthNote}</p>}<p className="mt-8 text-center text-sm text-[#718078]">{mode === 'signin' ? 'はじめてですか？' : 'すでにアカウントがありますか？'} <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setOauthNote(''); }} className="font-bold text-[#176a69] underline underline-offset-4" data-testid="button-toggle-auth-mode">{mode === 'signin' ? '新規登録' : 'ログインへ'}</button></p><p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-[#8b968e]"><LockKeyhole size={13} />入力内容はこのブラウザだけに保存されます</p></div></section>
  </main>;
}

function Field({ label, icon: Icon, value, onChange, type, autoComplete, placeholder, testId }: { label: string; icon: LucideIcon; value: string; onChange: (value: string) => void; type: string; autoComplete: string; placeholder: string; testId: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-[#3e5754]">{label}</span><span className="relative block"><Icon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#789087]" /><input required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} data-testid={testId} className="w-full rounded-xl border border-[#d3d8cc] bg-[#fbf9f3] py-3.5 pl-11 pr-4 text-sm text-[#20373f] outline-none transition-colors placeholder:text-[#a1aaa0] focus:border-[#1e7471] focus:ring-2 focus:ring-[#1e7471]/15" /></span></label>;
}

function NavigatePage() {
  const [, setLocation] = useLocation();
  const [mission, setMission] = useState<MissionState>(() => readStorage(MISSION_KEY, initialMission));
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const locate = () => {
    setLocating(true);
    setMessage('');
    window.setTimeout(() => {
      setMission((current) => { const next = { ...current, distance: Math.max(86, current.distance - 334) }; saveMission(next); return next; });
      setLocating(false);
      setMessage('現在地を確認しました。かなり近づいています。');
    }, 650);
  };
  const verify = () => {
    if (mission.distance > 100) return setMessage('もう少しだけ近づいてみましょう。範囲内まであと少しです。');
    const next = { ...mission, verified: true };
    setMission(next); saveMission(next); setLocation('/capture');
  };
  return <AppShell session={readStorage<Session | null>(SESSION_KEY, null)} onSignOut={() => { localStorage.removeItem(SESSION_KEY); setLocation('/auth'); }}><main className="mx-auto max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">mission 04 / navigate</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-.04em]">手がかりを追う。</h1></div><div className="rounded-full bg-[#d9e9dd] px-4 py-2 text-xs font-bold text-[#1e7471]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#1e7471]" />探索中</div></div><div className="grid gap-6 lg:grid-cols-[1.32fr_.68fr]"><div className="relative min-h-[510px] overflow-hidden rounded-[28px] border border-[#cfd8cb] bg-[#dbe5d8]"><div className="map-grid absolute inset-0" /><div className="map-water right-[-8%] top-[16%] h-64 w-72 rotate-12 opacity-80" /><div className="map-road left-[3%] top-[40%] w-[86%] rotate-[19deg]" /><div className="map-road left-[15%] top-[73%] w-[80%] rotate-[-18deg]" /><div className="map-road left-[48%] top-[8%] w-[70%] rotate-[79deg] opacity-40" /><div className="absolute left-[19%] top-[22%] rounded-full bg-[#f4f0e6]/75 px-3 py-1 font-mono text-[9px] font-bold tracking-[.12em] text-[#618073]">神楽坂</div><div className="absolute left-[29%] top-[56%] h-[35%] w-px origin-top rotate-[22deg] border-l-2 border-dashed border-[#1e7471]/60" /><div className="absolute left-[25%] top-[50%] grid h-9 w-9 place-items-center rounded-full border-4 border-[#f4f0e6] bg-[#1e7471] text-white shadow-lg"><Crosshair size={15} /></div><div className="absolute left-[54%] top-[42%] grid h-5 w-5 place-items-center rounded-full bg-[#e47750] text-white map-pin"><span className="h-1.5 w-1.5 rounded-full bg-white" /></div><div className="absolute bottom-5 left-5 rounded-2xl bg-[#f4f0e6]/90 px-4 py-3 backdrop-blur-sm"><p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#668078]">current area</p><p className="mt-1 text-sm font-bold">東京都 新宿区 神楽坂</p></div><div className="absolute right-5 top-5 rounded-xl bg-[#173640] px-3 py-2 font-mono text-[10px] text-[#f1c66b]">北 ↑</div></div><aside className="rounded-[28px] bg-[#173640] p-6 text-[#f4f0e6] sm:p-8"><div className="flex items-center justify-between"><span className="rounded-full bg-[#31555a] px-3 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-[#a9c1b2]">clue 01</span><CircleHelp size={18} className="text-[#f1c66b]" /></div><h2 className="mt-8 font-display text-3xl font-extrabold leading-tight">石段の先で、<br /><span className="text-[#f1c66b]">街の喧騒が消える。</span></h2><p className="mt-5 text-sm leading-7 text-[#b9c8bc]">{destination.detail}</p><div className="my-7 h-px bg-[#31555a]" /><div className="flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#8fa99b]">distance to target</p><p className="mt-1 font-display text-4xl font-extrabold text-[#f1c66b]">{mission.distance}<span className="ml-1 text-sm font-normal text-[#a9c1b2]">m</span></p></div><div className="text-right text-xs text-[#a9c1b2]"><p>{destination.walk}</p><p>{destination.city}</p></div></div>{message && <p className="mt-5 rounded-xl bg-[#284b52] px-3 py-3 text-xs leading-5 text-[#d3e1d2]" aria-live="polite" data-testid="status-navigation-message">{message}</p>}<div className="mt-7 space-y-3"><button type="button" disabled={locating} onClick={locate} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#54736d] px-4 py-3.5 text-sm font-bold text-[#f4f0e6] transition-colors hover:bg-[#284b52] disabled:opacity-60" data-testid="button-update-location"><Navigation size={17} className={locating ? 'animate-pulse' : ''} />{locating ? '現在地を確認中…' : '現在地を更新'}</button><button type="button" onClick={verify} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e47750] px-4 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b] transition-transform hover:-translate-y-0.5" data-testid="button-verify-location"><Crosshair size={17} />現地に到着した</button></div></aside></div></main></AppShell>;
}

function CapturePage() {
  const [, setLocation] = useLocation();
  const [mission, setMission] = useState<MissionState>(() => readStorage(MISSION_KEY, initialMission));
  const [cameraState, setCameraState] = useState<'idle' | 'live' | 'fallback' | 'captured'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('fallback'); setCameraMessage('このブラウザではカメラを利用できません。記念メモで完了できます。'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraState('live');
    } catch {
      setCameraState('fallback'); setCameraMessage('カメラへのアクセスが許可されませんでした。記念メモで続けられます。');
    }
  };
  const capture = () => {
    const next = { ...mission, captured: true, photo: 'camera-frame' };
    setMission(next); saveMission(next); setCameraState('captured'); streamRef.current?.getTracks().forEach((track) => track.stop());
  };
  const finishWithoutCamera = () => {
    const next = { ...mission, captured: true, photo: 'field-note' };
    setMission(next); saveMission(next); setCameraState('captured');
  };
  return <AppShell session={readStorage<Session | null>(SESSION_KEY, null)} onSignOut={() => { localStorage.removeItem(SESSION_KEY); setLocation('/auth'); }}><main className="mx-auto max-w-[900px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12"><div className="mb-8"><p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">mission 04 / proof</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-.04em]">見つけた瞬間を残す。</h1><p className="mt-3 text-sm text-[#718078]">この場所に来た証として、一枚だけ撮影しましょう。</p></div><div className="overflow-hidden rounded-[28px] bg-[#173640] p-2 shadow-[0_22px_55px_rgba(26,57,64,.16)]"><div className="relative min-h-[460px] overflow-hidden rounded-[22px] bg-[#284b52]">{cameraState === 'live' && <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" aria-label="カメラプレビュー" data-testid="video-camera-preview" />} {cameraState === 'captured' && <div className="absolute inset-0 bg-[linear-gradient(135deg,#3d6b68,#d07858_58%,#f1c66b)]"><div className="absolute left-[12%] top-[18%] h-40 w-32 rotate-[-9deg] rounded-[45%_45%_8%_8%] bg-[#e9d9bc]/70" /><div className="absolute bottom-[15%] right-[12%] h-44 w-44 rounded-full border-[18px] border-[#173640]/30" /><div className="absolute inset-0 bg-[#173640]/10" /></div>} {cameraState === 'idle' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#3d6b68,#173640_70%)] px-6 text-center"><div className="grid h-20 w-20 place-items-center rounded-full border border-[#f1c66b]/50 text-[#f1c66b]"><Camera size={31} strokeWidth={1.5} /></div><p className="mt-7 font-display text-2xl font-bold text-[#f4f0e6]">赤城神社をフレームに</p><p className="mt-2 max-w-xs text-sm leading-6 text-[#adc2b1]">カメラを起動して、旅の証を撮影します。</p></div>}{cameraState === 'fallback' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#244950] px-6 text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#f1c66b] text-[#173640]"><Info size={27} /></div><p className="mt-6 font-display text-2xl font-bold text-[#f4f0e6]">カメラなしでも大丈夫</p><p className="mt-2 max-w-sm text-sm leading-6 text-[#b7c8bb]">{cameraMessage}</p></div>}{cameraState === 'live' && <div className="pointer-events-none absolute inset-7 border border-[#f4f0e6]/60"><span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-[#f1c66b]" /><span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-[#f1c66b]" /><span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-[#f1c66b]" /><span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-[#f1c66b]" /></div>}{cameraState === 'captured' && <div className="absolute bottom-5 left-5 rounded-xl bg-[#173640]/80 px-4 py-3 text-[#f4f0e6] backdrop-blur-sm"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#f1c66b]">proof captured</p><p className="mt-1 text-sm font-bold">2025.06.18 / 神楽坂</p></div>}</div></div><div className="mt-6 flex flex-col gap-3 sm:flex-row">{cameraState === 'idle' && <button type="button" onClick={startCamera} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-start-camera"><Camera size={18} />カメラを起動</button>}{cameraState === 'live' && <button type="button" onClick={capture} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-capture-photo"><Camera size={18} />撮影する</button>}{cameraState === 'fallback' && <button type="button" onClick={finishWithoutCamera} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-use-field-note"><Check size={18} />記念メモで続ける</button>}{cameraState === 'captured' && <button type="button" onClick={() => setLocation('/complete')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-complete-mission">ミッションを完了する<ChevronRight size={18} /></button>}<Link href="/navigate" className="flex items-center justify-center rounded-xl border border-[#cdd6ca] bg-[#f9f7f0] px-5 py-3.5 text-sm font-bold text-[#536b65]" data-testid="link-back-navigation">地図に戻る</Link></div></main></AppShell>;
}

function CompletePage() {
  const [, setLocation] = useLocation();
  const [mission, setMission] = useState<MissionState>(() => readStorage(MISSION_KEY, initialMission));
  useEffect(() => {
    if (!mission.completed) { const next = { ...mission, completed: true }; setMission(next); saveMission(next); }
  }, [mission]);
  return <AppShell session={readStorage<Session | null>(SESSION_KEY, null)} onSignOut={() => { localStorage.removeItem(SESSION_KEY); setLocation('/auth'); }}><main className="mx-auto max-w-[900px] px-5 pb-24 pt-12 sm:px-8 sm:pt-20"><div className="relative overflow-hidden rounded-[30px] bg-[#173640] px-6 py-14 text-center text-[#f4f0e6] shadow-[0_22px_55px_rgba(26,57,64,.16)] sm:px-16"><div className="absolute left-[12%] top-[-30px] h-28 w-28 rounded-full border border-[#f1c66b]/20" /><div className="absolute bottom-[-70px] right-[8%] h-48 w-48 rounded-full border border-[#f1c66b]/15" /><div className="relative"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#f1c66b] text-[#173640] shadow-[0_0_0_12px_rgba(241,198,107,.14)] animate-rise"><Check size={38} strokeWidth={3} /></div><p className="mt-9 font-mono text-[10px] uppercase tracking-[.28em] text-[#f1c66b]">mission complete</p><h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">見つけた。</h1><p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#b7c8bb]">神楽坂の路地を抜けて、赤城神社に到着しました。今日の景色は、あなたの記録になりました。</p><div className="mx-auto mt-10 max-w-sm rounded-2xl bg-[#244950] p-4 text-left"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#9cb5a6]">logged landmark</p><div className="mt-3 flex items-center justify-between"><div><p className="font-display text-xl font-bold">{destination.name}</p><p className="mt-1 text-xs text-[#a9c1b2]">{destination.city} / 2025.06.18</p></div><MapPinned size={23} className="text-[#f1c66b]" /></div></div><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={() => setLocation('/')} className="rounded-xl bg-[#e47750] px-6 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-back-home">ホームへ戻る<ChevronRight size={16} className="ml-2 inline" /></button><Link href="/profile" className="rounded-xl border border-[#54736d] px-6 py-3.5 text-sm font-bold text-[#f4f0e6]" data-testid="link-view-record">記録を見る</Link></div></div></div></main></AppShell>;
}

function ProfilePage({ session, onSignOut }: { session: Session | null; onSignOut: () => void }) {
  const [, setLocation] = useLocation();
  const mission = readStorage<MissionState>(MISSION_KEY, initialMission);
  const name = session?.displayName ?? '旅人';
  return <AppShell session={session} onSignOut={() => { onSignOut(); setLocation('/auth'); }}><main className="mx-auto max-w-[980px] px-5 pb-24 pt-8 sm:px-8 sm:pt-12"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-[20px] bg-[#dd7552] font-display text-xl font-bold text-white shadow-[4px_4px_0_#b65d47]">{initials(name)}</div><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#668078]">your field notes</p><h1 className="mt-1 font-display text-3xl font-extrabold">{name}さんの記録</h1><p className="mt-1 text-xs text-[#718078]">{session?.email}</p></div></div><button type="button" onClick={() => { onSignOut(); setLocation('/auth'); }} className="flex items-center gap-2 self-start rounded-xl border border-[#e1c9c2] px-4 py-2.5 text-sm font-bold text-[#b24d3d] sm:self-auto" data-testid="button-logout"><LogOut size={16} />ログアウト</button></div><div className="mt-10 grid gap-4 sm:grid-cols-3"><StatCard icon={Check} number={mission.completed ? '04' : '03'} label="クリアした謎" accent="teal" /><StatCard icon={MapPinned} number="03" label="訪れた街" accent="gold" /><StatCard icon={Camera} number={mission.captured ? '04' : '03'} label="残した写真" accent="coral" /></div><section className="mt-12"><div className="flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#668078]">recently discovered</p><h2 className="mt-2 font-display text-2xl font-extrabold">最近の発見</h2></div><span className="font-mono text-[10px] text-[#8b968e]">03 / 12 LOCATIONS</span></div><div className="mt-5 overflow-hidden rounded-2xl border border-[#dedfd4] bg-[#f9f7f0]"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#3d6b68,#d07858)] text-[#f1c66b]"><MapPinned size={28} /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold">{destination.name}</h3>{mission.completed && <span className="rounded-full bg-[#d9e9dd] px-2.5 py-1 text-[10px] font-bold text-[#1e7471]">クリア済み</span>}</div><p className="mt-1 text-sm text-[#718078]">{destination.city} · 東京の静かな屋上神社</p></div><div className="text-left sm:text-right"><p className="font-mono text-[10px] text-[#8b968e]">JUN 18, 2025</p><p className="mt-1 text-xs font-bold text-[#dd7552]">{mission.captured ? '写真あり' : '探索中'}</p></div></div></div></section><section className="mt-10 rounded-2xl border border-[#d8ded2] bg-[#e4ebdf] p-5 sm:p-6"><div className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1c66b] text-[#173640]"><ShieldCheck size={20} /></div><div><h3 className="font-display font-bold">この旅のデータは、このブラウザに保存されています</h3><p className="mt-1 text-sm leading-6 text-[#667870]">GeoPuzzleプロトタイプでは、ログイン情報と発見記録を端末内だけで管理しています。別の端末には同期されません。</p></div></div></section></main></AppShell>;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default App;