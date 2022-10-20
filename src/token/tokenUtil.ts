import {utils} from 'ethers';
import {BigNumber as BN} from 'bignumber.js';
import {REEF_ADDRESS, Token,} from './token';
import {Pool} from "./pool";
import {
    FeedbackDataModel,
    FeedbackStatusCode,
    findMinStatusCode,
    toFeedbackDM
} from "../appState/model/feedbackDataModel";

const {parseUnits, formatEther} = utils;

const getReefTokenPoolReserves = (
    reefTokenPool: Pool,
    reefAddress: string,
): { reefReserve: number; tokenReserve: number } => {
    let reefReserve: number;
    let tokenReserve: number;
    if (
        reefTokenPool.token1.address.toLowerCase() === reefAddress.toLowerCase()
    ) {
        reefReserve = parseInt(reefTokenPool.reserve1, 10);
        tokenReserve = parseInt(reefTokenPool.reserve2, 10);
    } else {
        reefReserve = parseInt(reefTokenPool.reserve2, 10);
        tokenReserve = parseInt(reefTokenPool.reserve1, 10);
    }
    return {reefReserve, tokenReserve};
};
/*const findReefTokenPool = (
    pools: Pool[],
    reefAddress: string,
    token: Token,
): Pool | undefined => pools.find(
    (pool) => (pool.token1.address.toLowerCase() === reefAddress.toLowerCase()
        && pool.token2.address.toLowerCase() === token.address.toLowerCase())
        || (pool.token2.address.toLowerCase() === reefAddress.toLowerCase()
            && pool.token1.address.toLowerCase() === token.address.toLowerCase()),
);*/

const findReefTokenPool_fbk = (
    pools: FeedbackDataModel<Pool | null>[],
    reefAddress: string,
    token: Token,
): FeedbackDataModel<Pool | null> | undefined => pools.find(
    (pool_fdm) => {
        if (!pool_fdm.data) {
            return false;
        }
        const pool: Pool = pool_fdm.data!;
        return (pool.token1?.address.toLowerCase() === reefAddress.toLowerCase()
            && pool.token2?.address.toLowerCase() === token.address.toLowerCase())
            || (pool.token2?.address.toLowerCase() === reefAddress.toLowerCase()
                && pool.token1?.address.toLowerCase() === token.address.toLowerCase());
    }
);

/*export const calculateTokenPrice = (
    token: Token,
    pools: Pool[],
    reefPrice: DataWithProgress<number>,
): DataWithProgress<number> => {
    if (!isDataSet(reefPrice)) {
        return reefPrice;
    }
    const {address: reefAddress} = reefTokenWithAmount();
    let ratio: number;
    if (token.address.toLowerCase() !== reefAddress.toLowerCase()) {
        const reefTokenPool = findReefTokenPool(pools, reefAddress, token);
        if (reefTokenPool) {
            const {reefReserve, tokenReserve} = getReefTokenPoolReserves(
                reefTokenPool,
                reefAddress,
            );
            ratio = reefReserve / tokenReserve;
            return ratio * (reefPrice as number);
        }
        return DataProgress.NO_DATA;
    }
    return reefPrice || DataProgress.NO_DATA;
};*/

export const calculateTokenPrice_fbk = (
    token: Token,
    pools: FeedbackDataModel<Pool | null>[],
    reefPrice: FeedbackDataModel<number>,
): FeedbackDataModel<number> => {
    let ratio: number;
    if (token.address.toLowerCase() === REEF_ADDRESS.toLowerCase()) {
        return reefPrice;
    }

    const reefTokenPool = findReefTokenPool_fbk(pools, REEF_ADDRESS, token);
    const minStat = findMinStatusCode([reefTokenPool, reefPrice])

    if (minStat < FeedbackStatusCode.COMPLETE_DATA) {
        return toFeedbackDM(0, minStat);
    }

    const {reefReserve, tokenReserve} = getReefTokenPoolReserves(
        reefTokenPool.data!,
        REEF_ADDRESS,
    );
    ratio = reefReserve / tokenReserve;
    const priceVal = ratio * reefPrice.data;
    return toFeedbackDM(priceVal, FeedbackStatusCode.COMPLETE_DATA);
};

/*export const calculateBalanceValue = ({price,
                                          balance,
                                      }:
                                          | { price: DataWithProgress<number>; balance: BigNumber }
                                          | TokenWithAmount): DataWithProgress<number> => {
    if (!isDataSet(price)) {
        return price;
    }
    const priceStr = price.toString();
    const priceBN = BigNumber.from(parseUnits(toDecimalPlaces(priceStr, 18)));
    const balanceFixed = parseInt(formatEther(balance.toString()), 10);
    return parseFloat(
        formatEther(priceBN.mul(BigNumber.from(balanceFixed)).toString()),
    );
};*/

export const toCurrencyFormat = (value: number, options = {}): string => Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'symbol',
    ...options,
}).format(value);

export const normalize = (amount: string | number, decimals: number): BN => new BN(Number.isNaN(amount) ? 0 : amount)
    .div(new BN(10).pow(decimals));

