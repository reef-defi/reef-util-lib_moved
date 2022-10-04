import {combineLatest, map, Observable, shareReplay,} from 'rxjs';
import {toTokensWithPrice} from '../util/util';
import {Token, TokenWithAmount,} from '../../token/token';
import {pools$} from "./pools";
import {reefPrice$} from "./reefPrice";
import {selectedSignerTokenBalances$} from "./selectedSignerTokenBalances";

export const allAvailableSignerTokens$: Observable<Token[]|null> = selectedSignerTokenBalances$;

// TODO pools and tokens emit events at same time - check how to make 1 event from it
export const tokenPrices$: Observable<TokenWithAmount[]> = combineLatest([
    allAvailableSignerTokens$,
    reefPrice$,
    pools$,
]).pipe(map(toTokensWithPrice), shareReplay(1));
