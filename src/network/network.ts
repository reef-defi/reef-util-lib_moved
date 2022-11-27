export type NetworkName = 'mainnet' | 'testnet' | 'localhost';

export interface Network {
    rpcUrl: string;
    reefscanUrl: string;
    name: NetworkName;
    graphqlUrl: string;
    genesisHash: string;
    reefscanFrontendUrl: string;
}

export const SS58_REEF = 42;

export type Networks = Record<NetworkName, Network>;

export const AVAILABLE_NETWORKS: Networks = {
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

