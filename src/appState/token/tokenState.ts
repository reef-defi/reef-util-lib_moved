import {combineLatest, map, Observable, shareReplay,} from 'rxjs';
import {selectedSignerPools$} from "./pools";
import {TokenWithAmount} from "../../token/token";
import {toTokensWithPrice} from "../util/util";
import {reefPrice$} from "./reefPrice";
import {selectedSignerTokenBalances$} from "./selectedSignerTokenBalances";

// TODO pools and tokens emit events at same time - check how to make 1 event from it
export const selectedSignerTokenPrices$: Observable<TokenWithAmount[]> = combineLatest([
    selectedSignerTokenBalances$,
    reefPrice$,
    selectedSignerPools$,
]).pipe(map(toTokensWithPrice), shareReplay(1));
