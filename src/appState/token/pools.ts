// TODO when network changes signer changes as well? this could make 2 requests unnecessary - check
import {reefTokenWithAmount} from "../../token/token";
import {zenToRx} from "../../graphql";
import {AVAILABLE_REEF_POOLS_GQL} from "../../graphql/availablePools.gql";

export const loadAvailablePools = ([apollo, provider]) => zenToRx(
    apollo.subscribe({
        query: AVAILABLE_REEF_POOLS_GQL,
        variables: {hasTokenAddress: reefTokenWithAmount().address},
        fetchPolicy: 'network-only',
    }),
);

export const toAvailablePools = ({data: {verified_pool: pools}}) => pools.map(pool => (
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
));
/* TODO load tokens and cache
export const availablePoolTokens$: Observable<Token[]> = availableReefPools$.pipe(
    map((pool: AvailablePool) => ({
        address: pool.token2===REEF_ADDRESS?pool.token1:pool.token2
        balance:BigNumber.from('0'),
        name: pool.
    } as Token))
)*/
