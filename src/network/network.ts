import {REEF_TOKEN, Token} from '../token/tokenModel';

export type AvailableNetworks = 'mainnet' | 'testnet' | 'localhost';

export interface Bond {
    name: string;
    description: string;
    contractAddress: string;
    validatorAddress: string;
    stake: Token;
    farm: Token;
    apy: string;
}

export interface Network {
    rpcUrl: string;
    reefscanUrl: string;
    name: AvailableNetworks;
    graphqlUrl: string;
    genesisHash: string;
    reefscanFrontendUrl: string;
}

export interface DexProtocolv2 {
    routerAddress: string;
    factoryAddress: string;
}

export const SS58_REEF = 42;

export type Networks = Record<AvailableNetworks, Network>;

export const availableNetworks: Networks = {
    testnet: {
        name: 'testnet',
        rpcUrl: 'wss://rpc-testnet.reefscan.com/ws',
        reefscanUrl: 'https://testnet.reefscan.com',
        graphqlUrl: 'wss://testnet.reefscan.com/graphql',
        genesisHash: '0x0f89efd7bf650f2d521afef7456ed98dff138f54b5b7915cc9bce437ab728660',
        reefscanFrontendUrl: 'https://testnet.reefscan.com'
    },
    mainnet: {
        name: 'mainnet',
        rpcUrl: 'wss://rpc.reefscan.com/ws',
        reefscanUrl: 'https://reefscan.com',
        graphqlUrl: 'wss://reefscan.com/graphql',
        genesisHash: '0x7834781d38e4798d548e34ec947d19deea29df148a7bf32484b7b24dacf8d4b7',
        reefscanFrontendUrl: 'https://reefscan.com',
    },
    localhost: {
        name: 'localhost',
        rpcUrl: 'ws://localhost:9944',
        reefscanUrl: 'http://localhost:8000',
        graphqlUrl: 'ws://localhost:8080/v1/graphql',
        genesisHash: '', // TODO ?
        reefscanFrontendUrl: 'http://localhost:3000',
    },
};

export const bondsMainnet: Bond[] = [
    {
        name: 'Reef community staking bond',
        description: '',
        contractAddress: '0x7D3596b724cEB02f2669b902E4F1EEDeEfad3be6',
        validatorAddress: '5Hax9GZjpurht2RpDr5eNLKvEApECuNxUpmRbYs5iNh7LpHa',
        stake: {...REEF_TOKEN},
        farm: {...REEF_TOKEN},
        apy: '32',
    },
];

export const dexConfig = {
    mainnet: {
        routerAddress: '0x641e34931C03751BFED14C4087bA395303bEd1A5',
        factoryAddress: '0x380a9033500154872813F6E1120a81ed6c0760a8',
    },
    testnet: {
        factoryAddress: '0xcA36bA38f2776184242d3652b17bA4A77842707e',
        routerAddress: '0x0A2906130B1EcBffbE1Edb63D5417002956dFd41'
    },
    localhost: {
        factoryAddress: '0xD3ba2aA7dfD7d6657D5947f3870A636c7351EfE4',
        routerAddress: '0x818Be9d50d84CF31dB5cefc7e50e60Ceb73c1eb5',
    }
};
