import {Network} from "../network/network";

export const getGQLUrls = (network: Network): { ws: string; http: string } | undefined => {
    if (!network.graphqlUrl) {
        return undefined;
    }
    const ws = network.graphqlUrl.startsWith('http')
        ? network.graphqlUrl.replace('http', 'ws')
        : network.graphqlUrl;
    const http = network.graphqlUrl.startsWith('ws')
        ? network.graphqlUrl.replace('ws', 'http')
        : network.graphqlUrl;
    return {ws, http};
};
