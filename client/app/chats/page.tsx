export default function ChatsPage() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-900/30 px-6 py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-5xl text-gray-500 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          💬
        </div>
        <p className="mt-6 text-base leading-8 text-gray-500 md:text-lg">
          Выберите диалог слева, чтобы начать общение
        </p>
      </div>
    </div>
  );
}