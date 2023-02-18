import {map, Observable, shareReplay, startWith, switchMap, timer} from "rxjs";
import {getTokenPrice, PRICE_REEF_TOKEN_ID, retrieveReefCoingeckoPrice} from "./prices";
import {StatusDataObject, FeedbackStatusCode, toFeedbackDM} from "../reefState/model/statusDataObject";
/*
export const reefPrice$: Observable<number> = timer(0, 60000).pipe(
    switchMap(retrieveReefCoingeckoPrice),
    shareReplay(1),
);*/

export const reefPrice$: Observable<StatusDataObject<number>> = timer(0, 60000).pipe(
    switchMap(()=>getTokenPrice(PRICE_REEF_TOKEN_ID)),
    map((price:number)=>toFeedbackDM(price, FeedbackStatusCode.COMPLETE_DATA)),
    startWith(toFeedbackDM(0, FeedbackStatusCode.LOADING, 'Loading REEF price.')),
    shareReplay(1),
);
