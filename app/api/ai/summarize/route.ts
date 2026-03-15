import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export const POST = async (req: NextRequest) => {
  try {
    const { body } = await req.json();
    if (!body || typeof body !== "string") {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(
      `Summarize the following note in 1-2 concise sentences. Return only the summary, no preamble:\n\n${body}`
    );
    const summary = result.response.text().trim();

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to summarize" },
      { status: 500 }
    );
  }
};
