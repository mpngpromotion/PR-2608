/**
 * loading.tsx
 */

export default function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white text-black">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}
