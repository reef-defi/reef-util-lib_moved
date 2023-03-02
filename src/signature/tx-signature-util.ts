import {Provider} from "@reef-defi/evm-provider";
import {getSpecTypes} from "@polkadot/types-known";
import {Metadata, TypeRegistry} from '@polkadot/types';
import type {AnyJson} from "@polkadot/types/types";
import type {Call} from "@polkadot/types/interfaces";
import {base64Decode, base64Encode} from '@reef-defi/util-crypto';
import {ethers} from "ethers";
import {Fragment, JsonFragment} from "@ethersproject/abi"

export interface DecodedMethodData {
    methodName: string;
    args: string[];
    info: string;
    evm: {
        contractAddress: string|null;
        decodedData: any|null;
    };
}

export function decodePayloadMethod(provider: Provider, methodDataEncoded: string, abi?: string | readonly (string | Fragment | JsonFragment)[], sentValue: string = '0', types?: any): DecodedMethodData | null {
    const api = provider.api;

    if (!types) {
        types = getSpecTypes(api.registry, api.runtimeChain.toString(), api.runtimeVersion.specName, api.runtimeVersion.specVersion) as unknown as Record<string, string>;
    }

    let args: any | null = null;
    let method: Call | null = null;

    try {
        const registry = new TypeRegistry();
        registry.register(types);
        // @ts-ignore
        registry.setChainProperties(registry.createType('ChainProperties', {
            ss58Format: 42,
            tokenDecimals: 18,
            tokenSymbol: "REEF",
        }));
        const metaCalls = base64Encode(api.runtimeMetadata.asCallsOnly.toU8a());
        // @ts-ignore
        const metadata = new Metadata(registry, base64Decode(metaCalls || ''));
        registry.setMetadata(metadata, undefined, undefined);

        method = registry.createType("Call", methodDataEncoded);
        args = (method.toHuman() as { args: AnyJson }).args;
    } catch (error) {
        console.log('decodeMethod: ERROR decoding method');
        return null;
    }

    const info = method?.meta ? method.meta.docs.map((d) => d.toString().trim()).join(' ') : '';
    const methodParams = method?.meta ? `(${method.meta.args.map(({name}) => name).join(', ')})` : '';
    const methodName = method ? `${method.section}.${method.method}${methodParams}` : '';
    let contractAddress = null;
    let decodedData:any = null;

    if(methodName.startsWith('evm.call') && abi && !!args) {
        contractAddress = args[0];
        const methodArgs = args[1];
        const iface = new ethers.utils.Interface(abi);
        decodedData = iface.parseTransaction({data: methodArgs, value: sentValue});
    }

    return {
        methodName, args, info,
        evm: {
            contractAddress, decodedData
        }
    };
}