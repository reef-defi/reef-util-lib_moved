import {catchError, map, mergeWith, Observable, of, shareReplay, startWith, switchMap, timer} from "rxjs";
import {getTokenPrice, PRICE_REEF_TOKEN_ID, retrieveReefCoingeckoPrice} from "./prices";
import {StatusDataObject, FeedbackStatusCode, toFeedbackDM} from "../reefState/model/statusDataObject";
import {forceReloadTokens$} from "../reefState/token/reloadTokenState";
/*
export const reefPrice$: Observable<number> = timer(0, 60000).pipe(
    switchMap(retrieveReefCoingeckoPrice),
    shareReplay(1),
);*/

export const reefPrice$: Observable<StatusDataObject<number>> = timer(0, 60000).pipe(
    mergeWith(forceReloadTokens$),
    switchMap(async ()=> {
        try {
            const price = await getTokenPrice(PRICE_REEF_TOKEN_ID);
            return toFeedbackDM(price, FeedbackStatusCode.COMPLETE_DATA);
        } catch (err: any) {
            console.log('ERROR reefPrice$0=', err.message);
            return toFeedbackDM(0, FeedbackStatusCode.ERROR, err.message);
        }
    }),
    // map((price:number)=>toFeedbackDM(price, FeedbackStatusCode.COMPLETE_DATA)),
    startWith(toFeedbackDM(0, FeedbackStatusCode.LOADING, 'Loading REEF price.')),
    catchError((err: any) => {
        console.log('ERROR reefPrice$',err.message);
        return of(toFeedbackDM(0, FeedbackStatusCode.ERROR, err.message));
    }),
    shareReplay(1),
);

// export const reefPrice$: Observable<StatusDataObject<number>> = timer(0, 60000).pipe(
//     switchMap(()=>getTokenPrice(PRICE_REEF_TOKEN_ID)),
//     map((price:number)=>toFeedbackDM(price, FeedbackStatusCode.COMPLETE_DATA)),
//     startWith(toFeedbackDM(0, FeedbackStatusCode.LOADING, 'Loading REEF price.')),
//     shareReplay(1),
// );
