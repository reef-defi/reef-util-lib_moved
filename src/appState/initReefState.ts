import {currentNetwork$, setCurrentNetwork, setCurrentProvider} from "./providerState";
import {catchError, defer, finalize, Observable, of, scan, switchMap, tap} from "rxjs";
import {disconnectProvider, initProvider} from "../utils";
import {Provider} from "@reef-defi/evm-provider";
import {availableNetworks, Network} from "../network/network";
import {accountsJsonSigningKeySubj, accountsJsonSubj, accountsSubj} from "./account/setAccounts";
import {initApolloClient, setNftIpfsResolverFn, StateOptions} from "./util/util";

type destroyConnection = ()=>void;

export const initReefState = (
    {
        network,
        client,
        // signers,
        jsonAccounts,
        ipfsHashResolverFn,
    }: StateOptions,
): destroyConnection => {
    const subscription = currentNetwork$.pipe(
        switchMap((network) => initProvider(network.rpcUrl)
            .then((provider) => ({
                provider,
                network,
            }))),
        scan((state: { provider: Provider | undefined }, newVal: { provider: Provider, network }) => {
            if (state.provider) {
                disconnectProvider(state.provider);
            }
            return {provider: newVal.provider, network: newVal.network};
        }, {provider: undefined}),
        tap((p_n: { provider: Provider, network: Network }) => {
            setCurrentProvider(p_n.provider);
        }),
        tap((p_n) => {
            initApolloClient(p_n.network, client);
        }),
        finalizeWithValue(((p_n) => p_n?disconnectProvider(p_n.provider):null)),
        catchError((err) => {
            console.log('initReefState ERROR=', err.message);
            return of(null);
        }),
    )
        .subscribe({
            error: (e) => {
                console.log('initReefState ERR=', e);
            },
        });
    setCurrentNetwork(network || availableNetworks.mainnet);
    setNftIpfsResolverFn(ipfsHashResolverFn);
    /*if (signers) {
        accountsSubj.next(signers);
    }*/
    if (jsonAccounts) {
        accountsJsonSigningKeySubj.next(jsonAccounts.injectedSigner);
        accountsJsonSubj.next(jsonAccounts.accounts);
    }
    return () => subscription.unsubscribe();
};

function finalizeWithValue<T>(callback: (value: T) => void) {
    return (source: Observable<T>) => defer(() => {
        let lastValue: T;
        return source.pipe(
            tap((value) => lastValue = value),
            finalize(() => callback(lastValue)),
        );
    });
}
