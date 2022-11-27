import {
    catchError,
    combineLatest, finalize, from,
    map,
    mergeWith,
    Observable,
    of,
    shareReplay,
    startWith,
    switchMap, tap,
    withLatestFrom,
} from 'rxjs';
import {loadAvailablePools, toAvailablePools} from "./token/poolUtils";
import {NFT, Token, TokenBalance, TokenTransfer, TokenWithAmount} from "../token/tokenModel";
import {toTokensWithPrice_fbk} from "./util/util";
import {reefPrice_fbk$} from "../token/reefPrice.rx";
import {loadSignerTokens_fbk, setReefBalanceFromSigner} from "./token/selectedSignerTokenBalances";
import {apolloClientInstance$} from "../graphql";
import {selectedAccount$} from "./account/selectedAccount";
import {currentNetwork$, currentProvider$} from "./providerState";
import {AvailablePool, Pool} from "../token/pool";
import {selectedAccountAddressChange$} from "./account/selectedAccountAddressChange";
import {dexConfig, Network} from "../network/network";
import {ReefAccount, ReefSigner} from "../account/accountModel";
import {fetchPools$} from "../pools/pools";
import {collectFeedbackDMStatus, FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "./model/feedbackDataModel";
import {loadSignerNfts} from "./token/nftUtils";
import {loadTransferHistory} from "./token/transferHistory";
import {getReefAccountSigner} from "../account/accountUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";

const reloadingValues$ = combineLatest([currentNetwork$, selectedAccountAddressChange$]).pipe(shareReplay(1));

export const selectedSignerTokenBalances$: Observable<(FeedbackDataModel<FeedbackDataModel<Token|TokenBalance>[]>)> = combineLatest([
    apolloClientInstance$,
    selectedAccountAddressChange$,
]).pipe(
    switchMap(loadSignerTokens_fbk),
    withLatestFrom(selectedAccount$),
    map(setReefBalanceFromSigner),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError((err: any) => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);

// TODO combine  currentNetwork$ and currentProvider$
export const selectedSignerPools$: Observable<FeedbackDataModel<FeedbackDataModel<Pool | null>[]>> = combineLatest([
    selectedSignerTokenBalances$,
    currentNetwork$,
    selectedAccountAddressChange$,
    currentProvider$
]).pipe(
    switchMap((valArr: [(FeedbackDataModel<FeedbackDataModel<Token|TokenBalance>[]>), Network, FeedbackDataModel<ReefAccount>, Provider]) => {
        var [tkns, network, signer, provider] = valArr;
        if (!signer) {
            return of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES));
        }
        return from(getReefAccountSigner(signer.data, provider)).pipe(
            switchMap((sig: Signer|undefined)=>fetchPools$(tkns.data, sig as Signer, dexConfig[network.name].factoryAddress).pipe(
                map((poolsArr: FeedbackDataModel<Pool|null>[])=>toFeedbackDM(poolsArr||[], poolsArr?.length?collectFeedbackDMStatus(poolsArr):FeedbackStatusCode.NOT_SET)),
            ))
        )
        ;
    }),
    mergeWith(reloadingValues$.pipe(map(()=>toFeedbackDM([], FeedbackStatusCode.LOADING)))),
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
    selectedAccountAddressChange$
])
    .pipe(
        switchMap((v)=>loadSignerNfts(v)),
        mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
        catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
        shareReplay(1)
    );

// TODO combine  currentNetwork$ and currentProvider$
export const transferHistory$: Observable<null | TokenTransfer[]> = combineLatest([
    apolloClientInstance$, selectedAccountAddressChange$, currentNetwork$, currentProvider$
]).pipe(
    switchMap(loadTransferHistory),
    mergeWith(reloadingValues$.pipe(map(() => null))),
    shareReplay(1),
);
