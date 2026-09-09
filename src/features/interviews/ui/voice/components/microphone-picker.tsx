export function MicrophonePicker({
  devices,
  selectedId,
  disabled,
  onChange,
  className = ""
}: {
  devices: MediaDeviceInfo[];
  selectedId: string;
  disabled: boolean;
  onChange: (deviceId: string) => void;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="sr-only">Microphone input</span>
      <select
        value={selectedId}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full truncate rounded-lg bg-cream/[0.045] px-3 text-xs text-cream outline-none transition focus:bg-cream/[0.075] disabled:opacity-40"
        aria-label="Microphone input"
      >
        {devices.length === 0 ? <option value="">No microphone found</option> : null}
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
