import { Provider } from '@reef-defi/evm-provider';
import { WsProvider } from '@polkadot/api';
import {Subject} from "rxjs";

let connection:{status: boolean|'connecting', rpc: string, provider?: Provider} = { status: false, rpc: '', provider: undefined}
export async function initProvider(providerUrl: string) {
  if(connection.rpc===providerUrl && connection.status===true){
    return connection.provider;
  }
  connection = {status:"connecting", rpc: providerUrl };
  const newProvider = new Provider({
    provider: new WsProvider(providerUrl),
  });
  try {
    await newProvider.api.isReadyOrError;
  } catch (e) {
    connection.status = false;
    console.log('Provider isReadyOrError ERROR=', e);
    throw e;
  }
  connection.status = true;
  connection.provider = newProvider;
  return newProvider;
}

export async function disconnectProvider(provider: Provider) {
  await provider.api.disconnect();
}
