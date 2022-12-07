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
    switchMap, tap,
    withLatestFrom,
} from 'rxjs';
import {loadAvailablePools, toAvailablePools} from "./token/poolUtils";
import {NFT, Token, TokenBalance, TokenTransfer, TokenWithAmount} from "../token/tokenModel";
import {reefPrice$} from "../token/reefPrice";
import {loadAccountTokens_fbk, setReefBalanceFromAccount} from "./token/selectedAccountTokenBalances";
import {apolloClientInstance$} from "../graphql";
import {selectedAccount$} from "./account/selectedAccount";
import {selectedNetwork$, selectedProvider$} from "./providerState";
import {AvailablePool, Pool} from "../token/pool";
import {selectedAccountAddressChange$} from "./account/selectedAccountAddressChange";
import {Network} from "../network/network";
import {ReefAccount} from "../account/accountModel";
import {fetchPools$} from "../pools/pools";
import {collectFeedbackDMStatus, FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "./model/feedbackDataModel";
import {loadSignerNfts} from "./token/nftUtils";
import {loadTransferHistory} from "./token/transferHistory";
import {getReefAccountSigner} from "../account/accountSignerUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";
import {toTokensWithPrice_fbk} from "./token/tokenUtil";
import {getReefswapNetworkConfig} from "../network/dex";

const reloadingValues$ = combineLatest([selectedNetwork$, selectedAccountAddressChange$]).pipe(shareReplay(1));

export const selectedTokenBalances$: Observable<(FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]>)> = combineLatest([
    apolloClientInstance$,
    selectedAccountAddressChange$,
]).pipe(
    switchMap(loadAccountTokens_fbk),
    withLatestFrom(selectedAccount$),
    map(setReefBalanceFromAccount),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError((err: any) => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);

// TODO combine  selectedNetwork$ and selectedProvider$
export const selectedPools$: Observable<FeedbackDataModel<FeedbackDataModel<Pool | null>[]>> = combineLatest([
    selectedTokenBalances$,
    selectedNetwork$,
    selectedAccountAddressChange$,
    selectedProvider$
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
export const selectedTokenPrices$: Observable<FeedbackDataModel<FeedbackDataModel<TokenWithAmount>[]>> = combineLatest([
    selectedTokenBalances$,
    reefPrice$,
    selectedPools$,
]).pipe(
    map(toTokensWithPrice_fbk),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1)
);

export const availableReefPools$: Observable<FeedbackDataModel<AvailablePool[]>> = combineLatest([
    apolloClientInstance$,
    selectedProvider$,
]).pipe(
    switchMap(loadAvailablePools),
    map(toAvailablePools),
    map(pools => toFeedbackDM(pools, FeedbackStatusCode.COMPLETE_DATA)),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    startWith(toFeedbackDM([], FeedbackStatusCode.LOADING)),
    shareReplay(1)
);

export const selectedNFTs$: Observable<FeedbackDataModel<FeedbackDataModel<NFT>[]>> = combineLatest([
    apolloClientInstance$,
    selectedAccountAddressChange$
])
    .pipe(
        switchMap((v) => loadSignerNfts(v)),
        mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
        catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
        shareReplay(1)
    );

// TODO combine  selectedNetwork$ and selectedProvider$
export const selectedTransactionHistory$: Observable<FeedbackDataModel<TokenTransfer[]>> = combineLatest([
    apolloClientInstance$, selectedAccountAddressChange$, selectedNetwork$, selectedProvider$
]).pipe(
    switchMap(loadTransferHistory),
    map(vArr=> toFeedbackDM(vArr, FeedbackStatusCode.COMPLETE_DATA, 'History loaded')),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);
