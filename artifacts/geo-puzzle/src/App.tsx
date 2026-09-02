import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Compass, Camera, Check, ChevronRight, CircleHelp, Clock3, Crosshair, Eye, Github, History, Home, Info, KeyRound, Lightbulb, LockKeyhole, LogOut, Mail, MapPinned, Menu, Navigation, Plug, PlugZap, Route as RouteIcon, ShieldCheck, Sparkles, Stamp, Target, UserRound, type LucideIcon } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { MissionMap } from '@/components/mission-map';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { findMission, findRegion, missionLabel, missionsByRegion, nearestRegion, publishedMissions, regions, regionMissionStats, areasByRegion, type Mission, type Region } from '@/data/missions';
import { bearingInDegrees, compassLabel, distanceInMeters, distanceUnit, fixFromPosition, formatDistance, geolocationErrorMessage, simulatedFix, stageFor, stageMessage, type Fix } from '@/lib/geo';
import { useQzssReceiver } from '@/hooks/use-qzss-receiver';
import { accuracyMetersFromState, signalQualityColor, signalQualityLabel, webSerialUnavailableMessage } from '@/lib/qzss';
import { SESSION_KEY, USERS_KEY, emptyProgress, formatDate, readActiveMissionId, readAllProgress, readProgress, readStorage, saveActiveMissionId, saveProgress, type MissionProgress, type Session, type StoredUser } from '@/lib/storage';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
const DEMO_MODE = import.meta.env.DEV || new URLSearchParams(window.location.search).has('demo');

function useActiveMission() {
  const [mission, setMissionState] = useState<Mission>(() => findMission(readActiveMissionId()));
  const setMission = (next: Mission) => {
    saveActiveMissionId(next.id);
    setMissionState(next);
  };
  return { mission, setMission };
}

