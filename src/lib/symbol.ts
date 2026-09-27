export const symToSlug = (s: string) => s.replace("/", "-");
export const slugToSym = (slug: string) => decodeURIComponent(slug).replace("-", "/").toUpperCase();
export const baseOf = (s: string) => s.split("/")[0];
export const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP Ripple", BNB: "BNB Binance coin", DOGE: "Dogecoin", ADA: "Cardano", TRX: "Tron", AVAX: "Avalanche",
  LINK: "Chainlink", DOT: "Polkadot", TON: "Toncoin", SHIB: "Shiba Inu", LTC: "Litecoin", BCH: "Bitcoin Cash", SUI: "Sui crypto", PEPE: "Pepe coin", NEAR: "NEAR Protocol",
  UNI: "Uniswap", APT: "Aptos", ICP: "Internet Computer", XLM: "Stellar Lumens", ETC: "Ethereum Classic", HBAR: "Hedera", FIL: "Filecoin", ARB: "Arbitrum", OP: "Optimism",
  ATOM: "Cosmos ATOM", AAVE: "Aave", WIF: "dogwifhat", TAO: "Bittensor", RENDER: "Render token", INJ: "Injective", ZEC: "Zcash", XMR: "Monero", ENA: "Ethena", ONDO: "Ondo",
  WLD: "Worldcoin", SEI: "Sei network", TIA: "Celestia", JUP: "Jupiter crypto", FET: "Fetch.ai", BONK: "Bonk coin", FLOKI: "Floki", ALGO: "Algorand", VET: "VeChain", CRV: "Curve DAO",
  HYPE: "Hyperliquid", ASTER: "Aster DEX", PUMP: "Pump.fun", TRUMP: "Trump memecoin", LDO: "Lido DAO", MKR: "Maker DAO", STX: "Stacks", POL: "Polygon", GALA: "Gala games",
};
export const coinName = (symbol: string) => COIN_NAMES[baseOf(symbol)] ?? baseOf(symbol);
