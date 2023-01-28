import {distinctUntilChanged, map, Observable, shareReplay} from "rxjs";
import {NFT, Token, TokenBalance, TokenWithAmount} from "../token";
import {selectedNFTs_status$, selectedTokenBalances_status$, selectedTokenPrices_status$} from "./tokenState.rx";
import {ReefAccount} from "../account";
import {accounts_status$} from "./account/accounts";
import {FeedbackDataModel, FeedbackStatusCode, findMinStatusCode} from "./model/feedbackDataModel";

// undefined when loading, null if error
export const accounts$: Observable<ReefAccount[]|null|undefined> = unwrapFDM(accounts_status$);
export const selectedTokenBalances$: Observable<(Token|TokenBalance)[]|null|undefined> = unwrapFDM(selectedTokenBalances_status$);
export const selectedNFTs$: Observable<NFT[]|null|undefined> = unwrapFDM(selectedNFTs_status$);
export const selectedTokenPrices$: Observable<TokenWithAmount[]|null|undefined> = unwrapFDM(selectedTokenPrices_status$);

function unwrapFDM <T>(fdmObservable: Observable<FeedbackDataModel<FeedbackDataModel<T>[]>>): Observable<T[]|null|undefined>{
    return fdmObservable.pipe(
        map(res=> {
            if (res.hasStatus(FeedbackStatusCode.COMPLETE_DATA)) {
                return res.data.map(a => a.data);
            }
            if(findMinStatusCode(res.data)<FeedbackStatusCode.MISSING_INPUT_VALUES){
                return undefined;
            }
            return null;
        }),
        distinctUntilChanged(),
        shareReplay(1)
    );
}
