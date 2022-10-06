
// TODO when network changes signer changes as well? this could make 2 requests unnecessary - check
import {combineLatest, Observable, shareReplay, switchMap} from "rxjs";
import {Pool} from "../../token/pool";
import {currentNetwork$} from "../providerState";
import {Token} from "../../token/token";
import {dexConfig, Network} from "../../network/network";
import {ReefSigner} from "../../account/ReefAccount";
import {loadPools} from "../../pools/pools";
import {allAvailableSignerTokens$} from "./tokenState";
import {selectedSignerAddressUpdate$} from "../account/selectedSignerAddressUpdate";

export const pools$: Observable<Pool[]> = combineLatest([
    allAvailableSignerTokens$,
    currentNetwork$,
    selectedSignerAddressUpdate$,
]).pipe(
    switchMap(([tkns, network, signer]: [Token[]|null, Network, ReefSigner]) => (signer && tkns?.length ? loadPools(tkns as Token[], signer.signer, dexConfig[network.name].factoryAddress) : [])),
    shareReplay(1),
);
