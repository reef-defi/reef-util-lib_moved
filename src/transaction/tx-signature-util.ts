import {Provider} from "@reef-defi/evm-provider";
import {getSpecTypes} from "@polkadot/types-known";
import {Metadata, TypeRegistry} from '@polkadot/types';
import type {AnyJson} from "@polkadot/types/types";
import type {Call} from "@polkadot/types/interfaces";
import {getSpecTypes} from "@polkadot/types-known";
import {base64Decode, base64Encode} from '@reef-defi/util-crypto';
import {isAscii, u8aToString, u8aUnwrapBytes} from '@reef-defi/util';

export async function decodePayloadMethod (provider: Provider, data: string, types?: any)  {
    const api = provider.api;
    await api.isReady;

    if (!types) {
        types = getSpecTypes(api.registry, api.runtimeChain.toString(), api.runtimeVersion.specName, api.runtimeVersion.specVersion ) as unknown as Record<string, string>;
    }

    let args: AnyJson | null = null;
    let method: Call | null = null;

    try {
        const registry = new TypeRegistry();
        registry.register(types);
        registry.setChainProperties(registry.createType('ChainProperties', {
            ss58Format: 42,
            tokenDecimals: 18,
            tokenSymbol: "REEF",
        }));
        const metaCalls = base64Encode(api.runtimeMetadata.asCallsOnly.toU8a());
        // @ts-ignore
        const metadata = new Metadata(registry, base64Decode(metaCalls || ''));
        registry.setMetadata(metadata, undefined, undefined);

        method = registry.createType("Call", data);
        args = (method.toHuman() as { args: AnyJson }).args;
    } catch (error) {
        console.log('utils.decodeMethod: ERROR decoding method');
        args = null;
        method = null;
    }

    const info = method?.meta ? method.meta.docs.map((d) => d.toString().trim()).join(' ') : '';
    const methodParams = method?.meta ? `(${method.meta.args.map(({ name }) => name).join(', ')})` : '';
    const methodName = method ? `${method.section}.${method.method}${methodParams}` : '';

    return { methodName, args, info };
}