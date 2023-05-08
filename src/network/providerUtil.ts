import { Provider } from '@reef-defi/evm-provider';
import { WsProvider } from '@polkadot/api';
import {Subject} from "rxjs";

export async function initProvider(providerUrl: string, providerConnStateSubj?: Subject<any>) {
  const newProvider = new Provider({
    provider: new WsProvider(providerUrl),
  });
  try {
    newProvider.api.on("connected", (v)=>providerConnStateSubj?.next({value:'connected', timestamp: (new Date()).getTime(), data:v}))
    newProvider.api.on("error", (v)=>providerConnStateSubj?.next({value:'error', timestamp: (new Date()).getTime(), data:v}))
    newProvider.api.on("disconnected", (v)=>providerConnStateSubj?.next({value:'disconnected', timestamp: (new Date()).getTime(), data:v}))
    newProvider.api.on("ready", (v)=>providerConnStateSubj?.next({value:'ready', timestamp: (new Date()).getTime(), data:v}))
    await newProvider.api.isReadyOrError;
  } catch (e) {
    console.log('Provider isReadyOrError ERROR=', e);
    throw e;
  }
  return newProvider;
}

export async function disconnectProvider(provider: Provider) {
  try {
    await provider.api.isReadyOrError;
    await provider.api.disconnect();
  }catch (e:any) {
    console.log('Provider disconnect err=', e.message);
  }
}
