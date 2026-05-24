import Option from "./Option";

export default function QuestionCard({
  question,
  selectedOption,
  onSelect,
}) {
  return (
    <div className="p-6 shadow rounded bg-white">
      <h2 className="text-lg font-semibold mb-4">
        {question.question}
      </h2>

      {question.options.map((opt) => (
        <Option
          key={opt.id}
          option={opt}
          selected={selectedOption}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}