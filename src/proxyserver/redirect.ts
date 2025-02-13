import * as http from "http";

const PROXY_REDIRECT = process.env.PROXY_REDIRECT || "true";
const HANDLE_REDIRECT = process.env.HANDLE_REDIRECT || "false";

async function handleRedirects(
  defaultBackend: URL,
  proxyRes: http.IncomingMessage,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const location = proxyRes.headers["location"];
  if (!location || PROXY_REDIRECT !== "true") {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
    return;
  }

  const url = new URL(location);
  if (HANDLE_REDIRECT === "true") {
    console.log(`Fetching redirect URL: ${url.toString()}`);
    await fetchRedirects(url, res);
    return;
  }

  if (url.hostname === defaultBackend.hostname) {
    const forwardedHost =
      req.headers["x-forwarded-host"] || req.headers["host"];
    const forwardedPort = req.headers["x-forwarded-port"] || "80";
    const forwardedProto = req.headers["x-forwarded-proto"] || "http";
    if (forwardedHost) {
      url.hostname = (forwardedHost as string).split(":")[0];
    }
    if (forwardedPort) {
      url.port = forwardedPort as string;
    }
    url.protocol = forwardedProto as string;
  }
  const headers = { ...proxyRes.headers, Location: url.toString() };
  console.log(`Redirecting to ${url.toString()}`);
  res.writeHead(302, headers);
  res.end();
}

async function fetchRedirects(url: URL, res: http.ServerResponse) {
  fetch(url.toString())
    .then((response) => {
      const headers: { [key: string]: string } = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);
      const reader = response.body?.getReader();
      const stream = new ReadableStream({
        start(controller) {
          function push() {
        reader?.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            res.end();
            return;
          }
          res.write(value);
          controller.enqueue(value);
          push();
        }).catch((error) => {
          console.error(`Error reading stream: ${error}`);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.write("Internal Server Error");
          res.end();
        });
          }
          push();
        }
      });
    })
    .catch((error) => {
      console.error(`Error fetching redirect URL: ${error}`);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.write("Internal Server Error");
      res.end();
    });
}

export { handleRedirects };
