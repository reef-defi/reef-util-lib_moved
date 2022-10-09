import {Observable, shareReplay, switchMap, timer} from "rxjs";
import {retrieveReefCoingeckoPrice} from "./prices";

export const reefPrice$: Observable<number> = timer(0, 60000).pipe(
    switchMap(retrieveReefCoingeckoPrice),
    shareReplay(1),
);
