import {fastify} from "../proxyserver/server";
import awsLambdaFastify from '@fastify/aws-lambda';

const proxy = awsLambdaFastify(fastify,{});

exports.handler = proxy;
