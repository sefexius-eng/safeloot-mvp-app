import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const baseUrl = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiKey = process.env.AZURE_OPENAI_API_KEY || "";
    const apiVersion = "2024-02-15-preview";

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
            role: "system",
            content:
              "Ты крутой маркетолог игрового маркетплейса. Преврати краткое название товара в сочное, продающее описание для геймеров. Используй списки (буллиты), делай акцент на безопасности сделки и скорости выдачи. Не пиши вступительных фраз, возвращай ТОЛЬКО готовый текст описания.",
          },
          {
            role: "user",
            content: title,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Direct Fetch Error from Azure:", data);
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