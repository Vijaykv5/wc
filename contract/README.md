# FANIQ Passport Program

This Anchor workspace enforces the three on-chain rules FANIQ needs:

- A wallet can create exactly one fan passport.
- The passport country is immutable because there is no update instruction and the passport PDA can only be initialized once.
- A memory NFT can be registered only when the wallet signs and already has a passport PDA.

## Program ID

```text
FANXexs6P2Fst4NiiCdH9jx39sxPCGRRVpC2nevL5C6U
```

## PDAs

Fan passport:

```text
["passport", owner]
```

Memory record:

```text
["memory", owner, nft_mint]
```

## Instructions

`create_passport(country)`

Creates the locked fan passport for the signing wallet. Calling this twice fails because the PDA already exists.

`register_memory(memory_country, nft_mint, metadata_uri)`

Creates an on-chain record that links a minted NFT to the signing wallet's fan passport.

The memory country is intentionally separate from the passport country. This keeps the passport identity locked while still allowing a fan to mint memories for other countries or matches.

## Local Checks

```bash
cd contract
cargo check
anchor build
```
