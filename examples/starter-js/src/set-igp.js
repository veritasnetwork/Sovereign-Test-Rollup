// --- Define constants that were present in the Rust code ---
// These would typically come from your configuration or environment
const HYPERLANE_BRIDGE_DOMAIN = 5555;
// --- End of chain-specific constant definitions ---
const SOLANA_TESTNET_DOMAIN = 1399811150; // Solana testnet (not devnet)
const defaultGas = 2000;
const domainOracles = [
    {
        domain: HYPERLANE_BRIDGE_DOMAIN,
        data_value: {
            gas_price: 1,
            token_exchange_rate: 1, // This exchange rate will need to change!
        },
    },
    {
        domain: SOLANA_TESTNET_DOMAIN,
        data_value: {
            gas_price: 1,
            token_exchange_rate: 1, // This exchange rate will need to change!
        },
    },
];
const domainGas = [
    {
        domain: HYPERLANE_BRIDGE_DOMAIN,
        default_gas: defaultGas, // TODO: Set reasonable default gas amount for sov txs
    },
    {
        domain: SOLANA_TESTNET_DOMAIN,
        default_gas: defaultGas, // TODO: Seta reasonable default gas for Solana transactions
    },
];
function setRelayerConfigPayload(relayer_address) {
    return {
        domain_oracle_data: domainOracles,
        domain_default_gas: domainGas,
        default_gas: defaultGas,
        beneficiary: relayer_address,
    };
}
export function setIgpCall(relayer_address) {
    return {
        interchain_gas_paymaster: {
            set_relayer_config: setRelayerConfigPayload(relayer_address),
        },
    };
}
