import Fastify from "fastify";
import { createProxyMiddleware } from "http-proxy-middleware";
import { handleRedirects } from "./redirect";

const REGISTRY_BACKEND =
  process.env.REGISTRY_BACKEND || "https://registry.rancher.com";
const DEFAULT_BACKEND_HOST =
  process.env.DEFAULT_BACKEND_HOST || REGISTRY_BACKEND;

// const DEFAULT_BACKEND_HOST = "https://registry-1.docker.io";
const REGISTRY_URL = new URL(REGISTRY_BACKEND);
const BACKEND_URL = new URL(DEFAULT_BACKEND_HOST);

const fastify = Fastify({
  logger: true,
});
export {fastify, REGISTRY_URL, BACKEND_URL};

const registryProxy = createProxyMiddleware({
  target: REGISTRY_URL,
  changeOrigin: true,
  xfwd: true,
  selfHandleResponse: true,
  preserveHeaderKeyCase: true,
  on: {
    proxyRes: async function (proxyRes, req, res) {
      const status = proxyRes.statusCode || 500; 
      if (status >= 300 && status < 400){
        handleRedirects(BACKEND_URL, proxyRes, req, res);
        return;
      }
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    },
  },
});

const backendProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  xfwd: true,
});

fastify.get("/v2/*", (request, reply) => {
  registryProxy(request.raw, reply.raw);
});

fastify.get("/*", (request, reply) => {
  backendProxy(request.raw, reply.raw);
});

