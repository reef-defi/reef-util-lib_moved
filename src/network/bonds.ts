import {REEF_TOKEN, Token} from "../token";

export interface Bond {
    name: string;
    description: string;
    contractAddress: string;
    validatorAddress: string;
    stake: Token;
    farm: Token;
    apy: string;
}

export const bondsMainnet: Bond[] = [
    {
        name: 'Reef community staking bond',
        description: '',
        contractAddress: '0x7D3596b724cEB02f2669b902E4F1EEDeEfad3be6',
        validatorAddress: '5Hax9GZjpurht2RpDr5eNLKvEApECuNxUpmRbYs5iNh7LpHa',
        stake: {...REEF_TOKEN},
        farm: {...REEF_TOKEN},
        apy: '32',
    },
];
