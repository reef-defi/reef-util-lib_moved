import {ERC20ContractData, Token, TokenBalance} from './token';
import {BigNumber} from "ethers";

export interface Pool {
  token1: Token|TokenBalance;
  token2: Token|TokenBalance;
  decimals: number;
  // TODO transform reserve1, reserve2, userPoolBalance and minimumLiquidity to BigNumber
  reserve1: string;
  reserve2: string;
  totalSupply: string;
  poolAddress: string;
  userPoolBalance: string;
}

export interface AvailablePool extends Pool {
  totalVolumeToken1: BigNumber;
  totalVolumeToken2: BigNumber;
  lastTimeframe: string;
  reserve1?: string;
  reserve2?: string;
  userPoolBalance?: string;
}

