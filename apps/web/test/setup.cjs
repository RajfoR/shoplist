// jsdom w Jest 29 nie ma TextEncoder, którego używa biblioteka qrcode.
const { TextDecoder, TextEncoder } = require("node:util");
Object.assign(globalThis, { TextDecoder, TextEncoder });
