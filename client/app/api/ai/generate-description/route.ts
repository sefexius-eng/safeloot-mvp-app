import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Безопасно читаем запрос от твоего сайта
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Empty request from frontend" }, { status: 400 });
    }

    const title = body?.title || "Секретный товар";

    // 2. Берем ПОЛНУЮ ссылку из Vercel
    const fullUrl = (process.env.AZURE_OPENAI_ENDPOINT || "").trim();
    const apiKey = (process.env.AZURE_OPENAI_API_KEY || "").trim();

    if (!fullUrl) {
      return NextResponse.json({ error: "Azure Endpoint is missing in Vercel" }, { status: 500 });
    }

    // 3. Отправляем прямой запрос
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
            content: `Напиши сочное, продающее описание для товара: ${title}. Возвращай только текст.`
          }
        ]
      })
    });

    // 4. ЧИТАЕМ КАК ТЕКСТ (защита от SyntaxError)
    const rawText = await response.text();

    if (!response.ok) {
      // Теперь, даже если Azure выплюнет HTML, мы увидим его в логах Vercel!
      console.error("🔥 Azure Raw Response:", rawText);
      return NextResponse.json({ error: `Azure Error: ${rawText}` }, { status: response.status });
    }

    // 5. Если всё ОК, парсим текст в JSON
    const data = JSON.parse(rawText);
    const description = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ description });

  } catch (error: any) {
    console.error("Server Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}