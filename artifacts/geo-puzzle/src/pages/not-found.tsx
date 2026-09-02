import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f4f0e6] px-6 text-center text-[#20373f]">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">404 / off the map</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold">この道は地図にありません。</h1>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-[#e47750] px-6 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]"
        >
          ホームへ戻る
        </Link>
      </div>
    </main>
  );
}
