import {
    collectFeedbackDMStatus,
    FeedbackDataModel,
    FeedbackStatus,
    FeedbackStatusCode,
    toFeedbackDM
} from "../model/feedbackDataModel";
import {REEF_ADDRESS, Token, TokenBalance, TokenWithAmount} from "../../token";
import {Pool} from "../../token/pool";
import {calculateTokenPrice_fbk} from "../../token/tokenUtil";

export const toPlainString = (num: number): string => `${+num}`.replace(
    /(-?)(\d*)\.?(\d*)e([+-]\d+)/,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (a, b, c, d, e) => (e < 0
        ? `${b}0.${Array(1 - e - c.length).join('0')}${c}${d}`
        : b + c + d + Array(e - d.length + 1).join('0')),
);
export const sortReefTokenFirst = (tokens: FeedbackDataModel<Token | TokenBalance>[]): FeedbackDataModel<Token | TokenBalance>[] => {
    const reefTokenIndex = tokens.findIndex((t: FeedbackDataModel<Token | TokenBalance>) => t.data.address === REEF_ADDRESS);
    if (reefTokenIndex > 0) {
        return [tokens[reefTokenIndex], ...tokens.slice(0, reefTokenIndex), ...tokens.slice(reefTokenIndex + 1, tokens.length)];
    }
    return tokens;
};
export const toTokensWithPrice_fbk = ([tokens, reefPrice, pools]: [
    FeedbackDataModel<FeedbackDataModel<Token | TokenBalance>[]>,
    FeedbackDataModel<number>,
    FeedbackDataModel<FeedbackDataModel<Pool | null>[]>
]): FeedbackDataModel<FeedbackDataModel<TokenWithAmount>[]> => {
    const tknsWPrice = tokens.data.map(
        (token_fbk) => {
            const returnTkn = toFeedbackDM({...token_fbk.data, price: 0} as TokenWithAmount, token_fbk.getStatusList());
            if (token_fbk.hasStatus(FeedbackStatusCode.COMPLETE_DATA) && pools.hasStatus(FeedbackStatusCode.COMPLETE_DATA)) {
                const priceFDM = calculateTokenPrice_fbk(token_fbk.data, pools.data, reefPrice);
                returnTkn.setStatus(priceFDM.getStatus().map(priceStat => ({
                    ...priceStat,
                    propName: 'price',
                    message: 'Price set'
                } as FeedbackStatus)));
                returnTkn.data.price = priceFDM.data;
            }
            return returnTkn;
        }
    );
    return toFeedbackDM(tknsWPrice, tknsWPrice.length ? collectFeedbackDMStatus(tknsWPrice) : tokens.getStatusList());
};
