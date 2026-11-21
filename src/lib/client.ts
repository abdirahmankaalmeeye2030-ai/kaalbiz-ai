export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(data?.message || "Something went wrong. Try again.");
  }
  return data as T;
}
