import {catchError, combineLatest, map, Observable, of, shareReplay, startWith, switchMap,} from 'rxjs';
import {loadAvailablePools, toAvailablePools} from "./token/pools";
import {NFT, Token, TokenTransfer, TokenWithAmount} from "../token/token";
import {toTokensWithPrice} from "./util/util";
import {reefPrice$} from "../token/reefPrice.rx";
import {loadSignerTokens} from "./token/selectedSignerTokenBalances";
import {apolloClientInstance$} from "../graphql";
import {selectedSigner$} from "./account/selectedSigner";
import {currentNetwork$, currentProvider$} from "./providerState";
import {AvailablePool, Pool} from "../token/pool";
import {selectedSignerAddressUpdate$} from "./account/selectedSignerAddressUpdate";
import {dexConfig, Network} from "../network/network";
import {ReefSigner} from "../account/ReefAccount";
import {loadPools} from "../pools/pools";
import {FeedbackDataModel} from "./model/feedbackDataModel";
import {loadSignerNfts} from "./token/nfts";
import {loadTransferHistory} from "./token/transferHistory";

export const selectedSignerTokenBalances$: Observable<Token[] | null> = combineLatest([
    apolloClientInstance$,
    selectedSigner$,
    currentProvider$,
]).pipe(
    switchMap(loadSignerTokens),
    catchError(((err) => {
        console.log('selectedSignerTokenBalances$ ERROR=', err.message);
        return of(null);
    })),
    shareReplay(1)
);

export const selectedSignerPools$: Observable<Pool[]> = combineLatest([
    selectedSignerTokenBalances$,
    currentNetwork$,
    selectedSignerAddressUpdate$,
]).pipe(
    switchMap(([tkns, network, signer]: [Token[] | null, Network, ReefSigner]) => (signer && tkns?.length ? loadPools(tkns as Token[], signer.signer, dexConfig[network.name].factoryAddress) : [])),
    shareReplay(1),
);

// TODO pools and tokens emit events at same time - check how to make 1 event from it
export const selectedSignerTokenPrices$: Observable<TokenWithAmount[]> = combineLatest([
    selectedSignerTokenBalances$,
    reefPrice$,
    selectedSignerPools$,
]).pipe(
    map(toTokensWithPrice),
    shareReplay(1)
);

export const availableReefPools$: Observable<AvailablePool[]> = combineLatest([
    apolloClientInstance$,
    currentProvider$,
]).pipe(
    switchMap(loadAvailablePools),
    map(toAvailablePools),
    shareReplay(1)
);


export const selectedSignerNFTs$: Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> = combineLatest([
    apolloClientInstance$,
    selectedSignerAddressUpdate$,
    currentProvider$,
])
    .pipe(
        switchMap(loadSignerNfts),
        shareReplay(1)
    );


export const transferHistory$: Observable<null | TokenTransfer[]> = combineLatest([
    apolloClientInstance$, selectedSignerAddressUpdate$, currentNetwork$
]).pipe(
    switchMap(loadTransferHistory),
    startWith(null),
    shareReplay(1),
);
