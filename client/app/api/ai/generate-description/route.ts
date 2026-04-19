import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export async function POST(req: Request) {
  try {
    // 1. Инициализируем клиент с железобетонными настройками из скриншота
    const client = new AzureOpenAI({
      endpoint: "https://nesef-mo520qbb-eastus2.cognitiveservices.azure.com/",
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: "2024-12-01-preview",
      deployment: "safeloot-text-model",
    });

    // 2. Делаем МАКСИМАЛЬНО безобидный запрос, чтобы обойти фильтр на оружие
    const response = await client.chat.completions.create({
      model: "safeloot-text-model",
      messages: [
        {
          role: "user",
          content: "Напиши одно слово: Привет"
        }
      ]
    });

    const description = response.choices[0]?.message?.content || "";

    return NextResponse.json({ description });

  } catch (error: any) {
    console.error("🔥 Ошибка:", error);
    return NextResponse.json({ error: error.message || "Ошибка API" }, { status: 500 });
  }
}