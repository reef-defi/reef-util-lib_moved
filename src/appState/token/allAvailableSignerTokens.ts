import {selectedSignerTokenBalances$} from "./selectedSignerTokenBalances";
import {Token} from "../../token/token";
import {Observable} from "rxjs";

//TODO add tokens that have pools
export const allAvailableSignerTokens$: Observable<Token[]|null> = selectedSignerTokenBalances$;
