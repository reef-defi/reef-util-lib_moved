// TODO when network changes signer changes as well? this could make 2 requests unnecessary - check
import {combineLatest, map, Observable, shareReplay, switchMap} from "rxjs";
import {AvailablePool, Pool} from "../../token/pool";
import {currentNetwork$, currentProvider$} from "../providerState";
import {reefTokenWithAmount, Token} from "../../token/token";
import {dexConfig, Network} from "../../network/network";
import {ReefSigner} from "../../account/ReefAccount";
import {loadPools} from "../../pools/pools";
import {selectedSignerAddressUpdate$} from "../account/selectedSignerAddressUpdate";
import {selectedSignerTokenBalances$} from "./selectedSignerTokenBalances";
import {apolloClientInstance$, zenToRx} from "../../graphql";
import {AVAILABLE_REEF_POOLS_GQL} from "../../graphql/availablePools";
import {REEF_ADDRESS} from "../../utils";
import {BigNumber} from "ethers";

export const selectedSignerPools$: Observable<Pool[]> = combineLatest([
    selectedSignerTokenBalances$,
    currentNetwork$,
    selectedSignerAddressUpdate$,
]).pipe(
    switchMap(([tkns, network, signer]: [Token[] | null, Network, ReefSigner]) => (signer && tkns?.length ? loadPools(tkns as Token[], signer.signer, dexConfig[network.name].factoryAddress) : [])),
    shareReplay(1),
);

export const availableReefPools$: Observable<AvailablePool[]> = combineLatest([
    apolloClientInstance$,
    currentProvider$,
]).pipe(
    switchMap(([apollo, provider]) => zenToRx(
        apollo.subscribe({
            query: AVAILABLE_REEF_POOLS_GQL,
            variables: {hasTokenAddress: reefTokenWithAmount().address},
            fetchPolicy: 'network-only',
        }),
    )),
    map(({data: {verified_pool: pools}}) => pools.map(pool => (
        {
            token1: pool.token_1,
            token2: pool.token_2,
            decimals: pool.pool_decimal,
            reserve1: null,
            reserve2: null,
            poolAddress: pool.address,
            userPoolBalance: null,
            totalVolumeToken1: pool.volume_aggregate.aggregate.sum.amount_1,
            totalVolumeToken2: pool.volume_aggregate.aggregate.sum.amount_2,
            lastTimeframe: pool.volume_aggregate.aggregate.max.timeframe,
            totalSupply: (pool.supply[0])?.total_supply
        }
    ))),
    shareReplay(1)
);

/* TODO load tokens and cache
export const availablePoolTokens$: Observable<Token[]> = availableReefPools$.pipe(
    map((pool: AvailablePool) => ({
        address: pool.token2===REEF_ADDRESS?pool.token1:pool.token2
        balance:BigNumber.from('0'),
        name: pool.
    } as Token))
)*/
