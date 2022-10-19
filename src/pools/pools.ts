import {Signer} from '@reef-defi/evm-provider';
import {Contract} from 'ethers';
import {ensure, uniqueCombinations} from '../utils';
import {getReefswapFactory} from "../network/rpc";
import {REEF_TOKEN, Token} from "../token/token";
import {Pool} from "../token/pool";
import {ReefswapPair} from "../token/abi/ReefswapPair";
import {catchError, combineLatest, map, Observable, of, shareReplay, startWith, switchMap, tap, timer} from "rxjs";
import {FeedbackDataModel, FeedbackStatusCode, toFeedbackDM} from "../appState/model/feedbackDataModel";

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

const findPoolTokenAddress = async (
  address1: string,
  address2: string,
  signer: Signer,
  factoryAddress: string,
): Promise<string> => {
  const reefswapFactory = getReefswapFactory(factoryAddress, signer);
  const address = await reefswapFactory.getPair(address1, address2);
  return address;
};

export const loadPool = async (
  token1: Token,
  token2: Token,
  signer: Signer,
  factoryAddress: string,
): Promise<Pool> => {
  const address = await findPoolTokenAddress(
    token1.address,
    token2.address,
    signer,
    factoryAddress,
  );
  ensure(address !== EMPTY_ADDRESS, 'Pool does not exist!');
  const contract = new Contract(address, ReefswapPair, signer);

  const decimals = await contract.decimals();
  const reserves = await contract.getReserves();
  const totalSupply = await contract.totalSupply();
  const liquidity = await contract.balanceOf(await signer.getAddress());

  const address1 = await contract.token1();

  const [finalReserve1, finalReserve2] = token1.address !== address1
    ? [reserves[0], reserves[1]]
    : [reserves[1], reserves[0]];

  const tokenBalance1 = finalReserve1.mul(liquidity).div(totalSupply);
  const tokenBalance2 = finalReserve2.mul(liquidity).div(totalSupply);

  return {
    poolAddress: address,
    decimals: parseInt(decimals, 10),
    reserve1: finalReserve1.toString(),
    reserve2: finalReserve2.toString(),
    totalSupply: totalSupply.toString(),
    userPoolBalance: liquidity.toString(),
    token1: { ...token1, balance: tokenBalance1 },
    token2: { ...token2, balance: tokenBalance2 },
  };
};

/*export const loadPools = async (
  tokens: Token[],
  signer: Signer,
  factoryAddress: string,
): Promise<Pool[]> => {
  const tokenCombinations = uniqueCombinations(tokens);
  const pools: Pool[] = [];
  for (let index = 0; index < tokenCombinations.length; index += 1) {
    try {
      const [token1, token2] = tokenCombinations[index];
      /!* eslint-disable no-await-in-loop *!/
      const pool = await loadPool(token1, token2, signer, factoryAddress);
      /!* eslint-disable no-await-in-loop *!/
      pools.push(pool);
    } catch (e) {}
  }
  return pools;
};*/

const cachePool$: Map<string,Observable<FeedbackDataModel<Pool|null>>> = new Map<string, Observable<FeedbackDataModel<Pool|null>>>();
// TODO listen to pool events and refresh then
const poolsRefresh$ = timer(0,420000);

function isPoolCached(token1: Token, token2: Token) {
  return (cachePool$.has(`${token1.address}-${token2.address}`) || cachePool$.has(`${token1.address}-${token2.address}`));
}

const getPool$ = (token1: Token, signer: Signer, factoryAddress: string): Observable<FeedbackDataModel<Pool>> => {
  const token2 = REEF_TOKEN;
  if(!isPoolCached(token1, token2)){
    const pool$ = poolsRefresh$.pipe(
        switchMap(()=>loadPool(token1, token2, signer, factoryAddress)),
        map(pool=>toFeedbackDM(pool, FeedbackStatusCode.COMPLETE_DATA)),
        catchError((err) => {
          console.log("ERROR loadPool=",err.message);
          return of(toFeedbackDM({token1, token2} as Pool, FeedbackStatusCode.ERROR, 'Loading pool error:'+err.message))
        }),
        shareReplay(1),
        startWith(toFeedbackDM({token1, token2} as Pool, FeedbackStatusCode.LOADING, 'Loading pool data.'))
    );
    cachePool$.set(`${token1.address}-${token2.address}`, pool$);
  }
  return cachePool$.get(`${token1.address}-${token2.address}`) || cachePool$.get(`${token2.address}-${token1.address}`)!;
}

export const fetchPools$ = (tokens: FeedbackDataModel<Token>[], signer: Signer, factoryAddress: string): Observable<(FeedbackDataModel<Pool|null>|undefined)[]> => combineLatest(tokens.map(tkn=>getPool$(tkn.data, signer, factoryAddress)))
    .pipe(
        shareReplay(1)
    );
