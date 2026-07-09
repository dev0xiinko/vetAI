export default function PetProfileLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="h-80 rounded-[14px] border border-line bg-surface" />
        <div className="flex flex-col gap-5">
          <div className="h-48 rounded-[14px] border border-line bg-surface" />
          <div className="h-48 rounded-[14px] border border-line bg-surface" />
        </div>
      </div>
    </div>
  );
}
