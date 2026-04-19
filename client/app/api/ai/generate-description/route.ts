import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // ЖЕЛЕЗОБЕТОННАЯ ОЧИСТКА: удаляем случайные пробелы и слэши из настроек Vercel
    const baseUrl = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "").trim();
    const deployment = (process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "").trim();
    const apiKey = (process.env.AZURE_OPENAI_API_KEY || "").trim();
    const apiVersion = "2025-01-01-preview"; // Актуальная версия для модели 2025-04-14

    const url = `${baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            // Мы спрятали системный промпт прямо в запрос пользователя,
            // так как некоторые новые модели Azure вообще не поддерживают роль "system"
            content: `Ты маркетолог игрового маркетплейса. Напиши сочное, продающее описание для товара. Используй списки. Возвращай только текст описания без лишних слов.\n\nНазвание товара: ${title}`
          },
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("🔥 Azure Fetch Error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Ошибка API Azure" },
        { status: response.status }
      );
    }

    const description = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ description });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}