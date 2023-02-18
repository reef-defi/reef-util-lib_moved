import {Signer} from '@reef-defi/evm-provider';
import {Contract} from 'ethers';
import {getReefswapFactory} from "../network/rpc";
import {EMPTY_ADDRESS, REEF_ADDRESS, REEF_TOKEN, Token, TokenBalance} from "../token/tokenModel";
import {Pool} from "../token/pool";
import {ReefswapPair} from "../token/abi/ReefswapPair";
import {catchError, combineLatest, map, Observable, of, shareReplay, startWith, switchMap, timer} from "rxjs";
import {FeedbackStatusCode, StatusDataObject, toFeedbackDM} from "../reefState/model/statusDataObject";
import {ensure} from "../utils/utils";

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
    token1: Token|TokenBalance,
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
        token1: {...token1, balance: tokenBalance1},
        token2: {...token2, balance: tokenBalance2},
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

const cachePool$: Map<string, Observable<StatusDataObject<Pool | null>>> = new Map<string, Observable<StatusDataObject<Pool | null>>>();
// TODO listen to pool events and refresh then
const poolsRefresh$ = timer(0, 420000);

function isPoolCached(token1: Token|TokenBalance, token2: Token|TokenBalance) {
    return (cachePool$.has(`${token1.address}-${token2.address}`) || cachePool$.has(`${token1.address}-${token2.address}`));
}

const getPool$ = (token1: Token|TokenBalance, signer: Signer, factoryAddress: string): Observable<StatusDataObject<Pool|null>> => {
    const token2 = REEF_TOKEN;
    if (!isPoolCached(token1, token2)) {
        const pool$ = poolsRefresh$.pipe(
            switchMap(() => loadPool(token1, token2, signer, factoryAddress)),
            map(pool => toFeedbackDM(pool, FeedbackStatusCode.COMPLETE_DATA)),
            catchError((err) => {
                return of(toFeedbackDM({
                    token1,
                    token2
                } as Pool, FeedbackStatusCode.ERROR, 'Loading pool error:' + err.message))
            }),
            shareReplay(1),
            startWith(toFeedbackDM({token1, token2} as Pool, FeedbackStatusCode.LOADING, 'Loading pool data.'))
        );
        cachePool$.set(`${token1.address}-${token2.address}`, pool$);
    }
    return cachePool$.get(`${token1.address}-${token2.address}`) || cachePool$.get(`${token2.address}-${token1.address}`)!;
}

export const fetchPools$ = (tokens: StatusDataObject<Token|TokenBalance>[], signer: Signer, factoryAddress: string): Observable<(StatusDataObject<Pool | null>[])> => {
    const poolsArr$: Observable<StatusDataObject<Pool|null>>[] = tokens.filter(tkn=>tkn.data.address!==REEF_ADDRESS)
        .map((tkn:StatusDataObject<Token|TokenBalance>) => {
        if (tkn.hasStatus( FeedbackStatusCode.COMPLETE_DATA)) {
            return getPool$(tkn.data, signer, factoryAddress);
        }
        return of(toFeedbackDM(null, tkn.getStatusList()));
    });
    return combineLatest(poolsArr$).pipe(shareReplay(1));
};
