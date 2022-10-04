import { ContractInterface } from 'ethers';
import { Provider } from '@reef-defi/evm-provider';
import { ApolloClient } from '@apollo/client';
import {
  defer, finalize, Observable, scan, switchMap, tap,
} from 'rxjs';
import type { Signer as InjectedSigningKey } from '@polkadot/api/types';
import { AccountJson } from '@reef-defi/extension-base/background/types';
import type { InjectedAccountWithMeta as InjectedAccountWithMetaReef } from '@reef-defi/extension-inject/types';
import type {
  InjectedAccountWithMeta,
} from '@polkadot/extension-inject/types';
import {ContractType, reefTokenWithAmount, Token, TokenWithAmount} from '../../token/token';
import {
  accountsJsonSigningKeySubj, accountsJsonSubj, accountsSubj, reloadSignersSubj,
} from '../account/setAccounts';
import { UpdateAction } from '../model/updateStateModel';
import {
  availableNetworks, Network,
} from '../../network/network';
import { ERC20 } from '../../token/abi/ERC20';
import { ERC721Uri } from '../../token/abi/ERC721Uri';
import { ERC1155Uri } from '../../token/abi/ERC1155Uri';
import {disconnectProvider, initProvider} from '../../utils';
import { currentNetwork$, setCurrentNetwork, setCurrentProvider } from '../providerState';
import { apolloClientSubj, setApolloUrls } from '../../graphql';
import { ipfsUrlResolverFn } from '../../utils/nftUtil';
import {ReefSigner} from "../../account/ReefAccount";
import {Pool} from "../../token/pool";
import {calculateTokenPrice, TxStatusUpdate} from "../../utils";

type destroyConnection = ()=>void;

export let _NFT_IPFS_RESOLVER_FN: ipfsUrlResolverFn|undefined;

export const setNftIpfsResolverFn = (val?: ipfsUrlResolverFn) => {
  _NFT_IPFS_RESOLVER_FN = val;
};

export const toPlainString = (num: number): string => `${+num}`.replace(
    /(-?)(\d*)\.?(\d*)e([+-]\d+)/,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (a, b, c, d, e) => (e < 0
        ? `${b}0.${Array(1 - e - c.length).join('0')}${c}${d}`
        : b + c + d + Array(e - d.length + 1).join('0')),
);

export const sortReefTokenFirst = (tokens): Token[] => {
  const {address} = reefTokenWithAmount();
  const reefTokenIndex = tokens.findIndex((t: Token) => t.address === address);
  if (reefTokenIndex > 0) {
    return [tokens[reefTokenIndex], ...tokens.slice(0, reefTokenIndex), ...tokens.slice(reefTokenIndex + 1, tokens.length)];
  }
  return tokens;
};

export const combineTokensDistinct = ([tokens1, tokens2]: [
  Token[]|null,
  Token[]
]): Token[] => {
  if(!tokens1){
    tokens1 = [];
  }
  const combinedT = [...tokens1];
  // console.log('COMBINED=', combinedT);
  tokens2.forEach((vT: Token) => (!combinedT.some((cT) => cT.address === vT.address)
    ? combinedT.push(vT)
    : null));
  // console.log('1111COMBINED=', combinedT);
  return combinedT;
};

export const toTokensWithPrice = ([tokens, reefPrice, pools]: [
  Token[],
  number,
  Pool[]
]): TokenWithAmount[] => tokens.map(
  (token) => ({
    ...token,
    price: calculateTokenPrice(token, pools, reefPrice),
  } as TokenWithAmount),
);

export const onTxUpdateResetSigners = (
  txUpdateData: TxStatusUpdate,
  updateActions: UpdateAction[],
): void => {
  if (txUpdateData?.isInBlock || txUpdateData?.error) {
    const delay = txUpdateData.txTypeEvm ? 2000 : 0;
    setTimeout(() => reloadSignersSubj.next({ updateActions }), delay);
  }
};

export const getContractTypeAbi = (contractType: ContractType): ContractInterface => {
  switch (contractType) {
    case ContractType.ERC20:
      return ERC20;
    case ContractType.ERC721:
      return ERC721Uri;
    case ContractType.ERC1155:
      return ERC1155Uri;
    default:
      return [] as ContractInterface;
  }
};

export const getGQLUrls = (network: Network): { ws: string; http: string }|undefined => {
  if (!network.graphqlUrl) {
    return undefined;
  }
  const ws = network.graphqlUrl.startsWith('http')
    ? network.graphqlUrl.replace('http', 'ws')
    : network.graphqlUrl;
  const http = network.graphqlUrl.startsWith('ws')
    ? network.graphqlUrl.replace('ws', 'http')
    : network.graphqlUrl;
  return { ws, http };
};

export interface State {
  loading: boolean;
  signers?: ReefSigner[];
  provider?: Provider;
  network?: Network;
  error?: any; // TODO!
}

export interface StateOptions {
  network?: Network;
  signers?: ReefSigner[];
  client?: ApolloClient<any>;
  jsonAccounts?:{accounts: AccountJson[] | InjectedAccountWithMeta[] | InjectedAccountWithMetaReef[], injectedSigner: InjectedSigningKey}
  ipfsHashResolverFn?: ipfsUrlResolverFn;
}

export function initApolloClient(selectedNetwork?: Network, client?: ApolloClient<any>) {
  if (selectedNetwork) {
    if (!client) {
      const gqlUrls = getGQLUrls(selectedNetwork);
      if (gqlUrls) {
        setApolloUrls(gqlUrls);
      }
    } else {
      apolloClientSubj.next(client);
    }
  }
}

export const initReefState = (
  {
    network,
    client,
    signers,
    jsonAccounts,
    ipfsHashResolverFn,
  }: StateOptions,
): destroyConnection => {
  const subscription = currentNetwork$.pipe(
    switchMap((network) => initProvider(network.rpcUrl)
      .then((provider) => ({
        provider,
        network,
      }))),
    scan((state: { provider: Provider|undefined }, newVal: { provider: Provider, network }) => {
      if (state.provider) {
        disconnectProvider(state.provider);
      }
      return { provider: newVal.provider, network: newVal.network };
    }, {provider: undefined}),
    tap((p_n: { provider: Provider, network: Network }) => {
      setCurrentProvider(p_n.provider);
    }),
    tap((p_n) => {
      initApolloClient(p_n.network, client);
    }),
    finalizeWithValue(((p_n) => disconnectProvider(p_n.provider))),
  )
    .subscribe({
      error: (e) => {
        console.log('initReefState ERR=', e);
      },
    });
  setCurrentNetwork(network || availableNetworks.mainnet);
  setNftIpfsResolverFn(ipfsHashResolverFn);
  if (signers) {
    accountsSubj.next(signers || null);
  }
  if (jsonAccounts) {
    accountsJsonSigningKeySubj.next(jsonAccounts.injectedSigner);
    accountsJsonSubj.next(jsonAccounts.accounts);
  }
  return () => subscription.unsubscribe();
};

function finalizeWithValue<T>(callback: (value: T) => void) {
  return (source: Observable<T>) => defer(() => {
    let lastValue: T;
    return source.pipe(
      tap((value) => lastValue = value),
      finalize(() => callback(lastValue)),
    );
  });
}
