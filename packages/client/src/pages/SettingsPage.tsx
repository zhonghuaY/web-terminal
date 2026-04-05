import { themes } from '../themes';
import { FONT_FAMILIES, type Preferences } from '../hooks/usePreferences';

interface Props {
  prefs: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onClose: () => void;
}

export default function SettingsPage({ prefs, onUpdate, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ×
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => onUpdate({ theme: t.name })}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    prefs.theme === t.name
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <span
                    className="inline-block h-4 w-4 rounded"
                    style={{ backgroundColor: t.theme.background }}
                  />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Font Size: {prefs.fontSize}px
            </label>
            <input
              type="range"
              min={10}
              max={24}
              value={prefs.fontSize}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value, 10) })}
              className="w-full accent-blue-500"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-600">
              <span>10px</span>
              <span>24px</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Font Family</label>
            <select
              value={prefs.fontFamily}
              onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
