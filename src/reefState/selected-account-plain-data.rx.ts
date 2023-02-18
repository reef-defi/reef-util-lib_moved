import {distinctUntilChanged, map, Observable, of, shareReplay} from "rxjs";
import {NFT, Token, TokenBalance, TokenWithAmount} from "../token";
import {selectedNFTs_status$, selectedTokenBalances_status$, selectedTokenPrices_status$} from "./tokenState.rx";
import {ReefAccount} from "../account";
import {accounts_status$} from "./account/accounts";
import {StatusDataObject, FeedbackStatusCode, findMinStatusCode} from "./model/statusDataObject";
import {selectedAccount_status$} from "./account/selectedAccount";

// undefined when loading, null if error
export const accounts$: Observable<ReefAccount[]|null|undefined> = unwrapSDOArray(accounts_status$);
export const selectedAccount$: Observable<ReefAccount|undefined|null> = unwrapSDO(selectedAccount_status$);
export const selectedTokenBalances$: Observable<(Token|TokenBalance)[]|null|undefined> = unwrapSDOArray(selectedTokenBalances_status$);
export const selectedNFTs$: Observable<NFT[]|null|undefined> = unwrapSDOArray(selectedNFTs_status$);
export const selectedTokenPrices$: Observable<TokenWithAmount[]|null|undefined> = unwrapSDOArray(selectedTokenPrices_status$);

function unwrapSDO <T>(sdoObservable: Observable< StatusDataObject<T>|undefined>): Observable<T|null|undefined>{
    return sdoObservable.pipe(
        map(res=> {
            if (!res) {
                return undefined;
            }
            if (res.hasStatus(FeedbackStatusCode.COMPLETE_DATA)) {
                return res.data;
            }
            if(findMinStatusCode([res]) < FeedbackStatusCode.MISSING_INPUT_VALUES){
                return undefined;
            }
            return null;
        }),
        distinctUntilChanged(),
        shareReplay(1)
    );
}

function unwrapSDOArray <T>(sdoObservable: Observable< (StatusDataObject<StatusDataObject<T>[]>) >): Observable<T[]|null|undefined>{
    return sdoObservable.pipe(
        map(res=> {
            if (res.hasStatus(FeedbackStatusCode.COMPLETE_DATA)) {
                return res.data.map(a => a.data);
            }
            if(findMinStatusCode(res.data) < FeedbackStatusCode.MISSING_INPUT_VALUES){
                return undefined;
            }
            return null;
        }),
        distinctUntilChanged(),
        shareReplay(1)
    );
}
