import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: "2025-01-01-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    });

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!, // Обязательно для Azure
      messages: [
        {
          role: "user",
          content: `Ты крутой маркетолог игрового маркетплейса. Преврати краткое название товара в сочное, продающее описание для геймеров. Используй списки (буллиты), делай акцент на безопасности сделки и быстрой выдаче. Не пиши вступительных фраз, возвращай ТОЛЬКО готовый текст описания.\n\nНазвание товара: ${title}`
        }
      ]
      // Мы полностью удалили temperature, max_tokens и роль system
      // Новые Pro-модели выдают из-за них ошибку 400
    });

    const description = response.choices[0]?.message?.content || "";

    return NextResponse.json({ description });

  } catch (error: any) {
    console.error("Azure OpenAI Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}