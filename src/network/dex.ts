import {Network} from "./network";

export const REEFSWAP_CONFIG: { [networkName: string]: DexProtocolv2 } = {
    mainnet: {
        factoryAddress: '0x380a9033500154872813F6E1120a81ed6c0760a8',
        routerAddress: '0x641e34931C03751BFED14C4087bA395303bEd1A5',
        graphqlDexsUrl: "https://squid.subsquid.io/reef-swap/graphql",
    },
    testnet: {
        factoryAddress: '0x06D7a7334B9329D0750FFd0a636D6C3dFA77E580',
        routerAddress: '0xa29DFc7329ac30445Ba963E313fD26E171722057',
        graphqlDexsUrl: "https://squid.subsquid.io/reef-swap-testnet/graphql",
    },
    /*localhost: {
        factoryAddress: '0xD3ba2aA7dfD7d6657D5947f3870A636c7351EfE4',
        routerAddress: '0x818Be9d50d84CF31dB5cefc7e50e60Ceb73c1eb5',
        graphqlDexsUrl: "http://localhost:4351/graphql",
    }*/
};

export interface DexProtocolv2 {
    routerAddress: string;
    factoryAddress: string;
    graphqlDexsUrl: string;
}

export const getReefswapNetworkConfig = (network: Network): DexProtocolv2 => {
    return REEFSWAP_CONFIG[network.name];
}
