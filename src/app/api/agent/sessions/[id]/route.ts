import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/sessions/[id]
 * Load one agent chat session with all its messages (including the
 * JSON-serialized ReAct step trace attached to each assistant message).
 *
 * DELETE /api/agent/sessions/[id]
 * Delete the session and all its messages.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  const { id } = await params;

  const session = await db.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { provider: true },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (ctx && session.orgId && session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = session.messages.map((m) => {
    let parsedSteps = null;
    if (m.agentSteps && typeof m.agentSteps === "string") {
      try { parsedSteps = JSON.parse(m.agentSteps); } catch { /* leave null */ }
    } else if (m.agentSteps && typeof m.agentSteps === "object") {
      parsedSteps = m.agentSteps;
    }
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      latencyMs: m.latencyMs,
      tokensUsed: m.tokensUsed,
      failedOver: m.failedOver,
      originalProviderId: m.originalProviderId,
      createdAt: m.createdAt,
      provider: m.provider
        ? {
            id: m.provider.id,
            name: m.provider.name,
            displayName: m.provider.displayName,
            color: m.provider.color,
            icon: m.provider.icon,
          }
        : null,
      agentSteps: parsedSteps,
    };
  });

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      agentType: session.agentType,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  const { id } = await params;

  const session = await db.chatSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (ctx && session.orgId && session.orgId !== ctx.org.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.chatSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
