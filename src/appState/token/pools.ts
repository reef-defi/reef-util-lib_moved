
// TODO when network changes signer changes as well? this could make 2 requests unnecessary - check
import {combineLatest, Observable, shareReplay, switchMap} from "rxjs";
import {Pool} from "../../token/pool";
import {currentNetwork$} from "../providerState";
import {Token} from "../../token/token";
import {Network} from "../../network/network";
import {ReefSigner} from "../../account/ReefAccount";
import {loadPools} from "../../pools/pools";
import {allAvailableSignerTokens$} from "./tokenState";
import {selectedSignerAddressUpdate$} from "../account/selectedSignerAddressUpdate";

export const pools$: Observable<Pool[]> = combineLatest([
    allAvailableSignerTokens$,
    currentNetwork$,
    selectedSignerAddressUpdate$,
]).pipe(
    switchMap(([tkns, network, signer]: [Token[], Network, ReefSigner]) => (signer ? loadPools(tkns, signer.signer, network.factoryAddress) : [])),
    shareReplay(1),
);
