export default function PrepQuestionLoading() {
  return (
    <div className="mx-auto w-full max-w-[96rem] animate-pulse px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="h-4 w-56 rounded bg-white/6" />
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)]">
        <div className="h-[44rem] rounded-[1.6rem] border border-white/7 bg-white/[0.025]" />
        <div className="space-y-4">
          <div className="h-52 rounded-[1.4rem] border border-white/7 bg-white/[0.025]" />
          <div className="h-48 rounded-[1.4rem] border border-white/7 bg-white/[0.025]" />
        </div>
      </div>
    </div>
  );
}
