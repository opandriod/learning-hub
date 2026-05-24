export default function Option({ option, selected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(option.id)}
      className={`p-3 border rounded cursor-pointer mb-2 ${
        selected === option.id ? "bg-blue-500 text-white" : "bg-white"
      }`}
    >
      {option.text}
    </div>
  );
}