import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Для отладки в логах Vercel (чтобы убедиться, что переменные не undefined)
    console.log("Endpoint:", process.env.AZURE_OPENAI_ENDPOINT ? "Set" : "Missing");
    console.log("Deployment:", process.env.AZURE_OPENAI_DEPLOYMENT_NAME);

    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: "2024-02-01",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    });

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!, // Обязательное поле для Azure
      messages: [
        {
          role: "system",
          content:
            "Ты крутой маркетолог игрового маркетплейса. Преврати краткое название товара в сочное, продающее описание для геймеров. Используй списки (буллиты), делай акцент на безопасности сделки. Не пиши вступительных фраз, возвращай ТОЛЬКО готовый текст описания.",
        },
        {
          role: "user",
          content: title,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const description = response.choices[0]?.message?.content || "";

    return NextResponse.json({ description });
  } catch (error: any) {
    console.error("Azure OpenAI Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}