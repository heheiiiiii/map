export async function listen(app) {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

export function parseSSEText(text) {
  return text
    .split("\n\n")
    .filter((b) => b.trim())
    .map((block) => {
      const ev = {};
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) ev.event = line.slice(7);
        if (line.startsWith("data: ")) ev.data = JSON.parse(line.slice(6));
      }
      return ev;
    });
}
