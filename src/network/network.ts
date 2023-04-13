export type NetworkName = 'mainnet' | 'testnet' | 'localhost';

export interface Network {
    rpcUrl: string;
    reefscanUrl: string;
    verificationApiUrl: string;
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
        rpcUrl: 'wss://rpc-testnet.reefscan.info/ws',
        reefscanUrl: 'https://testnet.reefscan.info',
        verificationApiUrl: 'https://api-testnet.reefscan.com',
        graphqlUrl: 'wss://squid.subsquid.io/reef-explorer-testnet/graphql',
        // graphqlUrl: 'wss://testnet.reefscan.com/graphql',
        genesisHash: '0xb414a8602b2251fa538d38a9322391500bd0324bc7ac6048845d57c37dd83fe6',
        reefscanFrontendUrl: 'https://testnet.reefscan.info'
    },
    mainnet: {
        name: 'mainnet',
        rpcUrl: 'wss://rpc.reefscan.info/ws',
        reefscanUrl: 'https://reefscan.info',
        verificationApiUrl: 'https://api.reefscan.com',
        graphqlUrl: 'wss://squid.subsquid.io/reef-explorer/graphql',
        // graphqlUrl: 'wss://reefscan.com/graphql',
        genesisHash: '0x7834781d38e4798d548e34ec947d19deea29df148a7bf32484b7b24dacf8d4b7',
        reefscanFrontendUrl: 'https://reefscan.info',
    },
    localhost: {
        name: 'localhost',
        rpcUrl: 'ws://localhost:9944',
        reefscanUrl: 'http://localhost:8000',
        verificationApiUrl: 'http://localhost:8001',
        graphqlUrl: 'ws://localhost:8080/v1/graphql',
        genesisHash: '', // TODO ?
        reefscanFrontendUrl: 'http://localhost:3000',
    },
};

