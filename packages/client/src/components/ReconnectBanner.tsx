interface Props {
  connected: boolean;
  retries: number;
  maxRetries: number;
  onReconnect: () => void;
}

export default function ReconnectBanner({ connected, retries, maxRetries, onReconnect }: Props) {
  if (connected) return null;

  if (retries >= maxRetries) {
    return (
      <div className="flex items-center justify-between bg-red-600/90 px-4 py-2 text-sm text-white">
        <span>Connection lost. Could not reconnect.</span>
        <button
          onClick={onReconnect}
          className="rounded bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-yellow-600/90 px-4 py-2 text-sm text-white">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
      <span>
        Reconnecting... (attempt {retries}/{maxRetries})
      </span>
    </div>
  );
}
