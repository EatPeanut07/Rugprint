import { NextResponse } from "next/server";
import { linkTelegramChat } from "@/lib/alert-store";

export const runtime = "nodejs";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function deriveUserKey(req: Request, message: any): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("userKey")?.trim();
  if (fromQuery) return fromQuery;

  // Deep-link start payload, e.g. "/start <userKey>"
  const text = String(message?.text || "").trim();
  const parts = text.split(/\s+/);
  if (parts.length > 1 && parts[1]) return parts[1].trim();

  const fromId = message?.from?.id;
  if (fromId !== undefined && fromId !== null) return `tg:${fromId}`;

  const chatId = message?.chat?.id;
  return `tg:${chatId}`;
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_TOKEN) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const message = body?.message;
  if (!message || !message.chat || message.chat.id === undefined || message.chat.id === null) {
    return NextResponse.json({ error: "Malformed Telegram update." }, { status: 400 });
  }

  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();

  try {
    if (text === "/start" || text.startsWith("/start ")) {
      const userKey = deriveUserKey(request, message);
      const link = await linkTelegramChat(userKey, chatId);

      const welcome = "\u2705 Rugprint Telegram connected! You'll receive alerts here. /stop to disconnect.";
      await sendTelegramMessage(chatId, welcome);

      return NextResponse.json({ ok: true, subscriptionId: link.subscriptionId, message: link.message }, { status: 200 });
    }

    // Acknowledge any other update without taking action.
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
