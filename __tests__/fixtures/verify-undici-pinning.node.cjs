// Run with plain `node`, never `bun`: Bun replaces the "undici" package with its own
// native implementation, which does not honor undici's `connect.lookup` override, so
// this can only be verified against the real undici package under Node - the runtime
// createPinnedDispatcher/fetchWithDispatcher in index.ts are written for.
//
// This mirrors that mechanism directly (Agent + connect.lookup + undici's own fetch)
// as a regression guard: if a future undici upgrade stops honoring this override, this
// fails loudly instead of silently degrading DNS-rebinding protection to a no-op.
const net = require("node:net");
const { Agent, fetch: undiciFetch } = require("undici");

async function main() {
  const server = net.createServer();
  let connectionReceived = false;

  server.on("connection", (socket) => {
    connectionReceived = true;
    socket.destroy();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const agent = new Agent({
    connect: {
      lookup(hostname, options, callback) {
        if (hostname !== "example.com") {
          callback(new Error(`unexpected lookup for ${hostname}`));
          return;
        }

        if (options?.all) {
          callback(null, [{ address: "127.0.0.1", family: 4 }]);
          return;
        }

        callback(null, "127.0.0.1", 4);
      },
    },
  });

  try {
    await undiciFetch(`https://example.com:${port}/`, {
      dispatcher: agent,
      signal: AbortSignal.timeout(2000),
    }).catch(() => {
      // Expected: this plain TCP server doesn't speak TLS, so the handshake never
      // completes. What matters is whether the connection attempt reached it at all.
    });
  } finally {
    await agent.destroy();
    await new Promise((resolve) => server.close(resolve));
  }

  if (!connectionReceived) {
    console.error("FAIL: pinned dispatcher never connected to the validated address");
    process.exit(1);
  }

  console.log("PASS");
}

main();
