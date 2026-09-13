import { config } from "@/server/session";
import { failure, HttpError, session, upstream } from "@/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await session();
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new HttpError(404, "Foto não encontrada.");
    const response = await upstream(`stores/${config().slug}/images/${id}`);
    if (!response.ok)
      throw new HttpError(response.status, "Foto indisponível.");
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
