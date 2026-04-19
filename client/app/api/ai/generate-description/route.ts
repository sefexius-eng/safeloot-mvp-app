import { AzureOpenAI } from "openai";
import { NextResponse } from "next/server";

interface GenerateDescriptionRequestBody {
  title?: string;
}

const SYSTEM_PROMPT =
  "Ты крутой маркетолог игрового маркетплейса. Преврати краткое название товара в сочное, продающее описание для геймеров. Используй списки (буллиты), делай акцент на безопасности сделки и скорости выдачи. Не пиши вступительных фраз вроде 'Вот ваше описание', возвращай ТОЛЬКО готовый текст описания.";
const MAX_PRODUCT_DESCRIPTION_LENGTH = 1000;

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: GenerateDescriptionRequestBody;

  try {
    body = (await request.json()) as GenerateDescriptionRequestBody;
  } catch {
    return NextResponse.json(
      { message: "Некорректное тело запроса." },
      { status: 400 },
    );
  }

  const title = body.title?.trim() ?? "";

  if (!title) {
    return NextResponse.json(
      { message: "Поле title обязательно." },
      { status: 400 },
    );
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();

  if (!endpoint || !apiKey || !deploymentName) {
    return NextResponse.json(
      { message: "Azure OpenAI не настроен на сервере." },
      { status: 500 },
    );
  }

  const client = new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion: "2024-02-15-preview",
    deployment: deploymentName,
  });

  try {
    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: title,
        },
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    const generatedText = response.choices[0]?.message?.content?.trim() ?? "";

    if (!generatedText) {
      throw new Error("ИИ вернул пустое описание. Попробуйте снова.");
    }

    return NextResponse.json({
      description: generatedText.slice(0, MAX_PRODUCT_DESCRIPTION_LENGTH),
    });
  } catch (error) {
    console.error("[AI_GENERATE_DESCRIPTION_ERROR]", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { message: "Не удалось сгенерировать описание." },
      { status: 500 },
    );
  }
}