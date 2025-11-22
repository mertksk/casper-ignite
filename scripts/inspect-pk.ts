import { PublicKey } from 'casper-js-sdk';

const hex = '01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2';
const pk = PublicKey.fromHex(hex);

console.log('Account Hash Hex:', pk.accountHash().toHex());