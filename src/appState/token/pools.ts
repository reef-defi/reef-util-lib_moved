// TODO when network changes signer changes as well? this could make 2 requests unnecessary - check
import {combineLatest, Observable, shareReplay, switchMap} from "rxjs";
import {Pool} from "../../token/pool";
import {currentNetwork$} from "../providerState";
import {Token} from "../../token/token";
import {dexConfig, Network} from "../../network/network";
import {ReefSigner} from "../../account/ReefAccount";
import {loadPools} from "../../pools/pools";
import {selectedSignerAddressUpdate$} from "../account/selectedSignerAddressUpdate";
import {allAvailableSignerTokens$} from "./allAvailableSignerTokens";
import {selectedSignerTokenBalances$} from "./selectedSignerTokenBalances";

export const selectedSignerPools$: Observable<Pool[]> = combineLatest([
    selectedSignerTokenBalances$,
    currentNetwork$,
    selectedSignerAddressUpdate$,
]).pipe(
    switchMap(([tkns, network, signer]: [Token[]|null, Network, ReefSigner]) => (signer && tkns?.length ? loadPools(tkns as Token[], signer.signer, dexConfig[network.name].factoryAddress) : [])),
    shareReplay(1),
);

export const allPools$: Observable<Pool[]> = combineLatest([
    allAvailableSignerTokens$,
    currentNetwork$,
    selectedSignerAddressUpdate$,
]).pipe(
    switchMap(([tkns, network, signer]: [Token[]|null, Network, ReefSigner]) => (signer && tkns?.length ? loadPools(tkns as Token[], signer.signer, dexConfig[network.name].factoryAddress) : [])),
    shareReplay(1),
);
