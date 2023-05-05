import {
    collectFeedbackDMStatus,
    StatusDataObject,
    FeedbackStatus,
    FeedbackStatusCode,
    toFeedbackDM
} from "../model/statusDataObject";
import {REEF_ADDRESS, Token, TokenBalance, TokenWithAmount} from "../../token";
import {Pool} from "../../token/pool";
import {calculateTokenPrice_sdo} from "../../token/tokenUtil";

export const toPlainString = (num: number): string => `${+num}`.replace(
    /(-?)(\d*)\.?(\d*)e([+-]\d+)/,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (a, b, c, d, e) => (e < 0
        ? `${b}0.${Array(1 - e - c.length).join('0')}${c}${d}`
        : b + c + d + Array(e - d.length + 1).join('0')),
);
export const sortReefTokenFirst = (tokens: StatusDataObject<Token | TokenBalance>[]): StatusDataObject<Token | TokenBalance>[] => {
    const reefTokenIndex = tokens.findIndex((t: StatusDataObject<Token | TokenBalance>) => t.data.address === REEF_ADDRESS);
    if (reefTokenIndex > 0) {
        return [tokens[reefTokenIndex], ...tokens.slice(0, reefTokenIndex), ...tokens.slice(reefTokenIndex + 1, tokens.length)];
    }
    return tokens;
};
export const toTokensWithPrice_sdo = ([tokens, reefPrice, pools]: [
    StatusDataObject<StatusDataObject<Token | TokenBalance>[]>,
    StatusDataObject<number>,
    StatusDataObject<StatusDataObject<Pool | null>[]>
]): StatusDataObject<StatusDataObject<TokenWithAmount>[]> => {
    const tknsWPrice = tokens.data.map(
        (token_sdo) => {
            let isReef = token_sdo.data.address===REEF_ADDRESS;
            const returnTkn = toFeedbackDM({...token_sdo.data, price: isReef?reefPrice.data:0} as TokenWithAmount, token_sdo.getStatusList());
            if (!isReef && token_sdo.hasStatus(FeedbackStatusCode.COMPLETE_DATA) /*&& pools.hasStatus(FeedbackStatusCode.COMPLETE_DATA)*/) {
                const priceSDO = calculateTokenPrice_sdo(token_sdo.data, pools.data, reefPrice);
                if (priceSDO) {
                    returnTkn.setStatus(priceSDO.getStatus().map(priceStat => ({
                        ...priceStat,
                        propName: 'price'
                    } as FeedbackStatus)));
                    returnTkn.data.price = priceSDO.data;
                }
                if ('0x9250BA0e7616357D6d98825186CF7723D38D8B23' === token_sdo.data.address) {
                    console.log('PROIIII=',returnTkn.getStatusList(), ' pools stat=',pools.getStatusList())
                }
            }
            return returnTkn;
        }
    );
    return toFeedbackDM(tknsWPrice, tknsWPrice.length ? collectFeedbackDMStatus(tknsWPrice) : tokens.getStatusList());
};
