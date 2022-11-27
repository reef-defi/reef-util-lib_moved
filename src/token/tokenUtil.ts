import {BigNumber, ContractInterface, utils} from 'ethers';
import {BigNumber as BN} from 'bignumber.js';
import {
    ContractType,
    EMPTY_ADDRESS,
    REEF_ADDRESS,
    REEF_TOKEN,
    Token,
    TokenBalance,
    TokenPrices,
    TokenState,
    TokenWithAmount,
} from './tokenModel';
import {Pool} from "./pool";
import {
    FeedbackDataModel,
    FeedbackStatusCode,
    findMinStatusCode,
    toFeedbackDM
} from "../reefState/model/feedbackDataModel";
import {ERC20} from "./abi/ERC20";
import {ERC721Uri} from "./abi/ERC721Uri";
import {ERC1155Uri} from "./abi/ERC1155Uri";

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
    token: Token | TokenBalance,
): FeedbackDataModel<Pool | null> | undefined => pools.find(
    (pool_fdm) => {
        if (!pool_fdm?.data) {
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
    token: Token | TokenBalance,
    pools: FeedbackDataModel<Pool | null>[],
    reefPrice: FeedbackDataModel<number>,
): FeedbackDataModel<number> => {
    let ratio: number;
    if (token.address.toLowerCase() === REEF_ADDRESS.toLowerCase()) {
        return reefPrice;
    }

    const reefTokenPool = findReefTokenPool_fbk(pools, REEF_ADDRESS, token);
    const minStat = findMinStatusCode([reefTokenPool, reefPrice])

    if (!reefTokenPool || !reefTokenPool.data || minStat < FeedbackStatusCode.COMPLETE_DATA) {
        if (!reefTokenPool || reefTokenPool.hasStatus(FeedbackStatusCode.ERROR)) {
            return toFeedbackDM(0, FeedbackStatusCode.MISSING_INPUT_VALUES, 'Pool not found.')
        }
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

/*export const defaultTokenState = (index = 0): TokenState => ({
    index,
    amount: '',
    price: 0,
});*/

export const createEmptyToken = (): Token => ({
    name: 'Select token',
    address: EMPTY_ADDRESS,
    balance: BigNumber.from('0'),
    decimals: -1,
    iconUrl: '',
    symbol: 'Select token',
});

export const createEmptyTokenWithAmount = (/*isEmpty = true*/): TokenWithAmount => ({
    ...createEmptyToken(),
    // isEmpty,
    price: 0,
    amount: '',
});

export const toTokenAmount = (
    token: Token,
    state: TokenState,
): TokenWithAmount => ({
    ...token,
    ...state,
    // isEmpty: false,
});

export function isNativeTransfer(token: Token) {
    return token.address === REEF_ADDRESS;
}

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
