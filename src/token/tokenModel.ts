import {BigNumber} from 'ethers';

export const REEF_ADDRESS = '0x0000000000000000000000000000000001000000';
export const REEF_TOKEN: Token = {
    name: 'REEF',
    address: REEF_ADDRESS,
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6951.png',
    balance: BigNumber.from(0),
    decimals: 18,
    symbol: 'REEF',

};

export const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

export enum ContractType {
    ERC20 = 'ERC20',
    ERC721 = 'ERC721',
    ERC1155 = 'ERC1155',
    other = 'other'
}

/*export interface ERC20ContractData {
    name: string;
    symbol: string;
    decimals: number;
}*/

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
    // isEmpty: boolean;
}

export interface TokenBalance {
    address: string;
    balance: number;
    iconUrl?: string;
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

export type TokenPrices = { [tokenAddress: string]: number };

export interface NFTMetadata {
    image?: string;
    iconUrl?: string;
    name?: string;
    mimetype?: string;
}

export interface TransferExtrinsic {
    blockId: string;
    index: number;
    hash: string;
}

export interface TokenTransfer {
    from: string;
    to: string;
    inbound: boolean;
    timestamp: number;
    token: Token | NFT;
    extrinsic: TransferExtrinsic;
    url: string;
}

