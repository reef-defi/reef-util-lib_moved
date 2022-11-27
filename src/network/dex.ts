import {Network, NetworkName} from "./network";

export const REEFSWAP_CONFIG: { [networkName: string]: DexProtocolv2 } = {
    mainnet: {
        routerAddress: '0x641e34931C03751BFED14C4087bA395303bEd1A5',
        factoryAddress: '0x380a9033500154872813F6E1120a81ed6c0760a8',
    },
    testnet: {
        factoryAddress: '0xcA36bA38f2776184242d3652b17bA4A77842707e',
        routerAddress: '0x0A2906130B1EcBffbE1Edb63D5417002956dFd41'
    },
    /*localhost: {
        factoryAddress: '0xD3ba2aA7dfD7d6657D5947f3870A636c7351EfE4',
        routerAddress: '0x818Be9d50d84CF31dB5cefc7e50e60Ceb73c1eb5',
    }*/
};

export interface DexProtocolv2 {
    routerAddress: string;
    factoryAddress: string;
}

export const getReefswapNetworkConfig = (network: Network): DexProtocolv2 => {
    return REEFSWAP_CONFIG[network.name];
}
