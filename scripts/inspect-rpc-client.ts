import { RpcClient, HttpHandler } from 'casper-js-sdk';

// Mock config
const url = 'http://127.0.0.1:7777/rpc';
const client = new RpcClient(new HttpHandler(url, "fetch"));

console.log('RpcClient methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