function useProgress(missionId: string) {
  const [progress, setProgressState] = useState<MissionProgress>(() => readProgress(missionId));
  useEffect(() => setProgressState(readProgress(missionId)), [missionId]);
  const update = useCallback(
    (patch: Partial<MissionProgress> | ((current: MissionProgress) => MissionProgress)) => {
      const current = readProgress(missionId);
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      saveProgress(missionId, next);
      setProgressState(next);
    },
    [missionId],
  );
  return [progress, update] as const;
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
  const [location] = useLocation();
  // 画面遷移のたびに localStorage から選択中ミッションを読み直す
  const mission = useMemo(() => findMission(readActiveMissionId()), [location]);
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
          <AppShell session={auth.session} onSignOut={auth.signOut}>
            <RoutedErrorBoundary>
              <Switch>
                <Route path="/auth"><AuthPage onSignedIn={auth.setSession} /></Route>
                <Route path="/region/:regionId">
                  {(match) => <RegionPage regionId={(match.params as any).regionId as string} session={auth.session} />}
                </Route>
                <Route path="/navigate"><Protected session={auth.session}><NavigatePage mission={mission} /></Protected></Route>
                <Route path="/discover"><Protected session={auth.session}><DiscoverPage mission={mission} /></Protected></Route>
                <Route path="/capture"><Protected session={auth.session}><CapturePage mission={mission} /></Protected></Route>
                <Route path="/complete"><Protected session={auth.session}><CompletePage mission={mission} /></Protected></Route>
                <Route path="/profile"><Protected session={auth.session}><ProfilePage session={auth.session} onSignOut={auth.signOut} /></Protected></Route>
                <Route path="/"><HomePage session={auth.session} /></Route>
                <Route component={NotFound} />
              </Switch>
            </RoutedErrorBoundary>
          </AppShell>
          <Toaster />
        </WouterRouter>
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
  const hideChrome = location === '/auth';
  return (
    <div className="grain min-h-[100dvh] bg-[#f4f0e6] text-[#20373f]">
      {!hideChrome && (
        <header className="sticky top-0 z-40 border-b border-[#d6d8ca] bg-[#f4f0e6]/95 backdrop-blur-md">
          <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-4 sm:h-[72px] sm:px-8">
            <Link href="/" className="flex items-center gap-3 min-w-0 flex-1" data-testid="link-brand">
              <span className="shrink-0 grid h-9 w-9 place-items-center rounded-[12px] bg-[#173640] text-[#f1c66b] shadow-[3px_3px_0_#d6a957] sm:h-10 sm:w-10"><MapPinned size={19} strokeWidth={2.5} /></span>
              <span className="min-w-0"><span className="block truncate font-display text-[15px] font-extrabold tracking-tight sm:text-[17px]">GeoPuzzle</span><span className="block font-mono text-[7px] uppercase tracking-[.22em] text-[#668078] sm:text-[8px]">歩いて、見つける。</span></span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex shrink-0" aria-label="メインナビゲーション">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} data-testid={`link-nav-${label}`} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4 sm:py-2 ${location === href ? 'bg-[#d9e5dc] text-[#176a69]' : 'text-[#667771] hover:bg-[#e7e8de] hover:text-[#20373f]'}`}><Icon size={15} className="sm:size-4" />{label}</Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {session ? <Link href="/profile" className="hidden items-center gap-2 rounded-full bg-[#e5eadf] py-1 pl-1 pr-2.5 text-xs font-semibold sm:py-1.5 sm:pl-1.5 sm:pr-3 sm:text-sm" data-testid="link-header-profile"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#dd7552] text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs">{initials(session.displayName)}</span><span className="hidden sm:inline">{session.displayName}</span></Link> : <Link href="/auth" data-testid="link-header-auth" className="rounded-full bg-[#173640] px-3 py-2 text-xs font-bold text-[#f4f0e6] sm:px-4 sm:text-sm">ログイン</Link>}
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-lg p-2 text-[#48625f] md:hidden shrink-0" aria-label="メニューを開く" data-testid="button-open-menu" aria-expanded={menuOpen}><Menu size={22} /></button>
            </div>
          </div>
          {menuOpen && <div className="absolute left-0 right-0 z-50 top-full border-b border-[#d6d8ca] bg-[#f4f0e6] p-2 shadow-lg md:hidden sm:p-3">{navItems.map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} key={href} href={href} data-testid={`link-mobile-nav-${label}`} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold hover:bg-[#e7e8de] sm:px-4"><Icon size={18} />{label}</Link>)}{session && <button onClick={() => { setMenuOpen(false); onSignOut(); }} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-semibold text-[#b24d3d] hover:bg-[#f5ded7] sm:px-4" data-testid="button-mobile-logout"><LogOut size={18} />ログアウト</button>}</div>}
        </header>
      )}
      <div className={hideChrome ? '' : 'pt-[68px] sm:pt-[72px]'}>{children}</div>
      {!hideChrome && (
        <nav className="mobile-bottom-nav safe-bottom fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around gap-1 border-t border-[#d6d8ca] bg-[#f4f0e6]/97 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 backdrop-blur-lg sm:px-2 md:hidden" aria-label="モバイルナビゲーション">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-bottom-nav-${label}`} className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold sm:min-w-[70px] sm:text-[11px] ${location === href ? 'text-[#176a69]' : 'text-[#7b8981]'}`}><Icon size={20} /><span>{label}</span></Link>)}
        </nav>
      )}
    </div>
  );
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
    const users = readStorage<StoredUser[]>(USERS_KEY, []);
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

function HomePage({ session }: { session: Session | null }) {
  const [, setLocation] = useLocation();
  const { setMission } = useActiveMission();
  const allProgress = readAllProgress();
  const totalDiscovered = Object.values(allProgress).filter((entry) => entry.discovered).length;
  const greeting = session ? `${session.displayName}さん、` : '';

  const sortedRegions = [...regions].sort((a, b) => a.order - b.order);
  const nearest = nearestRegion(null);
  const gotoRegion = (regionId: string) => setLocation(`/region/${regionId}`);
  const gotoFirstMissionOrAuth = (regionId: string) => {
    if (!session) {
      setLocation('/auth');
      return;
    }
    const list = missionsByRegion(regionId);
    if (list.length === 0) {
      setLocation(`/region/${regionId}`);
      return;
    }
    const next =
      list.find((m) => {
        const p = allProgress[m.id] ?? emptyProgress;
        return p.discovered && !p.completed;
      }) ??
      list.find((m) => !(allProgress[m.id] ?? emptyProgress).discovered) ??
      list[0];
    setMission(next);
    const progress = allProgress[next.id] ?? emptyProgress;
    if (progress.discovered && !progress.completed) setLocation('/discover');
    else setLocation('/navigate');
  };
  const nearestStats = regionMissionStats(nearest.id, allProgress);
  const nearestMissions = missionsByRegion(nearest.id);
  const nearbyMissionEntries = nearestMissions.map((mission, idx) => {
    const p = allProgress[mission.id] ?? emptyProgress;
    const state: 'undiscovered' | 'discovered' | 'completed' = p.completed ? 'completed' : p.discovered ? 'discovered' : 'undiscovered';
    return { mission, index: idx + 1, state };
  });

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] pb-safe-bottom-nav pt-6 sm:px-8 sm:pt-10">
      {/* Hero: ブランディング + 現在地周辺カード */}
      <section className="grid items-stretch gap-6 lg:grid-cols-[1.12fr_.88fr]">
        <div className="relative min-h-[420px] sm:min-h-[460px] overflow-hidden rounded-[28px] bg-[#173640] p-6 text-[#f6f0e2] shadow-[0_22px_55px_rgba(26,57,64,.16)] sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#f1c66b]/20" />
          <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-[#f1c66b]/20" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#122c34] to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-10">
            <div className="animate-rise">
              <div className="mb-6 sm:mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[.24em] text-[#f1c66b]"><Sparkles size={15} /> your next expedition</div>
              <p className="mb-3 text-sm text-[#b2c2b4]">{greeting}探して、見つける。</p>
              <h1 className="max-w-[560px] font-display text-3xl sm:text-4xl lg:text-6xl font-extrabold leading-[1.04] tracking-[-.04em]">
                まだ<span className="text-[#f1c66b]">名前も知らない</span><br />
                街の一点を、<br />
                探しにいこう。
              </h1>
            </div>
            <div className="animate-rise delay-2 grid gap-3 sm:grid-cols-2 sm:items-end">
              <StatCardDark icon={Target} number={String(totalDiscovered).padStart(2, '0')} label="これまでの発見" />
              <StatCardDark icon={RouteIcon} number={String(publishedMissions.length).padStart(2, '0')} label="解放された謎" accent="coral" />
            </div>
          </div>
        </div>

        {/* 現在地周辺カード：最も近い地域を大きく表示 */}
        <button
          type="button"
          onClick={() => gotoFirstMissionOrAuth(nearest.id)}
          className="group relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[28px] border border-[#cfd8cb] bg-white text-left shadow-[0_14px_38px_rgba(31,53,62,.08)] transition-transform hover:-translate-y-1 sm:min-h-[425px]"
          data-testid="card-nearby-region"
        >
          <div className="relative h-44 sm:h-56 overflow-hidden rounded-t-[28px]">
            <MissionMap 
              mode="region" 
              region={nearest} 
              missions={nearbyMissionEntries} 
              interactive={false} 
              compact
              className="absolute inset-0" 
            />
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-[#173640]/90 px-3 py-1.5 text-[10px] font-bold text-[#f1c66b] backdrop-blur-sm sm:left-5 sm:top-5 sm:text-[11px]"><MapPinned size={13} /> 現在地周辺</div>
            <div className="absolute right-4 top-4 flex h-10 w-10 shrink-0 place-items-center rounded-full bg-[#173640] text-[#f1c66b] sm:right-5 sm:top-5 sm:h-11 sm:w-11"><Compass size={18} className="sm:size-5" /></div>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#668078]">{nearest.name}</p>
                <h2 className="mt-1 min-w-0 break-words font-display text-2xl font-extrabold sm:text-3xl">{nearest.shortName}</h2>
                <p className="mt-2 text-sm leading-6 text-[#718078]">{nearest.tagline}</p>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#668078]">missions unlocked</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-[#176a69]">
                  {String(nearestStats.discovered).padStart(2, '0')}
                  <span className="mx-1 text-[#cdd5c8]">/</span>
                  <span className="text-xl font-bold text-[#668078]">{String(nearestStats.total).padStart(2, '0')}</span>
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#e47750] px-4 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b] transition-transform group-hover:translate-x-0.5">
                {!session ? '旅をはじめる' : nearestStats.total === 0 ? '地域を見る' : nearestStats.discovered === nearestStats.total ? 'もう一度歩く' : '探索する'}
                <ChevronRight size={16} />
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* 探索できる地域 グリッド */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.24em] text-[#668078]">regions</p>
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-[-.03em]">探索できる地域。</h2>
          </div>
          <Link href={session ? `/region/${nearest.id}` : '/auth'} className="hidden items-center gap-1.5 text-xs font-bold text-[#176a69] underline-offset-4 hover:underline sm:inline-flex" data-testid="link-view-all-regions">
            地図から選ぶ<ChevronRight size={14} />
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sortedRegions.map((region) => {
            const stats = regionMissionStats(region.id, allProgress);
            const isComingSoon = region.status === 'coming-soon';
            const progressPct = stats.total > 0 ? (stats.discovered / stats.total) * 100 : 0;
            return (
              <button
                key={region.id}
                type="button"
                disabled={isComingSoon}
                onClick={() => (isComingSoon ? undefined : gotoRegion(region.id))}
                className={`group relative flex flex-col overflow-hidden rounded-3xl border p-5 text-left transition-all ${
                  isComingSoon ? 'cursor-not-allowed border-[#e2e4d9] bg-[#f5f2e9] opacity-80' : 'border-[#dedfd4] bg-[#f9f7f0] hover:-translate-y-1 hover:border-[#1e7471]/40 hover:bg-white'
                }`}
                data-testid={`card-region-${region.id}`}
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${isComingSoon ? 'bg-[#e9e8df] text-[#98a39b]' : 'bg-[#d7e7df] text-[#1e7471]'}`}>
                    {isComingSoon ? <CircleHelp size={20} /> : <MapPinned size={20} />}
                  </span>
                  {isComingSoon ? (
                    <span className="rounded-full bg-[#173640]/90 px-2.5 py-1 text-[10px] font-bold text-[#f1c66b]">Coming Soon</span>
                  ) : stats.discovered > 0 ? (
                    <span className="rounded-full bg-[#d9e9dd] px-2.5 py-1 text-[10px] font-bold text-[#1e7471]">{stats.discovered} / {stats.total} 発見</span>
                  ) : (
                    <span className="rounded-full bg-[#eee7d2] px-2.5 py-1 text-[10px] font-bold text-[#a7761f]">{stats.total} つの謎</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#668078]">{region.name}</p>
                  <h3 className={`mt-1 truncate font-display text-xl font-extrabold ${isComingSoon ? 'text-[#667771]' : 'text-[#173640]'}`}>
                    {isComingSoon ? '???' : region.shortName}
                  </h3>
                  <p className={`mt-2 line-clamp-2 text-xs leading-6 ${isComingSoon ? 'text-[#8a978d]' : 'text-[#718078]'}`}>
                    {isComingSoon ? '準備中です。もう少々お待ちください。' : region.tagline}
                  </p>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#668078]">
                    <span>progress</span>
                    <span>{stats.discovered} / {stats.total}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e6e8dd]">
                    <div
                      className={`h-full rounded-full transition-all ${isComingSoon ? 'bg-[#cdd5c8]' : progressPct === 100 ? 'bg-[#1e7471]' : 'bg-[#e47750]'}`}
                      style={{ width: `${isComingSoon ? 0 : progressPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-12 grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
        <div>
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.24em] text-[#668078]">how it works</p>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-[-.03em]">地域 → ミッション → 発見。<br />情報は、歩くたびに解放される。</h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#65756e]">
            ホームでは「場所」は表示しません。地域を選び、地図に現れたミッションを選び、ヒントを頼りに自分の足で一点を見つける。はじめて、そこがどこだったのかが明かされます。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <StepCard index="01" title="地域を選ぶ" text="探索できる地域の中から、次の目的地を選ぶ。" icon={MapPinned} />
          <StepCard index="02" title="地図から謎を選ぶ" text="地図上に散らばった MISSION をタップして選択。" icon={Compass} />
          <StepCard index="03" title="歩いて一点に立つ" text="ヒントと現在地を頼りに、答えのそばへ。" icon={Navigation} />
          <StepCard index="04" title="場所の名前を知る" text="発見後にはじめて、地名と物語が解放される。" icon={Stamp} />
        </div>
      </section>
    </main>
  );
}

function StatCardDark({ icon: Icon, number, label, accent = 'teal' }: { icon: LucideIcon; number: string; label: string; accent?: 'teal' | 'coral' }) {
  const colors: Record<string, string> = {
    teal: 'bg-[#244950] text-[#a9d1bd] ring-1 ring-[#3a666b]',
    coral: 'bg-[#4a2e27] text-[#f2b69a] ring-1 ring-[#6d4a41]',
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#2c4f56] bg-[#1a3c46] p-4">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${colors[accent]}`}><Icon size={20} /></div>
      <div>
        <p className="font-display text-2xl font-extrabold text-[#f4f0e6]">{number}</p>
        <p className="text-xs text-[#98aca2]">{label}</p>
      </div>
    </div>
  );
}

/* ---------------- RegionPage: 地域選択後の地図 ---------------- */

function RegionPage({ regionId, session }: { regionId: string; session: Session | null }) {
  const [, setLocation] = useLocation();
  const { setMission } = useActiveMission();
  const region = findRegion(regionId);
  const allProgress = readAllProgress();

  useEffect(() => {
    if (!region || region.status !== 'available') setLocation('/');
  }, [region, setLocation]);

  if (!region) return null;

  const regionMissions = missionsByRegion(region.id);
  const areas = areasByRegion(region.id);
  const stats = regionMissionStats(region.id, allProgress);

  const selectMission = (mission: Mission) => {
    if (!session) {
      setLocation('/auth');
      return;
    }
    setMission(mission);
    const p = allProgress[mission.id] ?? emptyProgress;
    if (p.discovered && !p.completed) setLocation('/discover');
    else setLocation('/navigate');
  };

  const missionEntries = regionMissions.map((mission, idx) => {
    const p = allProgress[mission.id] ?? emptyProgress;
    const state: 'undiscovered' | 'discovered' | 'completed' = p.completed ? 'completed' : p.discovered ? 'discovered' : 'undiscovered';
    return { mission, index: idx + 1, state, onSelect: () => selectMission(mission) };
  });

  return (
    <main className="mx-auto max-w-[1240px] px-5 pb-safe-bottom-nav pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:px-8 sm:pt-10">
      <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
        <Link href="/" className="flex items-center gap-1.5 rounded-full border border-[#d4d8cc] bg-white px-3 py-2 text-xs font-bold text-[#48625f] transition-colors hover:bg-[#f1efde]" data-testid="link-back-home"><ChevronRight size={14} className="rotate-180" />ホームへ</Link>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#668078]">{region.name} / region map</p>
          <h1 className="mt-1 min-w-0 break-words font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{region.shortName} · 探索マップ</h1>
        </div>
        <div className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${stats.discovered === stats.total ? 'bg-[#d9e9dd] text-[#1e7471]' : 'bg-[#eee7d2] text-[#a7761f]'}`}>
          {stats.discovered} / {stats.total} 発見
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-[#cfd8cb] sm:min-h-[520px]">
          <MissionMap mode="region" region={region} missions={missionEntries} />
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-2xl bg-[#f4f0e6]/95 p-3 backdrop-blur-sm sm:bottom-5 sm:left-5 sm:p-4">
            <p className="font-mono text-[8px] uppercase tracking-[.16em] text-[#668078] sm:text-[9px]">exploration map</p>
            <p className="mt-1 text-sm font-bold sm:text-base">{region.shortName} の {regionMissions.length} つの謎</p>
            <p className="mt-1 text-[11px] text-[#718078] sm:text-xs">タップして、それぞれのミッションを始めよう。</p>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[28px] bg-[#173640] p-5 text-[#f4f0e6] sm:p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#31555a] px-3 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-[#a9c1b2]">overview</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1c66b] text-[#173640]"><Target size={17} /></span>
            </div>
            <h2 className="mt-6 font-display text-2xl font-extrabold leading-snug text-[#f1c66b]">{region.tagline}</h2>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <MiniStat label="地域" value={region.shortName} />
              <MiniStat label="エリア" value={String(areas.length)} />
              <MiniStat label="ミッション" value={String(regionMissions.length)} />
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#8fa99b]">
                <span>PROGRESS</span>
                <span>{stats.discovered} / {stats.total}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#2c4f56]">
                <div
                  className="h-full rounded-full bg-[#f1c66b]"
                  style={{ width: stats.total > 0 ? `${(stats.discovered / stats.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {regionMissions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#d4d8cc] bg-white p-6 text-center">
                <p className="text-sm font-bold text-[#668078]">この地域にはまだミッションがありません。</p>
                <p className="mt-1 text-xs text-[#8a978d]">続報をお楽しみに。</p>
              </div>
            )}
            {regionMissions.map((mission, index) => {
              const p = allProgress[mission.id] ?? emptyProgress;
              const state: 'undiscovered' | 'discovered' | 'completed' = p.completed ? 'completed' : p.discovered ? 'discovered' : 'undiscovered';
              // MISSION 01 だけはタイトルを見せ、2つ目以降は「？？？」にする（提案2のハイブリッド）
              const titleShown = state !== 'undiscovered' || index === 0;
              const tone =
                state === 'completed'
                  ? 'border-[#1e7471] bg-[#e4efe8]'
                  : state === 'discovered'
                    ? 'border-[#e09b3b] bg-[#f8efd4]'
                    : 'border-[#dedfd4] bg-[#f9f7f0]';
              return (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => selectMission(mission)}
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-transform hover:-translate-y-0.5 ${tone}`}
                  data-testid={`button-region-mission-${mission.id}`}
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#173640] text-[#f1c66b]">
                    <span className="font-mono text-[8px] uppercase tracking-[.16em]">No.</span>
                    <span className="font-display text-sm font-extrabold leading-none">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#668078]">Mission {String(index + 1).padStart(2, '0')}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        state === 'completed' ? 'bg-[#d9e9dd] text-[#1e7471]' :
                        state === 'discovered' ? 'bg-[#eee7d2] text-[#a7761f]' :
                        'bg-[#e9e8df] text-[#8a978d]'
                      }`}>
                        {state === 'completed' ? '発見済み' : state === 'discovered' ? '発見・未完了' : '未発見'}
                      </span>
                    </div>
                    <h3 className="mt-1 truncate font-display text-lg font-bold text-[#173640]">
                      {titleShown ? mission.title : '？？？'}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#718078]">
                      {titleShown ? `手がかり：「${mission.clue}」` : 'まだ手がかりは隠されています。'}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-[#1e7471] transition-transform group-hover:translate-x-1" />
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#2c4f56] bg-[#1e3c46] px-3 py-2.5 text-center">
      <p className="font-mono text-[8px] uppercase tracking-[.18em] text-[#8fa99b]">{label}</p>
      <p className="mt-0.5 truncate font-display text-sm font-extrabold text-[#f4f0e6]">{value}</p>
    </div>
  );
}

function shellProps(setLocation: (path: string) => void) {
  return {
    session: readStorage<Session | null>(SESSION_KEY, null),
    onSignOut: () => {
      localStorage.removeItem(SESSION_KEY);
      setLocation('/auth');
    },
  };
}

function NavigatePage({ mission }: { mission: Mission }) {
  const [, setLocation] = useLocation();
  const [progress, updateProgress] = useProgress(mission.id);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const simulatedDistance = useRef(420);
  const [hintModalOpen, setHintModalOpen] = useState(false);
  const [justRevealedIndex, setJustRevealedIndex] = useState<number | null>(null);

  const applyFix = useCallback(
    (next: Fix) => {
      setFix(next);
      setLocationError('');
      setLocating(false);
      updateProgress({ lastDistance: distanceInMeters(next.latitude, next.longitude, mission.latitude, mission.longitude), lastAccuracy: next.accuracy });
    },
    [mission.latitude, mission.longitude, updateProgress],
  );

  const qzss = useQzssReceiver({ onFix: applyFix });

  const distance = fix ? distanceInMeters(fix.latitude, fix.longitude, mission.latitude, mission.longitude) : null;
  const bearing = fix ? bearingInDegrees(fix.latitude, fix.longitude, mission.latitude, mission.longitude) : null;
  const stage = stageFor(distance, mission);
  const usingQzss = fix?.provider === 'qzss' && qzss.connected;
  const requiredAccuracy = usingQzss ? Math.min(mission.maximumAccuracy, 2) : mission.maximumAccuracy;
  const accuracyOk = fix ? fix.accuracy <= requiredAccuracy : false;
  const canDiscover = stage === 'arrived' && accuracyOk;

  useEffect(() => {
    if (simulating || qzss.connected) return;
    if (!navigator.geolocation) {
      setLocationError('このブラウザは位置情報に対応していません。');
      return;
    }
    setLocating(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => applyFix(fixFromPosition(position)),
      (error) => {
        setLocating(false);
        setLocationError(geolocationErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [applyFix, qzss.connected, simulating]);

  const locate = () => {
    setMessage('');
    if (simulating) {
      simulatedDistance.current = Math.max(2, simulatedDistance.current * 0.45);
      applyFix(simulatedFix(mission, simulatedDistance.current, 8));
      return;
    }
    if (qzss.connected && qzss.fix) {
      applyFix(qzss.fix);
      setMessage(`みちびき測位を更新しました。測位誤差は約${Math.round(qzss.fix.accuracy * 10) / 10}mです。`);
      return;
    }
    if (!navigator.geolocation) return setLocationError('このブラウザは位置情報に対応していません。');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyFix(fixFromPosition(position));
        setMessage(`現在地を更新しました。測位誤差は約${Math.round(position.coords.accuracy)}mです。`);
      },
      (error) => {
        setLocating(false);
        setLocationError(geolocationErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  };

  const connectQzss = async () => {
    setMessage('');
    setLocationError('');
    const ok = await qzss.connect();
    if (ok) setMessage('みちびき受信機を接続しました。NMEA データの受信を開始します。');
  };

  const disconnectQzss = async () => {
    await qzss.disconnect();
    setFix(null);
    setMessage('みちびき受信機を切断しました。');
  };

  const startSimulation = () => {
    setSimulating(true);
    setLocationError('');
    simulatedDistance.current = 420;
    applyFix(simulatedFix(mission, 420, 12));
    setMessage('シミュレーションモード：「現在地を更新」を押すたびに目的地へ近づきます。');
  };

  const revealHint = () => {
    if (progress.hintsRevealed >= mission.hints.length) return;
    updateProgress((current) => ({ ...current, hintsRevealed: current.hintsRevealed + 1 }));
    setJustRevealedIndex(progress.hintsRevealed);
  };

  const closeHintModalAndExplore = () => {
    setJustRevealedIndex(null);
    setHintModalOpen(false);
  };

  const verify = () => {
    if (!fix || distance === null) return setMessage('まず現在地を取得してください。');
    if (!accuracyOk) {
      return setMessage(
        usingQzss
          ? `測位誤差が約${Math.round(fix.accuracy * 10) / 10}mあります。みちびき判定には${requiredAccuracy}m以内の精度が必要です。`
          : `測位誤差が約${Math.round(fix.accuracy)}mあります。判定には${mission.maximumAccuracy}m以内の精度が必要です。空の見える場所で再試行してください。`,
      );
    }
    if (distance > mission.discoveryRadius) return setMessage(`発見地点まであと${Math.round(distance)}mです。${stageMessage(stage)}`);
    const now = new Date().toISOString();
    updateProgress({ verified: true, verifiedAt: now, discovered: true, discoveredAt: now });
    setLocation('/discover');
  };

  const stageTone: Record<typeof stage, string> = { unknown: 'bg-[#31555a] text-[#a9c1b2]', far: 'bg-[#31555a] text-[#d3e1d2]', approaching: 'bg-[#2f5f5c] text-[#d9ecd9]', near: 'bg-[#6b6236] text-[#f5e6b8]', search: 'bg-[#7a4b33] text-[#ffe2d4]', arrived: 'bg-[#1e7471] text-white' };
  const positioningLabel = fix?.simulated
    ? 'シミュレーション中'
    : usingQzss
      ? `みちびき測位 · 誤差 約${Math.round(fix.accuracy * 10) / 10}m`
      : fix
        ? `測位中 · 誤差 約${Math.round(fix.accuracy)}m`
        : qzss.connected
          ? 'みちびき受信中…'
          : '現在地を取得中';

  const region = findRegion(mission.regionId);
  return <main className="mx-auto max-w-[1240px] px-5 pb-safe-bottom-nav pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-6 sm:px-8 sm:pt-10">
    <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
      <Link href={`/region/${mission.regionId}`} className="flex items-center gap-1.5 rounded-full border border-[#d4d8cc] bg-white px-3 py-2 text-xs font-bold text-[#48625f] transition-colors hover:bg-[#f1efde]" data-testid="link-back-region"><ChevronRight size={14} className="rotate-180" />地域へ戻る</Link>
    </div>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">{missionLabel(mission)} / navigate</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl break-words">{mission.title}</h1></div><div className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${fix ? 'bg-[#d9e9dd] text-[#1e7471]' : 'bg-[#eee7d2] text-[#a7761f]'}`} data-testid="status-positioning"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${fix ? (usingQzss ? 'bg-[#e05c35]' : 'bg-[#1e7471]') : 'bg-[#a7761f] animate-pulse'}`} />{positioningLabel}</div></div>
    <div className="grid gap-6 lg:grid-cols-[1.32fr_.68fr]">
      <div className="relative min-h-[380px] overflow-hidden rounded-[28px] border border-[#cfd8cb] sm:min-h-[420px] lg:min-h-[560px]">
        <MissionMap mission={mission} fix={fix} revealGoal={canDiscover} />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-2xl bg-[#f4f0e6]/90 px-3 py-2 backdrop-blur-sm sm:bottom-5 sm:left-5 sm:px-4 sm:py-3"><p className="font-mono text-[8px] uppercase tracking-[.12em] text-[#668078] sm:text-[9px] sm:tracking-[.15em]">search area</p><p className="mt-0.5 text-xs font-bold sm:text-sm break-words">{region?.name ?? ''}</p></div>
        {bearing !== null && <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-xl bg-[#173640] px-2.5 py-1.5 font-mono text-[9px] text-[#f1c66b] sm:right-5 sm:top-5 sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px]" data-testid="status-bearing"><Navigation size={11} className="sm:size-[12px]" style={{ transform: `rotate(${bearing - 45}deg)` }} />{compassLabel(bearing)}</div>}
      </div>
      <aside className="rounded-[28px] bg-[#173640] p-5 text-[#f4f0e6] sm:p-6 lg:p-8">
        <div className="flex items-center justify-between"><span className="rounded-full bg-[#31555a] px-3 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-[#a9c1b2]">clue</span><CircleHelp size={18} className="text-[#f1c66b]" /></div>
        <h2 className="mt-6 font-display text-2xl font-extrabold leading-snug text-[#f1c66b]">{mission.clue}</h2>
        <p className="mt-4 text-sm leading-7 text-[#b9c8bc]">{mission.detail}</p>

        <div className="mt-6 rounded-2xl border border-[#31555a] bg-[#244950] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9cb5a6]">position source</p>
              <p className="mt-1 text-sm font-bold" data-testid="status-qzss-connection">{qzss.connected ? 'みちびき接続中' : 'ブラウザ GPS'}</p>
            </div>
            {qzss.connected ? (
              <button type="button" onClick={() => void disconnectQzss()} className="flex items-center gap-2 rounded-xl border border-[#54736d] px-3 py-2 text-xs font-bold text-[#f4f0e6] transition-colors hover:bg-[#284b52]" data-testid="button-disconnect-qzss"><Plug size={14} />切断</button>
            ) : (
              <button type="button" disabled={!qzss.supported || qzss.connecting} onClick={() => void connectQzss()} className="flex items-center gap-2 rounded-xl bg-[#e05c35] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#c84f2d] disabled:opacity-60" data-testid="button-connect-qzss"><PlugZap size={14} />{qzss.connecting ? '接続中…' : 'みちびき接続'}</button>
            )}
          </div>
          {!qzss.supported && <p className="mt-3 text-xs leading-5 text-[#ffe2d4]">{webSerialUnavailableMessage()}</p>}
          {qzss.error && <p className="mt-3 text-xs leading-5 text-[#ffe2d4]" data-testid="status-qzss-error">{qzss.error}</p>}
          {qzss.connected && (
            <div className="mt-4 grid gap-2 text-xs text-[#d3e1d2]">
              <div className="flex items-center justify-between gap-3"><span className="text-[#9cb5a6]">信号品質</span><span style={{ color: signalQualityColor(qzss.state.signalQuality) }} data-testid="status-signal-quality">{signalQualityLabel(qzss.state.signalQuality)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[#9cb5a6]">測位精度</span><span data-testid="status-qzss-accuracy">{qzss.state.signalQuality === 'none' ? '-' : `約${Math.round(accuracyMetersFromState(qzss.state) * 10) / 10}m`}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[#9cb5a6]">衛星数</span><span data-testid="status-satellite-count">{qzss.state.satellites.total > 0 ? `${qzss.state.satellites.total}衛星 (GPS:${qzss.state.satellites.gps}, QZSS:${qzss.state.satellites.qzss})` : '-'}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[#9cb5a6]">受信状態</span><span data-testid="status-reception">{qzss.fix ? '測位中' : '待機中'}</span></div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setHintModalOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#54736d] px-4 py-2.5 text-xs font-bold text-[#a9c1b2] transition-colors hover:bg-[#284b52]" data-testid="button-open-hints">
          <Lightbulb size={14} />
          ヒントを確認する
          <span className="rounded-full bg-[#284b52] px-2 py-0.5 font-mono text-[9px] text-[#f1c66b]">{progress.hintsRevealed}/{mission.hints.length} 解放済み</span>
        </button>
        <div className="my-7 h-px bg-[#31555a]" />
        <div className="flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#8fa99b]">distance to target</p><p className="mt-1 font-display text-4xl font-extrabold text-[#f1c66b]" data-testid="text-distance">{formatDistance(distance)}<span className="ml-1 text-sm font-normal text-[#a9c1b2]">{distanceUnit(distance)}</span></p></div><div className="text-right text-xs text-[#a9c1b2]"><p>判定範囲 {mission.discoveryRadius}m</p><p>必要精度 {requiredAccuracy}m以内{usingQzss ? '（みちびき）' : ''}</p></div></div>
        <p className={`mt-5 rounded-xl px-3 py-3 text-xs leading-5 ${stageTone[stage]}`} data-testid="status-stage">{stageMessage(stage)}{stage === 'arrived' && !accuracyOk && ' ただし測位誤差が大きいため、判定にはもう少し精度が必要です。'}</p>
        {locationError && <p className="mt-5 rounded-xl bg-[#6a3f43] px-3 py-3 text-xs leading-5 text-[#ffe2d4]" aria-live="assertive" data-testid="status-location-error">{locationError}</p>}
        {message && <p className="mt-5 rounded-xl bg-[#284b52] px-3 py-3 text-xs leading-5 text-[#d3e1d2]" aria-live="polite" data-testid="status-navigation-message">{message}</p>}
        <div className="mt-7 space-y-3">
          <button type="button" disabled={locating || qzss.connecting} onClick={locate} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#54736d] px-4 py-3.5 text-sm font-bold text-[#f4f0e6] transition-colors hover:bg-[#284b52] disabled:opacity-60" data-testid="button-update-location"><Navigation size={17} className={locating ? 'animate-pulse' : ''} />{locating ? '現在地を確認中…' : '現在地を更新'}</button>
          <button type="button" onClick={verify} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 ${canDiscover ? 'bg-[#e47750] text-white shadow-[3px_3px_0_#a74e3b]' : 'bg-[#2c4f56] text-[#a9c1b2]'}`} data-testid="button-verify-location"><Crosshair size={17} />{canDiscover ? '発見する' : 'この場所で判定する'}</button>
          {DEMO_MODE && !simulating && <button type="button" onClick={startSimulation} className="w-full rounded-xl px-4 py-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#8fa99b] underline underline-offset-4" data-testid="button-start-simulation">demo: GPSなしでシミュレーション</button>}
        </div>
      </aside>
    </div>
    {hintModalOpen && (
      <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center bg-[#0a1a1f]/80 px-0 sm:px-4 py-0 sm:py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ヒント">
        <div className="w-full max-w-[440px] max-h-[92dvh] overflow-y-auto animate-rise rounded-t-[28px] sm:rounded-[28px] bg-[#f4f0e6] p-5 shadow-[0_22px_55px_rgba(0,0,0,.3)] sm:p-8 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <div className="mb-5 sm:mb-6 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 grid h-9 w-9 place-items-center rounded-[11px] bg-[#173640] text-[#f1c66b]"><Lightbulb size={17} /></span>
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#668078]">hints</p>
                <h3 className="mt-0.5 font-display text-xl font-extrabold text-[#173640]">ヒントを確認する</h3>
              </div>
            </div>
            <button type="button" onClick={closeHintModalAndExplore} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#d4d8cc] text-[#718078] transition-colors hover:bg-[#e9e8df]" aria-label="閉じる" data-testid="button-close-hints"><Info size={15} /></button>
          </div>

          {progress.hintsRevealed === 0 && (
            <div className="mb-5 rounded-2xl bg-[#244950] px-4 py-4 text-[13px] leading-6 text-[#d3e1d2]">
              <p className="font-bold text-[#f1c66b]">まずは自分で探してみよう。</p>
              <p className="mt-1 text-[#9cb5a6]">手がかりと地図をもとに、実際に歩き回って答えを考えるのが GeoPuzzle の遊び方です。どうしても分からなくなったら、下のボタンから1つずつヒントを解放してください。</p>
            </div>
          )}

          <div className="max-h-[45dvh] sm:max-h-[42vh] space-y-3 overflow-y-auto pr-1">
            {mission.hints.slice(0, progress.hintsRevealed).map((hint, index) => {
              const isJustRevealed = justRevealedIndex === index;
              return (
                <div key={`${hint}-${index}`} className={`rounded-xl px-4 py-3.5 text-sm leading-6 ${isJustRevealed ? 'animate-rise bg-[#f1c66b]/15 ring-2 ring-[#f1c66b] text-[#173640]' : 'bg-[#e9e8df] text-[#20373f]'}`} data-testid={`modal-hint-${index + 1}`}>
                  <p className="mb-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-[#668078]">
                    <Lightbulb size={11} className="text-[#e09b3b]" /> hint {index + 1}
                    {isJustRevealed && <span className="ml-auto rounded-full bg-[#e05c35] px-2 py-0.5 text-[9px] font-bold text-white">NEW</span>}
                  </p>
                  <p>{hint}</p>
                </div>
              );
            })}
            {Array.from({ length: mission.hints.length - progress.hintsRevealed }).map((_, idx) => {
              const number = progress.hintsRevealed + idx + 1;
              return (
                <div key={`locked-${number}`} className="flex items-center gap-3 rounded-xl border border-dashed border-[#cfd8cb] bg-[#f9f7f0] px-4 py-3.5 text-xs text-[#8a978d]">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e9e8df] text-[#668078]"><LockKeyhole size={13} /></span>
                  <p className="font-mono text-[10px] uppercase tracking-[.12em]">hint {number} · まだ解放されていません</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            {progress.hintsRevealed < mission.hints.length && justRevealedIndex === null && (
              <button type="button" onClick={revealHint} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173640] px-5 py-3.5 text-sm font-bold text-[#f4f0e6] shadow-[3px_3px_0_#0e252b] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-reveal-next-hint">
                <Lightbulb size={16} />
                次のヒントを解放する（{progress.hintsRevealed + 1} / {mission.hints.length}）
              </button>
            )}
            {justRevealedIndex !== null && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#1e7471]/10 px-4 py-3 text-sm font-bold text-[#1e7471]">
                  <p>🧭 ヒントを頭に入れたら、さっそく足を動かそう。</p>
                  <p className="mt-1 text-[12px] font-normal text-[#4a6e67]">一度探索画面に戻って歩き回り、それでも分からなければまた次のヒントを開きましょう。</p>
                </div>
                <button type="button" onClick={closeHintModalAndExplore} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-back-to-explore">
                  <Navigation size={16} />
                  探索へ戻って探し直す
                </button>
                {progress.hintsRevealed < mission.hints.length && (
                  <button type="button" onClick={() => setJustRevealedIndex(null)} className="w-full rounded-xl px-5 py-2.5 text-xs font-bold text-[#668078] underline underline-offset-4">
                    今すぐ次のヒントも見る
                  </button>
                )}
              </div>
            )}
            {justRevealedIndex === null && progress.hintsRevealed >= mission.hints.length && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#173640]/95 px-4 py-3 text-sm text-[#f1c66b]">
                  <p className="font-bold">🎉 ヒントは全部解放済みです。</p>
                  <p className="mt-1 text-[12px] font-normal text-[#b9c8bc]">4つのヒントを手がかりに、あとは自分の足で発見地点へたどり着いてください。</p>
                </div>
                <button type="button" onClick={closeHintModalAndExplore} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-back-to-explore-final">
                  <Navigation size={16} />
                  探索へ戻る
                </button>
              </div>
            )}
            {justRevealedIndex === null && progress.hintsRevealed > 0 && progress.hintsRevealed < mission.hints.length && (
              <button type="button" onClick={closeHintModalAndExplore} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cfd8cb] bg-[#faf8f1] px-5 py-3 text-sm font-bold text-[#536b65] transition-colors hover:bg-[#efeadb]">
                ヒントを復習して探索へ戻る
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </main>;
}

function DiscoverPage({ mission }: { mission: Mission }) {
  const [, setLocation] = useLocation();
  const [progress, updateProgress] = useProgress(mission.id);
  useEffect(() => {
    if (!progress.discovered) setLocation('/navigate');
  }, [progress.discovered, setLocation]);
  const finish = () => {
    updateProgress({ completed: true, completedAt: new Date().toISOString() });
    setLocation('/complete');
  };
  return <main className="mx-auto max-w-[900px] px-5 pb-safe-bottom-nav pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-8 sm:px-8 sm:pt-12">
    <div className="mb-8 animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#1e7471]">{missionLabel(mission)} / discovered</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-.04em] sm:text-5xl">発見。</h1><p className="mt-3 text-sm text-[#718078]">この一点に立った人だけが受け取れる話です。</p></div>
    <article className="animate-rise delay-2 overflow-hidden rounded-[30px] bg-[#173640] text-[#f4f0e6] shadow-[0_22px_55px_rgba(26,57,64,.16)]">
      <div className="relative h-56 sm:h-72"><MissionMap mission={mission} fix={null} revealGoal interactive={false} /><div className="pointer-events-none absolute inset-0 z-[500] bg-gradient-to-t from-[#173640] via-[#173640]/40 to-transparent" /><div className="pointer-events-none absolute bottom-5 left-6 z-[500] flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#f1c66b] text-[#173640] shadow-[0_0_0_10px_rgba(241,198,107,.14)]"><Stamp size={22} /></span><div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#f1c66b]">{mission.discovery.stamp}</p><p className="font-display text-xl font-bold">{mission.name}</p></div></div></div>
      <div className="px-6 pb-8 pt-4 sm:px-10 sm:pb-10"><h2 className="font-display text-2xl font-extrabold leading-snug text-[#f1c66b] sm:text-3xl" data-testid="text-discovery-headline">{mission.discovery.headline}</h2><p className="mt-5 max-w-xl text-sm leading-8 text-[#d3e1d2]" data-testid="text-discovery-story">{mission.discovery.story}</p><div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#244950] p-4"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#9cb5a6]">place</p><p className="mt-2 text-sm font-bold">{findRegion(mission.regionId)?.name ?? ''}</p></div><div className="rounded-2xl bg-[#244950] p-4"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#9cb5a6]">discovered</p><p className="mt-2 text-sm font-bold">{formatDate(progress.discoveredAt)}</p></div><div className="rounded-2xl bg-[#244950] p-4"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#9cb5a6]">hints used</p><p className="mt-2 text-sm font-bold">{progress.hintsRevealed} / {mission.hints.length}</p></div></div></div>
    </article>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <button type="button" onClick={finish} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-finish-mission"><Check size={18} />記録して完了する</button>
      {mission.photoEnabled && <Link href="/capture" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#cdd6ca] bg-[#f9f7f0] px-5 py-3.5 text-sm font-bold text-[#536b65]" data-testid="link-capture-photo"><Camera size={18} />記念写真を撮る（任意）</Link>}
    </div>
  </main>;
}

function CapturePage({ mission }: { mission: Mission }) {
  const [, setLocation] = useLocation();
  const [progress, updateProgress] = useProgress(mission.id);
  const [cameraState, setCameraState] = useState<'idle' | 'live' | 'fallback' | 'captured'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (!progress.discovered) setLocation('/navigate');
  }, [progress.discovered, setLocation]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('fallback'); setCameraMessage('このブラウザではカメラを利用できません。記念メモで残せます。'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraState('live');
    } catch {
      setCameraState('fallback'); setCameraMessage('カメラへのアクセスが許可されませんでした。記念メモで残せます。');
    }
  };
  const capture = () => {
    updateProgress({ captured: true, photo: 'camera-frame' });
    setCameraState('captured');
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };
  const finishWithoutCamera = () => {
    updateProgress({ captured: true, photo: 'field-note' });
    setCameraState('captured');
  };
  const complete = () => {
    updateProgress((current) => ({ ...current, completed: true, completedAt: current.completedAt ?? new Date().toISOString() }));
    setLocation('/complete');
  };
  const regionName = findRegion(mission.regionId)?.name ?? '';
  return <main className="mx-auto max-w-[900px] px-5 pb-safe-bottom-nav pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-8 sm:px-8 sm:pt-12"><div className="mb-8"><p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">{missionLabel(mission)} / memory</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">見つけた瞬間を残す。</h1><p className="mt-3 text-sm text-[#718078]">写真は任意です。撮らなくても発見は記録されています。</p></div><div className="overflow-hidden rounded-[28px] bg-[#173640] p-2 shadow-[0_22px_55px_rgba(26,57,64,.16)]"><div className="relative min-h-[460px] overflow-hidden rounded-[22px] bg-[#284b52]">{cameraState === 'live' && <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" aria-label="カメラプレビュー" data-testid="video-camera-preview" />}{cameraState === 'captured' && <div className="absolute inset-0 bg-[linear-gradient(135deg,#3d6b68,#d07858_58%,#f1c66b)]"><div className="absolute left-[12%] top-[18%] h-40 w-32 rotate-[-9deg] rounded-[45%_45%_8%_8%] bg-[#e9d9bc]/70" /><div className="absolute bottom-[15%] right-[12%] h-44 w-44 rounded-full border-[18px] border-[#173640]/30" /><div className="absolute inset-0 bg-[#173640]/10" /></div>}{cameraState === 'idle' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#3d6b68,#173640_70%)] px-6 text-center"><div className="grid h-20 w-20 place-items-center rounded-full border border-[#f1c66b]/50 text-[#f1c66b]"><Camera size={31} strokeWidth={1.5} /></div><p className="mt-7 font-display text-2xl font-bold text-[#f4f0e6]">{mission.name}をフレームに</p><p className="mt-2 max-w-xs text-sm leading-6 text-[#adc2b1]">カメラを起動して、発見の記念を一枚。</p></div>}{cameraState === 'fallback' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#244950] px-6 text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#f1c66b] text-[#173640]"><Info size={27} /></div><p className="mt-6 font-display text-2xl font-bold text-[#f4f0e6]">カメラなしでも大丈夫</p><p className="mt-2 max-w-sm text-sm leading-6 text-[#b7c8bb]">{cameraMessage}</p></div>}{cameraState === 'live' && <div className="pointer-events-none absolute inset-7 border border-[#f4f0e6]/60"><span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-[#f1c66b]" /><span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-[#f1c66b]" /><span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-[#f1c66b]" /><span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-[#f1c66b]" /></div>}{cameraState === 'captured' && <div className="absolute bottom-5 left-5 rounded-xl bg-[#173640]/80 px-4 py-3 text-[#f4f0e6] backdrop-blur-sm"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#f1c66b]">memory saved</p><p className="mt-1 text-sm font-bold">{formatDate(new Date().toISOString())} / {regionName}</p></div>}</div></div><div className="mt-6 flex flex-col gap-3 sm:flex-row">{cameraState === 'idle' && <button type="button" onClick={startCamera} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-start-camera"><Camera size={18} />カメラを起動</button>}{cameraState === 'live' && <button type="button" onClick={capture} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-capture-photo"><Camera size={18} />撮影する</button>}{cameraState === 'fallback' && <button type="button" onClick={finishWithoutCamera} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-use-field-note"><Check size={18} />記念メモで残す</button>}{cameraState === 'captured' && <button type="button" onClick={complete} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e47750] px-5 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-complete-mission">ミッションを完了する<ChevronRight size={18} /></button>}<button type="button" onClick={complete} className="flex items-center justify-center rounded-xl border border-[#cdd6ca] bg-[#f9f7f0] px-5 py-3.5 text-sm font-bold text-[#536b65]" data-testid="button-skip-photo">写真なしで完了する</button></div></main>;
}

function CompletePage({ mission }: { mission: Mission }) {
  const [, setLocation] = useLocation();
  const [progress, updateProgress] = useProgress(mission.id);
  const region = findRegion(mission.regionId);
  useEffect(() => {
    if (!progress.discovered) { setLocation('/navigate'); return; }
    if (!progress.completed) updateProgress({ completed: true, completedAt: new Date().toISOString() });
  }, [progress.discovered, progress.completed, setLocation, updateProgress]);
  return <main className="mx-auto max-w-[900px] px-5 pb-safe-bottom-nav pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-12 sm:px-8 sm:pt-20"><div className="relative overflow-hidden rounded-[30px] bg-[#173640] px-6 py-14 text-center text-[#f4f0e6] shadow-[0_22px_55px_rgba(26,57,64,.16)] sm:px-16"><div className="absolute left-[12%] top-[-30px] h-28 w-28 rounded-full border border-[#f1c66b]/20" /><div className="absolute bottom-[-70px] right-[8%] h-48 w-48 rounded-full border border-[#f1c66b]/15" /><div className="relative"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#f1c66b] text-[#173640] shadow-[0_0_0_12px_rgba(241,198,107,.14)] animate-rise"><Check size={38} strokeWidth={3} /></div><p className="mt-9 font-mono text-[10px] uppercase tracking-[.28em] text-[#f1c66b]">mission complete</p><h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-.04em] sm:text-6xl">見つけた。</h1><p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#b7c8bb]">{region?.shortName ?? ''}を歩いて、{mission.name}の一点に到達しました。今日の景色は、あなたのコレクションになりました。</p><div className="mx-auto mt-10 max-w-sm rounded-2xl bg-[#244950] p-4 text-left"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#9cb5a6]">collection +1</p><div className="mt-3 flex items-center justify-between"><div><p className="font-display text-xl font-bold">{mission.name}</p><p className="mt-1 text-xs text-[#a9c1b2]">{region?.name ?? ''} / {formatDate(progress.discoveredAt)}</p></div><MapPinned size={23} className="text-[#f1c66b]" /></div></div><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={() => setLocation(`/region/${mission.regionId}`)} className="rounded-xl bg-[#e47750] px-6 py-3.5 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]" data-testid="button-back-region">次のミッションへ<ChevronRight size={16} className="ml-2 inline" /></button><Link href="/profile" className="rounded-xl border border-[#54736d] px-6 py-3.5 text-sm font-bold text-[#f4f0e6]" data-testid="link-view-record">記録を見る</Link></div></div></div></main>;
}

function ProfilePage({ session, onSignOut }: { session: Session | null; onSignOut: () => void }) {
  const [, setLocation] = useLocation();
  const allProgress = readAllProgress();
  const discovered = publishedMissions.filter((mission) => allProgress[mission.id]?.discovered);
  const cities = new Set(discovered.map((mission) => mission.city));
  const photos = discovered.filter((mission) => allProgress[mission.id]?.captured).length;
  const name = session?.displayName ?? '旅人';
  return <main className="mx-auto max-w-[980px] px-5 pb-safe-bottom-nav pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-8 sm:px-8 sm:pt-12"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div className="flex items-center gap-4 min-w-0"><div className="shrink-0 grid h-16 w-16 place-items-center rounded-[20px] bg-[#dd7552] font-display text-xl font-bold text-white shadow-[4px_4px_0_#b65d47]">{initials(name)}</div><div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#668078]">your collection</p><h1 className="mt-1 font-display text-3xl font-extrabold break-words">{name}さんの記録</h1><p className="mt-1 text-xs text-[#718078] break-all">{session?.email}</p></div></div><button type="button" onClick={() => { onSignOut(); setLocation('/auth'); }} className="flex items-center gap-2 self-start rounded-xl border border-[#e1c9c2] px-4 py-2.5 text-sm font-bold text-[#b24d3d] sm:self-auto shrink-0" data-testid="button-logout"><LogOut size={16} />ログアウト</button></div><div className="mt-10 grid gap-4 sm:grid-cols-3"><StatCard icon={Stamp} number={String(discovered.length).padStart(2, '0')} label="発見した一点" accent="teal" /><StatCard icon={MapPinned} number={String(cities.size).padStart(2, '0')} label="訪れた街" accent="gold" /><StatCard icon={Camera} number={String(photos).padStart(2, '0')} label="残した写真" accent="coral" /></div><section className="mt-12"><div className="flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#668078]">collection</p><h2 className="mt-2 font-display text-2xl font-extrabold">発見の記録</h2></div><span className="font-mono text-[10px] text-[#8b968e]">{String(discovered.length).padStart(2, '0')} / {String(publishedMissions.length).padStart(2, '0')} LOCATIONS</span></div><div className="mt-5 space-y-3">{publishedMissions.map((mission) => { const state = allProgress[mission.id]; return <div key={mission.id} className="overflow-hidden rounded-2xl border border-[#dedfd4] bg-[#f9f7f0]" data-testid={`card-record-${mission.id}`}><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl ${state?.discovered ? 'bg-[linear-gradient(135deg,#3d6b68,#d07858)] text-[#f1c66b]' : 'bg-[#e4ebdf] text-[#9cb0a6]'}`}>{state?.discovered ? <Stamp size={28} /> : <MapPinned size={28} />}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold">{mission.name}</h3>{state?.discovered && <span className="rounded-full bg-[#d9e9dd] px-2.5 py-1 text-[10px] font-bold text-[#1e7471]">{mission.discovery.stamp}</span>}</div><p className="mt-1 text-sm text-[#718078]">{mission.city} · {state?.discovered ? mission.discovery.headline : mission.title}</p></div><div className="text-left sm:text-right"><p className="font-mono text-[10px] text-[#8b968e]">{state?.discovered ? formatDate(state.discoveredAt) : '未発見'}</p><p className="mt-1 text-xs font-bold text-[#dd7552]">{state?.captured ? (state.photo === 'camera-frame' ? '写真あり' : '記念メモ') : state?.discovered ? '発見済み' : '探索中'}</p></div></div></div>; })}</div></section><section className="mt-10 rounded-2xl border border-[#d8ded2] bg-[#e4ebdf] p-5 sm:p-6"><div className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1c66b] text-[#173640]"><ShieldCheck size={20} /></div><div><h3 className="font-display font-bold">この旅のデータは、このブラウザに保存されています</h3><p className="mt-1 text-sm leading-6 text-[#667870]">GeoPuzzleプロトタイプでは、ログイン情報と発見記録を端末内だけで管理しています。別の端末には同期されません。</p></div></div></section></main>;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default App;
