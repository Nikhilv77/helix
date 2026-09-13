export default function Loading() {
  return (
    <main className="reports-skeleton mx-auto flex min-h-screen w-full max-w-[84rem] animate-pulse flex-col px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10" aria-busy="true" aria-label="Loading reports">
      <div className="mx-auto h-56 w-full max-w-3xl rounded-3xl bg-white/[0.04]" />
      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-white/[0.04]" />)}
      </div>
      <div className="mx-auto mt-7 h-72 w-full max-w-6xl rounded-3xl bg-white/[0.04]" />
    </main>
  );
}
