import {Provider, Signer} from '@reef-defi/evm-provider';
import type {Signer as InjectedSigner, } from '@polkadot/api/types';
import {web3FromSource} from '@reef-defi/extension-dapp';
import {ReefAccount} from "./accountModel";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {accountsJsonSigningKeySubj} from "../reefState/account/setAccounts";
import {SignerPayloadJSON, SignerPayloadRaw, SignerResult} from "@polkadot/types/types/extrinsic";
import { Deferrable } from '@ethersproject/properties';
import {
  TransactionRequest,
  TransactionResponse
} from '@ethersproject/abstract-provider';

const accountSourceSigners = new Map<string, InjectedSigner>();
const addressSigners = new Map<string, Signer|undefined>();

const getAccountInjectedSigner = async (
    source: string = REEF_EXTENSION_IDENT,
): Promise<InjectedSigner|undefined> => {
  if (!accountSourceSigners.has(source)) {
    const signer = await web3FromSource(source)
        .then((injected) => injected?.signer)
        .catch((err) => console.error('getAccountSigner error =', err));
    if (!signer) {
      console.warn('Can not get signer for source=' + source);
    }
    if (signer) {
      accountSourceSigners.set(source, signer);
    }
  }
  return accountSourceSigners.get(source)!;
};

export const getReefAccountSigner = async ({address, source}: ReefAccount, provider: Provider)=>{
  const src = accountsJsonSigningKeySubj.getValue()||source;
  return getAccountSigner(address, provider, src);
}

export const getAccountSigner = async (
    address: string,
    provider: Provider,
    // source?: string,
    injSignerOrSource?: InjectedSigner|string,
): Promise<Signer | undefined> => {
  let signingKey: InjectedSigner|undefined = injSignerOrSource as InjectedSigner;
  if (!injSignerOrSource || typeof injSignerOrSource === 'string') {
    signingKey =  await getAccountInjectedSigner(injSignerOrSource);
  }

  if (!addressSigners.has(address)) {
    addressSigners.set(address, (signingKey ? (new ReefSignerWrapper(provider, address, new ReefSigningKeyWrapper(signingKey))) : undefined));
  }
  return addressSigners.get(address);
};

export class ReefSigningKeyWrapper implements InjectedSigner {
  private sigKey: InjectedSigner|undefined;
  constructor(signingKey?: InjectedSigner) {
    this.sigKey=signingKey;
  }

  signPayload (payload: SignerPayloadJSON) {
    console.log('SIG PAYLOAD=',payload.method)

    return this.sigKey?.signPayload?this.sigKey.signPayload(payload).then(res=>{
      // console.log('SIGG DONE')
      return res;
    }, rej=>{
      // console.log('SIGG REJJJJ')
      throw rej;
    }):Promise.reject('ReefSigningKeyWrapper - not implemented');
  };

  signRaw (raw: SignerPayloadRaw){
    return this.sigKey?.signRaw?this.sigKey.signRaw(raw):Promise.reject('ReefSigningKeyWrapper - not implemented');
  };

}

export class ReefSignerWrapper extends Signer {
  constructor(provider: Provider, address: string, signingKey: InjectedSigner) {
    super(provider, address, signingKey);
  }

  sendTransaction(_transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
    console.log('TRXXXXX= ', _transaction)
    return super.sendTransaction(_transaction);
  }
}

/*export const getReefCoinBalance = async (
    address: string,
    provider: Provider,
): Promise<BigNumber> => {
  const balance = await provider.api.derive.balances
      .all(address as any)
      .then((res: DeriveBalancesAccountData) => BigNumber.from(res.freeBalance.toString(10)));
  return balance;
};*/

/*interface SignerInfo {
  name: string;
  source: string;
  address: string;
  genesisHash: string;
}

const signerToReefSigner = async (
    signer: Signer,
    provider: Provider,
    {
      address, name, source, genesisHash,
    }: SignerInfo,
): Promise<ReefSigner> => {
  const evmAddress = await signer.getAddress();
  const isEvmClaimed = await signer.isClaimed();
  let inj;
  try {
    inj = await web3FromAddress(address);
  } catch (e) {
    // when web3Enable() is not called before
  }
  const balance = await getReefCoinBalance(address, provider);
  inj?.signer;
  return {
    signer,
    balance,
    evmAddress,
    isEvmClaimed,
    name,
    address,
    source,
    genesisHash: genesisHash!,
    sign: inj?.signer,
  };
};*/

/*export const metaAccountToSigner = async (
    account: InjectedAccountWithMeta | InjectedAccountWithMetaReef,
    provider: Provider,
    injSigner: InjectedSigner,
): Promise<ReefSigner | undefined> => {
  const { source } = account.meta;
  const signer = await getAccountSigner(
      account.address,
      provider,
      source,
      injSigner,
  );
  if (!signer) {
    return undefined;
  }
  return signerToReefSigner(
      signer,
      provider,
      {
        source,
        address: account.address,
        name: account.meta.name || '',
        genesisHash: account.meta.genesisHash || '',
      },
  );
};*/

/*export const metaAccountsToSigners = async (
    accounts: (InjectedAccountWithMeta | InjectedAccountWithMetaReef)[],
    provider: Provider,
    sign: InjectedSigner,
): Promise<ReefSigner[]> => {
  const signers = await Promise.all(
      accounts
          .filter((account) => provider.api.genesisHash.toString() === account.meta.genesisHash)
          .map((account) => metaAccountToSigner(account, provider, sign)),
  );

  return signers.filter(removeUndefinedItem) as ReefSigner[];
};*/

/*export const accountToSigner = async (
    account: InjectedAccount,
    provider: Provider,
    sign: InjectedSigner,
    source: string,
): Promise<ReefSigner> => {
  const signer = new Signer(provider, account.address, sign);
  return signerToReefSigner(
      signer,
      provider,
      {
        source,
        address: account.address,
        name: account.name || '',
        genesisHash: account.genesisHash || '',
      },
  );
};*/

/*export function accountJsonToMeta(acc: AccountJson, source: string): InjectedAccountWithMeta {
  return {
    address: acc.address,
    meta: {
      genesisHash: acc.genesisHash,
      name: acc.name,
      source,
    },
    type: acc.type,
  };
}*/

/*export const getExtensionSigners = async (
    extensions: InjectedExtension[] | InjectedExtensionReef[],
    provider: Provider,
): Promise<ReefSigner[]> => {
  const extensionAccounts = await Promise.all(
      extensions.map(async (extension) => ({
        name: extension.name,
        sig: extension.signer,
        accounts: await extension.accounts.get(),
      })),
  );
  const accountPromisses = extensionAccounts.flatMap(
      ({ accounts, name, sig }) => accounts.map((account) => accountToSigner(account, provider, sig, name)),
  );
  const accounts = await Promise.all(accountPromisses);
  return accounts as ReefSigner[];
};*/

/*export const bindSigner = async (signer: Signer): Promise<void> => {
  const hasEvmAddress = await signer.isClaimed();
  ensure(!hasEvmAddress, 'Account already has EVM address!');
  await signer.claimDefaultAccount();
};*/

// export const getSignerIdent = (signer: ReefSigner): string => `${signer.source}_${signer.address}`;
