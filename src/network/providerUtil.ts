import {Provider} from '@reef-defi/evm-provider';
import {WsProvider} from '@polkadot/api';
import {Subject} from "rxjs";
import {WsConnectionState} from "../reefState/ws-connection-state";

export async function initProvider(providerUrl: string, providerConnStateSubj?: Subject<WsConnectionState>) {
    const newProvider = new Provider({
        provider: new WsProvider(providerUrl),
    });
    try {
        newProvider.api.on("connected", (v) => providerConnStateSubj?.next({
            isConnected: true,
            status: {value: 'connected', timestamp: (new Date()).getTime(), data: v}
        }));
        newProvider.api.on("error", (v) => providerConnStateSubj?.next({
            isConnected: false,
            status: {value: 'error', timestamp: (new Date()).getTime(), data: v}
        }));
        newProvider.api.on("disconnected", (v) => providerConnStateSubj?.next({
            isConnected: false,
            status: {value: 'disconnected', timestamp: (new Date()).getTime(), data: v}
        }))
        newProvider.api.on("ready", (v) => providerConnStateSubj?.next({
            isConnected: true,
            status: {value: 'connected', timestamp: (new Date()).getTime(), data: v}
        }))
        await newProvider.api.isReadyOrError;
    } catch (e) {
        console.log('Provider isReadyOrError ERROR=', e);
        throw e;
    }
    return newProvider;
}

export async function disconnectProvider(provider: Provider) {
    try {
        await provider.api.isReadyOrError;
        await provider.api.disconnect();
    } catch (e: any) {
        console.log('Provider disconnect err=', e.message);
    }
}
