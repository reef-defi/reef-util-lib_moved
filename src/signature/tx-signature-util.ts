import {Provider} from "@reef-defi/evm-provider";
import {getSpecTypes} from "@polkadot/types-known";
import {Metadata, TypeRegistry} from '@polkadot/types';
import type {AnyJson} from "@polkadot/types/types";
import type {Call} from "@polkadot/types/interfaces";
import {base64Decode, base64Encode} from '@reef-defi/util-crypto';
import {BigNumber, ContractInterface, ethers} from "ethers";
import {Fragment, JsonFragment} from "@ethersproject/abi"
import {getContractTypeAbi, REEF_ADDRESS, Token} from "../token";
import {apolloClientInstance$, CONTRACT_DATA_GQL, zenToRx} from "../graphql";
import {catchError, firstValueFrom, map, mergeMap, Observable, of, take} from "rxjs";
import {CONTRACT_ABI_GQL} from "../graphql/contractData.gql";
import {ERC20} from "../token/abi/ERC20";

export interface DecodedMethodData {
    methodName: string;
    args: string[];
    info: string;
    vm: {
        evm?: {
            contractAddress: string;
            decodedData: any;
        }
    };
}

async function getContractAbi(contractAddress: string): Promise<any[]|string> {
    if (contractAddress === REEF_ADDRESS) {
        return Promise.resolve(ERC20.toString());
    }
    return firstValueFrom(apolloClientInstance$.pipe(
        mergeMap(apollo => fetchContractAbi$(apollo, contractAddress)),
        map(res => {
            if (res[0] && res[0]['REEFERC20']) {
                res = res[0]['REEFERC20'];
            }
            return res;
        }),
        take(1)
    ));
}

function fetchContractAbi$(
    apollo: any,
    contractAddress: string,
): Observable<any|null> {
    return zenToRx(apollo
        .subscribe({
            query: CONTRACT_ABI_GQL,
            variables: {address: contractAddress},
            fetchPolicy: 'network-only',
        })).pipe(
        take(1),
        map((verContracts: any) => verContracts.data.verifiedContracts.map(
            // eslint-disable-next-line camelcase
            (vContract: { id: string; compiledData: any }) => vContract.compiledData,
        )),
        catchError(err => {
            console.log('getContractAbi ERROR=', err);
            return of(null);
        })
    )
};

export async function decodePayloadMethod(provider: Provider, methodDataEncoded: string, abi?: string | readonly (string | Fragment | JsonFragment)[], sentValue: string = '0', types?: any): Promise<DecodedMethodData | null> {
    const api = provider.api;
    await api.isReady;
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

    const decodedResponse = {
        methodName, args, info, vm: {}
    };

    let isEvm = methodName.startsWith('evm.call');

    if (isEvm) {
        const contractAddress = args[0];
        let decodedData;

        if (!abi) {
            abi = await getContractAbi(contractAddress);
        }

        if (abi && !!args) {
            const methodArgs = args[1];
            const iface = new ethers.utils.Interface(abi);
            decodedData = iface.parseTransaction({data: methodArgs, value: sentValue});
        }
        decodedResponse.vm["evm"] = {
            contractAddress, decodedData
        }
    }

    return decodedResponse;
}