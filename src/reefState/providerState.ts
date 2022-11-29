import {ReplaySubject, shareReplay, startWith} from 'rxjs';
import {Provider} from '@reef-defi/evm-provider';
import {Network} from "../network/network";

const providerSubj: ReplaySubject<Provider> = new ReplaySubject<Provider>(1);
const selectedNetworkSubj: ReplaySubject<Network> = new ReplaySubject<Network>(1);

export const ACTIVE_NETWORK_LS_KEY = 'reef-app-active-network';
export const selectedProvider$ = providerSubj.asObservable().pipe(shareReplay(1));
export const instantProvider$ = selectedProvider$.pipe(startWith(undefined), shareReplay(1));
export const setSelectedProvider = (provider: Provider): void => providerSubj.next(provider);

export const selectedNetwork$ = selectedNetworkSubj.asObservable();
export const setSelectedNetwork = (network: Network): void => {
  if (network != null) {
    try {
      localStorage.setItem(ACTIVE_NETWORK_LS_KEY, JSON.stringify(network));
    } catch (e) {
      // when cookies disabled localStorage can throw
    }
  }
  selectedNetworkSubj.next(network);
};
selectedNetwork$.subscribe((network) => console.log('SELECTED NETWORK=', network.rpcUrl));
