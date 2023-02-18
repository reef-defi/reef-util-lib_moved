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
import {
    loadAccountTokens_sdo,
    replaceReefBalanceFromAccount,
    setReefBalanceFromAccount
} from "./token/selectedAccountTokenBalances";
import {apolloClientInstance$} from "../graphql";
import {selectedAccount_status$} from "./account/selectedAccount";
import {selectedNetwork$, selectedProvider$} from "./providerState";
import {AvailablePool, Pool} from "../token/pool";
import {selectedAccountAddressChange$} from "./account/selectedAccountAddressChange";
import {Network} from "../network/network";
import {ReefAccount} from "../account/accountModel";
import {fetchPools$} from "../pools/pools";
import {collectFeedbackDMStatus, StatusDataObject, FeedbackStatusCode, toFeedbackDM} from "./model/statusDataObject";
import {loadSignerNfts} from "./token/nftUtils";
import {loadTransferHistory} from "./token/transferHistory";
import {getReefAccountSigner} from "../account/accountSignerUtils";
import {Provider, Signer} from "@reef-defi/evm-provider";
import {toTokensWithPrice_sdo} from "./token/tokenUtil";
import {getReefswapNetworkConfig} from "../network/dex";
import {filter} from "rxjs/operators";
import {BigNumber} from "ethers";

const reloadingValues$ = combineLatest([selectedNetwork$, selectedAccountAddressChange$]).pipe(shareReplay(1));

const selectedAccountReefBalance$ = selectedAccount_status$.pipe(
    map(acc => {
        return acc?.data.balance;
    }),
    filter(bal => !!bal && bal.gt(BigNumber.from('0'))),
    startWith(undefined),
    shareReplay(1)
);

export const selectedTokenBalances_status$: Observable<(StatusDataObject<StatusDataObject<Token | TokenBalance>[]>)> = combineLatest([
    apolloClientInstance$,
    selectedAccountAddressChange$
]).pipe(
    switchMap(loadAccountTokens_sdo),
    // withLatestFrom(selectedAccount_status$),
    // map(setReefBalanceFromAccount),
    switchMap((tkns:StatusDataObject<StatusDataObject<Token | TokenBalance>[]>)=>{
        return combineLatest([ of(tkns), selectedAccountReefBalance$]).pipe(
            map((arrVal)=>replaceReefBalanceFromAccount(arrVal[0], arrVal[1])),
        );
    }),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError((err: any) => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);

// TODO combine  selectedNetwork$ and selectedProvider$
export const selectedPools_status$: Observable<StatusDataObject<StatusDataObject<Pool | null>[]>> = combineLatest([
    selectedTokenBalances_status$,
    selectedNetwork$,
    selectedAccountAddressChange$,
    selectedProvider$
]).pipe(
    switchMap((valArr: [(StatusDataObject<StatusDataObject<Token | TokenBalance>[]>), Network, StatusDataObject<ReefAccount>, Provider]) => {
        var [tkns, network, signer, provider] = valArr;
        if (!signer) {
            return of(toFeedbackDM([], FeedbackStatusCode.MISSING_INPUT_VALUES));
        }
        return from(getReefAccountSigner(signer.data, provider)).pipe(
            switchMap((sig: Signer | undefined) => fetchPools$(tkns.data, sig as Signer, getReefswapNetworkConfig(network).factoryAddress).pipe(
                map((poolsArr: StatusDataObject<Pool | null>[]) => toFeedbackDM(poolsArr || [], poolsArr?.length ? collectFeedbackDMStatus(poolsArr) : FeedbackStatusCode.NOT_SET)),
            ))
        )
            ;
    }),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    shareReplay(1),
);

// TODO pools and tokens emit events at same time - check how to make 1 event from it
export const selectedTokenPrices_status$: Observable<StatusDataObject<StatusDataObject<TokenWithAmount>[]>> = combineLatest([
    selectedTokenBalances_status$,
    reefPrice$,
    selectedPools_status$,
]).pipe(
    map(toTokensWithPrice_sdo),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1)
);

export const availableReefPools_status$: Observable<StatusDataObject<AvailablePool[]>> = combineLatest([
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

export const selectedNFTs_status$: Observable<StatusDataObject<StatusDataObject<NFT>[]>> = combineLatest([
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
export const selectedTransactionHistory_status$: Observable<StatusDataObject<TokenTransfer[]>> = combineLatest([
    apolloClientInstance$, selectedAccountAddressChange$, selectedNetwork$, selectedProvider$
]).pipe(
    switchMap(loadTransferHistory),
    map(vArr=> toFeedbackDM(vArr, FeedbackStatusCode.COMPLETE_DATA, 'History loaded')),
    mergeWith(reloadingValues$.pipe(map(() => toFeedbackDM([], FeedbackStatusCode.LOADING)))),
    catchError(err => of(toFeedbackDM([], FeedbackStatusCode.ERROR, err.message))),
    shareReplay(1),
);
