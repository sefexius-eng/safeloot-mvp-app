import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = body?.title;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: "2024-02-15-preview", // Стабильная версия для gpt-4o
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME, // Теперь тут будет "gpt-4o"
    });

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
      messages: [
        {
          role: "system",
          content: "Ты крутой маркетолог игрового маркетплейса. Напиши сочное, продающее описание для товара. Используй списки. Возвращай только текст описания без лишних вступлений."
        },
        {
          role: "user",
          content: title
        }
      ],
      temperature: 0.7,
      top_p: 0.95, // Параметр прямо из твоего файла ChatSetup.json
      max_tokens: 800
    });

    const description = response.choices[0]?.message?.content || "";

    return NextResponse.json({ description });

  } catch (error: any) {
    console.error("🔥 Ошибка API Azure:", error);
    return NextResponse.json({ error: error.message || "Ошибка API" }, { status: 500 });
  }
}