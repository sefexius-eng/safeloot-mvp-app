import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = body?.title;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Берем полную ссылку (которую мы настроили в прошлом шаге)
    const fullUrl = (process.env.AZURE_OPENAI_ENDPOINT || "").trim();
    const apiKey = (process.env.AZURE_OPENAI_API_KEY || "").trim();

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
            content: `Ты маркетолог игрового маркетплейса. Напиши сочное, продающее SEO-описание для товара: "${title}". Используй списки. Возвращай только текст описания.`
          }
        ],
        // КРИТИЧЕСКИ ВАЖНО: жестко ограничиваем ответ, чтобы влезть в лимит 1K TPM
        max_tokens: 250,
        temperature: 0.7
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("🔥 Azure Error:", rawText);
      return NextResponse.json({ error: "Ошибка API Azure" }, { status: response.status });
    }

    const data = JSON.parse(rawText);
    const description = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ description });

  } catch (error: any) {
    console.error("Server Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}