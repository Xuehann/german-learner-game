interface VirtualKeyboardProps {
  onInsert: (char: string) => void;
  disabled?: boolean;
}

const SPECIAL_CHARS = ['ä', 'ö', 'ü', 'ß'];

export const VirtualKeyboard = ({ onInsert, disabled = false }: VirtualKeyboardProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {SPECIAL_CHARS.map((char) => (
        <button
          key={char}
          type="button"
          className="rounded-xl border border-butcher-wood/40 bg-white px-4 py-2 text-lg font-semibold text-butcher-deep transition hover:-translate-y-0.5 hover:bg-butcher-cream disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onInsert(char)}
          disabled={disabled}
        >
          {char}
        </button>
      ))}
    </div>
  );
};
