import {
    combineLatestWith, defer,
    distinctUntilChanged,
    finalize,
    map,
    mergeScan,
    Observable, scan,
    shareReplay,
    startWith, Subject,
    tap
} from "rxjs";
import {Provider} from "@reef-defi/evm-provider";
import {disconnectProvider, initProvider, Network} from "../network";
import {filter} from "rxjs/operators";
import {selectedNetwork$} from "./networkState";
import {forceReloadTokens$} from "./token/reloadTokenState";

const providerConnStateSubj = new Subject<{value:string, timestamp:number}>();
export const providerConnState$ = providerConnStateSubj.pipe(
    scan((state, curr)=>{
        return curr.value==='error'?{...state, err:curr, data:''}: {...curr, err:state.err, data: ''};
    }, {err:{}}),
    startWith('starting provider api ws state'),
    shareReplay(1)
);

export const selectedNetworkProvider$: Observable<{ provider: Provider, network: Network; }> = selectedNetwork$.pipe(
    combineLatestWith(forceReloadTokens$),
    mergeScan((pr_url: {
        provider: Provider | undefined,
        network: Network | undefined
    }, [currNet, _]: [Network, any]) => {
        if (pr_url.network?.rpcUrl === currNet.rpcUrl && !!pr_url.provider && pr_url.provider.api.isConnected) {
            return Promise.resolve(pr_url);
        }
        return new Promise<{ provider: Provider | undefined, network: Network }>(async (resolve, reject) => {
            if (pr_url.provider) {
                try {
                    await disconnectProvider(pr_url.provider);
                    console.log('PROVIDER DISCONNECTED')
                } catch (e: any) {
                    console.log('Error disconnecting provider=', e.message);
                }
            }
            try {
                const pr: Provider = await initProvider(currNet.rpcUrl, providerConnStateSubj);
                console.log('PROVIDER CONNECTED');
                resolve({provider: pr, network: currNet});
            } catch (err) {
                resolve({provider: undefined, network: currNet});
            }
        })

    }, {provider: undefined, network: undefined}),
    filter((p_n) => !!p_n.provider && !!p_n.network),
    map(p_n => p_n as { provider: Provider, network: Network }),
    distinctUntilChanged((v1,v2)=>v1.network.rpcUrl===v2.network.rpcUrl),
    // TODO check if it's called on last unsubscribe
     finalizeWithValue(((n_p) => n_p?disconnectProvider(n_p.provider):null)),
    shareReplay(1)
);


export const selectedProvider$ = selectedNetworkProvider$.pipe(
    map(n_p=>n_p.provider),
    shareReplay(1)
);
export const instantProvider$ = selectedProvider$.pipe(startWith(undefined), shareReplay(1));
// export const setSelectedProvider = (provider: Provider): void => providerSubj.next(provider);

function finalizeWithValue<T>(callback: (value: T) => void) {
    return (source: Observable<T>) => defer(() => {
        let lastValue: T;
        return source.pipe(
            tap((value) => lastValue = value),
            finalize(() => callback(lastValue)),
        );
    });
}
