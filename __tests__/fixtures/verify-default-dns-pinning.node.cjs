// Run with plain `node`, never `bun`: Bun ignores undici's `connect.lookup` override, so
// the connection pinning done by the default resolver can only be verified under Node.
//
// Usage: node verify-default-dns-pinning.node.cjs <path to a CJS build of node.ts>
//
// Simulates DNS rebinding against the default resolver: the pre-fetch validation lookup
// (dns.promises.lookup) answers with a public address, while any later lookup made by
// the connection itself (the callback-style dns.lookup used by net.connect) answers with
// 127.0.0.1. If the connection is pinned, that second lookup never happens and the local
// server is never reached.
const dns = require("node:dns");
const net = require("node:net");

const REBIND_HOST = "rebind.attacker.example.net";
const PUBLIC_ADDRESS = "1.1.1.1";

async function main() {
  const { getLinkPreview } = require(process.argv[2]);

  const server = net.createServer((socket) => {
    connections++;
    socket.destroy();
  });
  let connections = 0;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const originalPromisesLookup = dns.promises.lookup;
  const originalLookup = dns.lookup;
  let unpinnedLookups = 0;

  dns.promises.lookup = async (hostname, options) => {
    if (hostname === REBIND_HOST) {
      return [{ address: PUBLIC_ADDRESS, family: 4 }];
    }
    return originalPromisesLookup(hostname, options);
  };
  dns.lookup = (hostname, options, callback) => {
    if (hostname === REBIND_HOST) {
      unpinnedLookups++;
      const cb = typeof options === "function" ? options : callback;
      if (options?.all) {
        cb(null, [{ address: "127.0.0.1", family: 4 }]);
      } else {
        cb(null, "127.0.0.1", 4);
      }
      return;
    }
    return originalLookup(hostname, options, callback);
  };

  try {
    for (const protocol of ["http", "https"]) {
      // Expected to fail one way or another: 1.1.1.1 on a random port won't answer.
      // What matters is that the request never re-resolved the host to 127.0.0.1.
      await getLinkPreview(`${protocol}://${REBIND_HOST}:${port}/`, { timeout: 1000 }).catch(
        () => {},
      );
    }
  } finally {
    dns.promises.lookup = originalPromisesLookup;
    dns.lookup = originalLookup;
    await new Promise((resolve) => server.close(resolve));
  }

  if (unpinnedLookups > 0 || connections > 0) {
    console.error(
      `FAIL: connection was not pinned (unpinned lookups: ${unpinnedLookups}, local connections: ${connections})`,
    );
    process.exit(1);
  }

  console.log("PASS");
  // The abandoned connection attempts to the unreachable public address would otherwise
  // keep the event loop alive until undici's connect timeout.
  process.exit(0);
}

main();
