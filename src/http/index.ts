import {fastify,REGISTRY_URL,BACKEND_URL} from "../proxyserver/server";
const port = 3000;

fastify.listen({ port: port, host:'0.0.0.0' }, function (err, address) {
  console.log("serving proxy to %s %s", REGISTRY_URL, BACKEND_URL);
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
