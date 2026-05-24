export default function Result({ score, total, onRestart }) {
  return (
    <div className="text-center p-10">
      <h1 className="text-2xl font-bold mb-4">Quiz Finished 🎉</h1>
      <p className="text-lg mb-4">
        Score: {score} / {total}
      </p>

      <button
        onClick={onRestart}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Restart
      </button>
    </div>
  );
}