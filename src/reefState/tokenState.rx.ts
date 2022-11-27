import {
    catchError,
    combineLatest,
    from,
    map,
    mergeWith,
    Observable,
    of,
    shareReplay,
    startWith,
    switchMap,
    withLatestFrom,
} from 'rxjs';
import {loadAvailablePools, toAvailablePools} from "./token/poolUtils";
import {NFT, Token, TokenBalance, TokenTransfer, TokenWithAmount} from "../token/tokenModel";
import {reefPrice$} from "../token/reefPrice";
import {loadSignerTokens_fbk, setReefBalanceFromSigner} from "./token/selectedSignerTokenBalances";
import {apolloClientInstance$} from "../graphql";
import {currentAccount$} from "./account/currentAccount";
import {currentNetwork$, currentProvider$} from "./providerState";
import {AvailablePool, Pool} from "../token/pool";
import {currentAccountAddressChange$} from "./account/currentAccountAddressChange";
import {Network} from "../network/network";
import {ReefAccount} from "../account/accountModel";
import {fetchPools$} from "../pools/pools";
import {collectFeedbackDMStatus, FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "./model/feedbackDataModel";
import {loadSignerNfts} from "./token/nftUtils";
import {loadTransferHistory} from "./token/transferHistory";
import {getReefAccountSigner} from "../account/accountSignerUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";
import {toTokensWithPrice_fbk} from "./token/tokenUtil";
import {getReefswapNetworkConfig, REEFSWAP_CONFIG} from "../network/dex";

const reloadingValues$ = combineLatest([currentNetwork$, currentAccountAddressChange$]).pipe(shareReplay(1));

export const currentTokenBalances$: Observable<(FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]>)> = combineLatest([
    apolloClientInstance$,
    currentAccountAddressChange$,
]).pipe(
    switchMap(loadSignerTokens_fbk),
    withLatestFrom(currentAccount$),
    map(setReefBalanceFromSigner),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError((err: any) => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);

// TODO combine  currentNetwork$ and currentProvider$
export const currentPools$: Observable<FeedbackDataModel<FeedbackDataModel<Pool | null>[]>> = combineLatest([
    currentTokenBalances$,
    currentNetwork$,
    currentAccountAddressChange$,
    currentProvider$
]).pipe(
    switchMap((valArr: [(FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]>), Network, FeedbackDataModel<ReefAccount>, Provider]) => {
        var [tkns, network, signer, provider] = valArr;
        if (!signer) {
            return of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES));
        }
        return from(getReefAccountSigner(signer.data, provider)).pipe(
            switchMap((sig: Signer | undefined) => fetchPools$(tkns.data, sig as Signer, getReefswapNetworkConfig(network).factoryAddress).pipe(
                map((poolsArr: FeedbackDataModel<Pool | null>[]) => toFeedbackDM(poolsArr || [], poolsArr?.length ? collectFeedbackDMStatus(poolsArr) : FeedbackStatusCode.NOT_SET)),
            ))
        )
            ;
    }),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    shareReplay(1),
);

// TODO pools and tokens emit events at same time - check how to make 1 event from it
export const currentTokenPrices$: Observable<FeedbackDataModel<FeedbackDataModel<TokenWithAmount>[]>> = combineLatest([
    currentTokenBalances$,
    reefPrice$,
    currentPools$,
]).pipe(
    map(toTokensWithPrice_fbk),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
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

export const currentNFTs$: Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> = combineLatest([
    apolloClientInstance$,
    currentAccountAddressChange$
])
    .pipe(
        switchMap((v) => loadSignerNfts(v)),
        mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
        catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
        shareReplay(1)
    );

// TODO combine  currentNetwork$ and currentProvider$
export const currentTransactionHistory$: Observable<null | TokenTransfer[]> = combineLatest([
    apolloClientInstance$, currentAccountAddressChange$, currentNetwork$, currentProvider$
]).pipe(
    switchMap(loadTransferHistory),
    mergeWith(reloadingValues$.pipe(map(() => null))),
    shareReplay(1),
);
