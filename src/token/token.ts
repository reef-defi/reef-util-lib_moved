import {BigNumber, ContractInterface} from 'ethers';
import {BigNumber as BN} from 'bignumber.js';
import {EMPTY_ADDRESS, REEF_ADDRESS,} from '../utils/utils';
import {ERC20} from "./abi/ERC20";
import {ERC721Uri} from "./abi/ERC721Uri";
import {ERC1155Uri} from "./abi/ERC1155Uri";
import {FeedbackDataModel} from "../appState/model/feedbackDataModel";

export enum ContractType {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  other = 'other'
}

export interface ERC20ContractData {
  name: string;
  symbol: string;
  decimals: number;
}

export interface BasicToken {
  name: string;
  address: string;
  iconUrl: string;
}

export interface Token extends BasicToken {
  symbol: string;
  balance: BigNumber;
  decimals: number;
}

export interface TokenWithAmount extends Token {
  amount: string;
  price: number;
  isEmpty: boolean;
}

export interface TokenState {
  index: number;
  amount: string;
  price: number;
}

export interface ERC721ContractData {
  type: ContractType.ERC721
  name: string;
  symbol: string;
}

export interface ERC1155ContractData {
  type: ContractType.ERC1155
}

export interface NFT extends Token {
  nftId: string;
  data: ERC1155ContractData | ERC721ContractData;
  contractType: ContractType;
  mimetype?: string;
}

export type TokenPrices = {[tokenAddress: string]: number};

export interface NFTMetadata{
  image?: string;
  iconUrl?:string;
  name?: string;
  mimetype?: string;
}

export interface TransferExtrinsic { blockId: string; index: number; hash: string; }

export interface TokenTransfer {
  from: string;
  to: string;
  inbound: boolean;
  timestamp: number;
  token: Token|NFT;
  extrinsic: TransferExtrinsic;
  url: string;
}

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

export const defaultTokenState = (index = 0): TokenState => ({
  index,
  amount: '',
  price: 0,
});

export const createEmptyToken = (): Token => ({
  name: 'Select token',
  address: EMPTY_ADDRESS,
  balance: BigNumber.from('0'),
  decimals: -1,
  iconUrl: '',
  symbol: 'Select token',
});

export const createEmptyTokenWithAmount = (isEmpty = true): TokenWithAmount => ({
  ...createEmptyToken(),
  isEmpty,
  price: 0,
  amount: '',
});

export const toTokenAmount = (
  token: Token,
  state: TokenState,
): TokenWithAmount => ({
  ...token,
  ...state,
  isEmpty: false,
});

export function isNativeTransfer(token: Token) {
  return token.address === REEF_ADDRESS;
}

export const REEF_TOKEN: Token = {
  name: 'REEF',
  address: REEF_ADDRESS,
  iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6951.png',
  balance: BigNumber.from(0),
  decimals: 18,
  symbol: 'REEF',

};
export const reefTokenWithAmount = (): TokenWithAmount => toTokenAmount(
  REEF_TOKEN,
  {
    amount: '',
    index: -1,
    price: 0,
  },
);

export const getTokenPrice = (address: string, prices: TokenPrices): BN => new BN(prices[address]
  ? prices[address]
  : 0);

export const isNativeAddress = (toAddress: string) => toAddress.length === 48 && toAddress[0] === '5';
