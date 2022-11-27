import {BigNumber} from "ethers";
import {Signer} from "@reef-defi/evm-provider";
import type { Signer as InjectedSigner } from '@polkadot/api/types';

export interface ReefAccount {
    name?: string;
    balance?: BigNumber;
    address: string;
    evmAddress?: string;
    isEvmClaimed?: boolean;
    source?: string;
    genesisHash?: string;
}

export interface ReefSigner extends ReefAccount {
    signer: Signer;
    sign: InjectedSigner;
}
