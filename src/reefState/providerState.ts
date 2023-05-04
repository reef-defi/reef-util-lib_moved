import {
    combineLatest,
    combineLatestWith, defer, finalize, map,
    mergeScan,
    Observable,
    ReplaySubject,
    shareReplay,
    startWith,
    switchMap, tap
} from 'rxjs';
import {Provider} from '@reef-defi/evm-provider';
import {Network} from "../network/network";
import {disconnectProvider, initProvider} from "../network";
import {forceReload$} from "./tokenState.rx";
import {filter} from "rxjs/operators";

// const providerSubj: ReplaySubject<Provider> = new ReplaySubject<Provider>(1);
const selectedNetworkSubj: ReplaySubject<Network> = new ReplaySubject<Network>(1);

export const ACTIVE_NETWORK_LS_KEY = 'reef-app-active-network';
export const selectedNetwork$ = selectedNetworkSubj.asObservable();
export const setSelectedNetwork = (network: Network): void => {
    if (network != null) {
        try {
            localStorage.setItem(ACTIVE_NETWORK_LS_KEY, JSON.stringify(network));
        } catch (e) {
            // when cookies disabled localStorage can throw
        }
    }
    selectedNetworkSubj.next(network);
};
selectedNetwork$.subscribe((network) => console.log('SELECTED NETWORK=', network.rpcUrl));

export const selectedNetworkProvider$: Observable<{ provider: Provider, network: Network; }> = selectedNetwork$.pipe(
    combineLatestWith(forceReload$),
    mergeScan((pr_url: {
        provider: Provider | undefined,
        network: Network | undefined
    }, [currNet, _]: [Network, any]) => {
        if (pr_url.network?.rpcUrl === currNet.rpcUrl && !!pr_url.provider) {
            return Promise.resolve(pr_url);
        }
        return new Promise<{ provider: Provider | undefined, network: Network }>(async (resolve, reject) => {
            if (pr_url.provider) {
                try {
                    await disconnectProvider(pr_url.provider);
                } catch (e: any) {
                    console.log('Error disconnecting provider=', e.message);
                }
            }
            try {
                const pr: Provider = await initProvider(currNet.rpcUrl);
                resolve({provider: pr, network: currNet});
            } catch (err) {
                resolve({provider: undefined, network: currNet});
            }
        })

    }, {provider: undefined, network: undefined}),
    filter((p_n) => !!p_n.provider && !!p_n.network),
    map(p_n => p_n as { provider: Provider, network: Network }),
    tap(v=>console.log('PPPP',v)),
    // TODO check if it's called on last unsubscribe
    //  finalizeWithValue(((n_p) => n_p?disconnectProvider(n_p.provider):null)),
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
