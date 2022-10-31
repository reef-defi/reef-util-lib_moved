import {
    catchError,
    combineLatest,
    map,
    mapTo, mergeWith,
    Observable,
    of,
    shareReplay,
    startWith,
    switchMap,
    withLatestFrom,
} from 'rxjs';
import {loadAvailablePools, toAvailablePools} from "./token/pools";
import {NFT, Token, TokenBalance, TokenTransfer, TokenWithAmount} from "../token/token";
import {toTokensWithPrice_fbk} from "./util/util";
import {reefPrice_fbk$} from "../token/reefPrice.rx";
import {loadSignerTokens_fbk, setReefBalanceFromSigner} from "./token/selectedSignerTokenBalances";
import {apolloClientInstance$} from "../graphql";
import {selectedSigner$} from "./account/selectedSigner";
import {currentNetwork$, currentProvider$} from "./providerState";
import {AvailablePool, Pool} from "../token/pool";
import {selectedSignerAddressChange$} from "./account/selectedSignerAddressUpdate";
import {dexConfig, Network} from "../network/network";
import {ReefSigner} from "../account/ReefAccount";
import {fetchPools$} from "../pools/pools";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "./model/feedbackDataModel";
import {loadSignerNfts} from "./token/nfts";
import {loadTransferHistory} from "./token/transferHistory";
import {merge} from "rxjs/operators";

const reloadingValues$ = combineLatest([currentNetwork$, selectedSignerAddressChange$]).pipe(shareReplay(1));

export const selectedSignerTokenBalances$: Observable<(FeedbackDataModel<FeedbackDataModel<Token|TokenBalance>[]>)> = combineLatest([
    apolloClientInstance$,
    selectedSignerAddressChange$,
]).pipe(
    switchMap(loadSignerTokens_fbk),
    withLatestFrom(selectedSigner$),
    map(setReefBalanceFromSigner),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError((err: any) => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);

export const selectedSignerPools$: Observable<FeedbackDataModel<Pool | null>[]> = combineLatest([
    selectedSignerTokenBalances$,
    currentNetwork$,
    selectedSignerAddressChange$,
]).pipe(
    switchMap(([tkns, network, signer]: [(FeedbackDataModel<FeedbackDataModel<Token|TokenBalance>[]>), Network, ReefSigner]) => {
        if (!signer) {
            return of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES));
        }

        return fetchPools$(tkns.data, signer.signer, dexConfig[network.name].factoryAddress);
    }),
    mergeWith(reloadingValues$.pipe(mapTo(toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    shareReplay(1),
);

// TODO pools and tokens emit events at same time - check how to make 1 event from it
export const selectedSignerTokenPrices$: Observable<FeedbackDataModel<FeedbackDataModel<TokenWithAmount>[]>> = combineLatest([
    selectedSignerTokenBalances$,
    reefPrice_fbk$,
    selectedSignerPools$,
]).pipe(
    map(toTokensWithPrice_fbk),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    startWith(toFeedbackDM([], FeedbackStatusCode.LOADING)),
    shareReplay(1)
);

export const availableReefPools$: Observable<FeedbackDataModel<AvailablePool[]>> = combineLatest([
    apolloClientInstance$,
    currentProvider$,
]).pipe(
    switchMap(loadAvailablePools),
    map(toAvailablePools),
    map(pools => toFeedbackDM(pools, FeedbackStatusCode.COMPLETE_DATA)),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    startWith(toFeedbackDM([], FeedbackStatusCode.LOADING)),
    shareReplay(1)
);


export const selectedSignerNFTs$: Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> = combineLatest([
    apolloClientInstance$,
    selectedSignerAddressChange$
])
    .pipe(
        switchMap(loadSignerNfts),
        mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
        catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
        startWith(toFeedbackDM([], FeedbackStatusCode.LOADING)),
        shareReplay(1)
    );

export const transferHistory$: Observable<null | TokenTransfer[]> = combineLatest([
    apolloClientInstance$, selectedSignerAddressChange$, currentNetwork$
]).pipe(
    switchMap(loadTransferHistory),
    mergeWith(reloadingValues$.pipe(map(() => null))),
    startWith(null),
    shareReplay(1),
);
