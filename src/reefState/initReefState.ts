import {selectedNetwork$, setSelectedNetwork, setSelectedProvider} from "./providerState";
import {catchError, defer, finalize, Observable, of, scan, switchMap, tap} from "rxjs";
import {Provider} from "@reef-defi/evm-provider";
import {AVAILABLE_NETWORKS, Network} from "../network/network";
import {accountsJsonSigningKeySubj, setAccounts} from "./account/setAccounts";
import {setNftIpfsResolverFn} from "./token/nftUtils";
import {ApolloClient} from "@apollo/client";
import {AccountJson} from "@reef-defi/extension-base/background/types";
import {InjectedAccountWithMeta} from "@polkadot/extension-inject/types";
import {InjectedAccountWithMeta as InjectedAccountWithMetaReef} from "@reef-defi/extension-inject/types";
import {Signer as InjectedSigningKey} from "@polkadot/api/types";
import {ipfsUrlResolverFn} from "../token/nftUtil";
import {getGQLUrls} from "../graphql/gqlUtil";
import {apolloClientSubj, setApolloUrls} from "../graphql/apollo";
import {disconnectProvider, initProvider} from "../network";

export interface StateOptions {
    network?: Network;
    client?: ApolloClient<any>;
    jsonAccounts?:{accounts: AccountJson[] | InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[], injectedSigner: InjectedSigningKey}
    ipfsHashResolverFn?: ipfsUrlResolverFn;
}

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
    const subscription = selectedNetwork$.pipe(
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
            setSelectedProvider(p_n.provider);
        }),
        tap((p_n) => {
            initApolloClient(p_n.network, client);
        }),
        finalizeWithValue(((p_n) => p_n?disconnectProvider(p_n.provider):null)),
        catchError((err) => {
            console.log('initReefState kill$ ERROR=', err.message);
            return of(null);
        }),
    )
        .subscribe({
            error: (e) => {
                console.log('initReefState ERR=', e);
            },
        });
    setSelectedNetwork(network || AVAILABLE_NETWORKS.mainnet);
    setNftIpfsResolverFn(ipfsHashResolverFn);
    /*if (signers) {
        accountsSubj.next(signers);
    }*/
    if (jsonAccounts) {
        accountsJsonSigningKeySubj.next(jsonAccounts.injectedSigner);
        setAccounts(jsonAccounts.accounts);
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

function initApolloClient(selectedNetwork?: Network, client?: ApolloClient<any>) {
    if (selectedNetwork) {
        if (!client) {
            const gqlUrls = getGQLUrls(selectedNetwork);
            if (gqlUrls) {
                setApolloUrls(gqlUrls);
            }
        } else {
            apolloClientSubj.next(client);
        }
    }
}

