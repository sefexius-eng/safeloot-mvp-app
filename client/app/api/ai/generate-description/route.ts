import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // БЕРЕМ ГОТОВУЮ ПОЛНУЮ ССЫЛКУ ИЗ VERCEL (без всяких добавлений)
    const fullUrl = (process.env.AZURE_OPENAI_ENDPOINT || "").trim();
    const apiKey = (process.env.AZURE_OPENAI_API_KEY || "").trim();

    if (!fullUrl) {
      console.error("Endpoint is missing");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Ты крутой маркетолог игрового маркетплейса. Преврати краткое название товара в сочное, продающее описание для геймеров. Используй списки (буллиты), делай акцент на безопасности сделки и скорости выдачи. Не пиши вступительных фраз, возвращай ТОЛЬКО готовый текст описания.\n\nНазвание товара: ${title}`
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