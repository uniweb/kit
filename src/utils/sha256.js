/**
 * SHA-256 in plain JavaScript, for solving a proof-of-work puzzle.
 *
 * ⭐ **Why not Web Crypto:** a puzzle is up to ~100,000 small digests, and
 * `crypto.subtle.digest` is asynchronous, so every try waits on a promise.
 * Measured 2026-11-05 on the worst case (100,000 tries): Chromium 189 ms with
 * Web Crypto vs 104 ms here; **WebKit 1,524 ms vs 73 ms**. WebKit is every
 * iPhone, so the slow path would be the common one. This file is only in a
 * foundation that submits forms.
 *
 * Checked against Node's `crypto` in `tests/proof.test.js`.
 *
 * @module @uniweb/kit/utils/sha256
 */

const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2])
const W = new Uint32Array(64)
/**
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} the 32-byte digest
 */
export function sha256(bytes) {
  const len = bytes.length, blocks = ((len + 9 + 63) >> 6), buf = new Uint8Array(blocks * 64)
  buf.set(bytes); buf[len] = 0x80
  const bits = len * 8; buf[buf.length - 4] = bits >>> 24; buf[buf.length - 3] = bits >>> 16; buf[buf.length - 2] = bits >>> 8; buf[buf.length - 1] = bits
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19
  for (let o = 0; o < buf.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (buf[o+i*4]<<24)|(buf[o+i*4+1]<<16)|(buf[o+i*4+2]<<8)|buf[o+i*4+3]
    for (let i = 16; i < 64; i++) { const a=W[i-15],b=W[i-2]; W[i]=(((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3))+W[i-16]+(((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10))+W[i-7] }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7))) + ((e&f)^(~e&g)) + K[i] + W[i]) | 0
      const t2 = ((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10))) + ((a&b)^(a&c)^(b&c))) | 0
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0
    }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0
  }
  const out = new Uint8Array(32), hs=[h0,h1,h2,h3,h4,h5,h6,h7]
  for (let i = 0; i < 8; i++) { out[i*4]=hs[i]>>>24; out[i*4+1]=hs[i]>>>16; out[i*4+2]=hs[i]>>>8; out[i*4+3]=hs[i] }
  return out
}
