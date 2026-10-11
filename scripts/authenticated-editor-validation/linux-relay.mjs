import net from "node:net";

// Preserve the same loopback origins/cookie policy for Linux Firefox. The relay
// forwards raw bytes to the Mac services; it does not alter HTTP or credentials.
for (const port of [3101, 8101]) {
  net.createServer((client) => {
    const upstream = net.connect(port, "host.lima.internal");
    client.pipe(upstream);
    upstream.pipe(client);
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
  }).listen(port, "127.0.0.1");
}
