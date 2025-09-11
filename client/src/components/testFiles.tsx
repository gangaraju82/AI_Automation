 
type Props = {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
};

export default function TestFileDropdown({ options, selected, onSelect }: Props) {
 
   return (
    <div className="w-full max-w-sm mx-auto">
      <label className="block mb-2 text-sm font-medium text-gray-700">
        Select Test File
      </label>
      <select
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      className="border px-3 py-2 rounded-md"
    >
      <option value="">-- Select File --</option>
      {options.map((opt, idx) => (
        <option key={idx} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    </div>
  );
}
