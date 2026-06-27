export default function RecordingIndicator({ recording = false }) {
  if (!recording) return null
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full shadow-lg">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      <span className="text-xs font-semibold tracking-wide">Recording</span>
    </div>
  )
}
