interface CoachingNotesProps {
  notes: string[];
}

const POSITIVE_KEYWORDS = [
  'excellent', 'good', 'smooth', 'strong', 'consistent', 'stable', 'maintained',
  'well', 'no safety concerns',
];

function isPositive(note: string): boolean {
  const lower = note.toLowerCase();
  return POSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function CoachingNotes({ notes }: CoachingNotesProps) {
  if (notes.length === 0) return null;

  return (
    <ul className="space-y-2">
      {notes.map((note, i) => {
        const positive = isPositive(note);
        return (
          <li
            key={i}
            className={`flex gap-2 text-sm rounded-lg px-3 py-2 ${
              positive
                ? 'bg-green-50 text-green-800'
                : note.toLowerCase().includes('note:') || note.toLowerCase().includes('gps')
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-sky-cloud text-sky-night'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {positive ? '✓' : note.toLowerCase().includes('note:') ? '⚠' : '→'}
            </span>
            <span>{note}</span>
          </li>
        );
      })}
    </ul>
  );
}
