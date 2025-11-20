# CEP-18 Token Contract

This directory contains the CEP-18 (Casper ERC-20 equivalent) smart contract WASM file needed for token deployment.

## Quick Setup (Download Pre-compiled)

Download the latest CEP-18 WASM from the official releases:

```bash
# Download v1.2.0 (latest)
curl -L -o cep18.wasm "https://github.com/casper-ecosystem/cep18/releases/download/v1.2.0/cep18.wasm"
```

Place the file in this directory (`/public/contracts/cep18.wasm`).

## Alternative: Compile from Source

If you prefer to compile the contract yourself:

```bash
# 1. Clone the repository
git clone https://github.com/casper-ecosystem/cep18.git
cd cep18

# 2. Install Rust if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 3. Install wabt (for wasm-strip)
# macOS:
brew install wabt
# Linux:
sudo apt-get install wabt

# 4. Build the contract
make prepare
make build-contract

# 5. Copy the WASM file
cp ./target/wasm32-unknown-unknown/release/cep18.wasm /path/to/your/project/public/contracts/
```

## Verify Installation

Check that the file exists:
```bash
ls -lh public/contracts/cep18.wasm
```

The file should be around 100-200 KB in size.

## References

- CEP-18 Standard: https://github.com/casper-ecosystem/cep18
- Casper Docs: https://docs.casper.network/resources/tutorials/beginner/cep18
