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
  console.log('headers', req.headers);
  if (url.hostname === defaultBackend.hostname) {
    const forwardedHost =
      req.headers["x-forwarded-host"] || req.headers["host"];
    const forwardedPort = req.headers["x-forwarded-port"];
    const forwardedProto = req.headers["x-forwarded-proto"] || "http";
    console.log(`Forwarded Proto: ${forwardedProto}`);
    url.protocol = (forwardedProto as string).split(",")[0]+":";
    console.log(`Forwarded url proto: ${url.protocol}`);
    if (forwardedHost) {
      url.hostname = (forwardedHost as string).split(":")[0];
    }
    if (forwardedPort) {
      if (forwardedPort === "80" && url.protocol === "https:") {
        url.port = "443";
      } else{
        url.port = forwardedPort as string;
      }
    } else{
      url.port = url.protocol === "https:" ? "443" : "80";
    }
  }
  const headers = { ...proxyRes.headers };
  // delete header location to ensure the response is not cached
  delete headers["location"];
  delete headers["Location"];
  headers.location = url.toString();
  console.log('headers', headers);
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
