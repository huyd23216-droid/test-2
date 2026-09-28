import { SPEECH_RATES } from '../config.js'

export default function RateSelector({ value, onChange, label = 'Tốc độ' }) {
  return (
    <div className="rate" role="group" aria-label={label}>
      <span className="rate-label">{label}</span>
      <div className="segmented">
        {SPEECH_RATES.map((r) => (
          <button
            key={r}
            type="button"
            className={Number(value) === r ? 'active' : ''}
            aria-pressed={Number(value) === r}
            onClick={() => onChange(r)}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}
