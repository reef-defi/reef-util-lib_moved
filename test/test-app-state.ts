import {toInjectedAccountsWithMeta} from '../src/appState/util/util'
import {availableNetworks, dexConfig, selectedSigner$} from "../src";
import {web3Enable, web3FromSource} from "@reef-defi/extension-dapp";
import {InjectedExtension} from "@reef-defi/extension-inject/types";
import {setCurrentAddress} from "../src/appState/account/setAccounts";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {signersFromJson$} from "../src/appState/account/signersFromJson";
import {initReefState} from "../src/appState/initReefState";
import {
    selectedSignerNFTs$,
    selectedSignerTokenBalances$,
    selectedSignerTokenPrices$
} from "../src/appState/tokenState.rx";
import {firstValueFrom, skip, skipWhile, tap} from "rxjs";
import {FeedbackStatusCode} from "../src/appState/model/feedbackDataModel";
import {fetchPools$} from "../src/pools/pools";

const testAccounts = [{"address": "5GKKbUJx6DQ4rbTWavaNttanWAw86KrQeojgMNovy8m2QoXn", "meta": {"source": "reef"}},
    {"address": "5G9f52Dx7bPPYqekh1beQsuvJkhePctWcZvPDDuhWSpDrojN", "meta": {"source": "reef"}}
];

async function testNfts() {
    console.log('Testing nfts');
    let nfts = await firstValueFrom(selectedSignerNFTs$);
    console.assert(nfts.getStatus()?.code === FeedbackStatusCode.LOADING, 'Nfts not cleared when changing signer')
    console.log("resolve url=",);
    nfts = await firstValueFrom(selectedSignerNFTs$.pipe(skip(1)));
    console.assert(nfts.getStatus()?.code === FeedbackStatusCode.RESOLVING_NFT_URL, 'Nft data not complete')

    nfts = await firstValueFrom(selectedSignerNFTs$.pipe(
        tap(v=>console.log('Waiting for nft complete data')),
        skipWhile(nfts => nfts.getStatus()?.code !== FeedbackStatusCode.COMPLETE_DATA)));
    console.assert(!nfts.data.find(nft => nft.getStatus()?.code !== FeedbackStatusCode.COMPLETE_DATA), 'Nft data not complete')
    console.log(`nfts=`, nfts);
}

async function testAppStateTokens(testAccount: string) {
    setCurrentAddress(testAccount);
    const selSig = await firstValueFrom(selectedSigner$);
    console.assert(selSig?.address === testAccount, 'Selected signer not the same as current address.');
    console.log(`signer ${selSig?.address}`);

    let tkns = await firstValueFrom(selectedSignerTokenBalances$);
    console.assert(tkns === null, 'Tokens not cleared when changing signer')
    tkns = await firstValueFrom(selectedSignerTokenBalances$.pipe(skipWhile(v => !v)));
    console.log(` tokens=`, tkns);
    console.assert(tkns !== null, 'Tokens should load')

    tkns?.forEach((tkn) => {
        let sameAddressesLen = tkns?.filter(t => t.address === tkn.address).length;
        console.assert(sameAddressesLen === 1, `${sameAddressesLen} duplicates = ${tkn.address}`);
    });

    console.log("END testAppStateTokens");

}

async function testAvailablePools(tokens, signer, factoryAddr) {
    // const availablePools = await firstValueFrom(availableReefPools$);
    fetchPools$(tokens, signer?.signer, factoryAddr).subscribe(value => {
        console.log("fetchPools$=", value);
    });

    console.log("END testAvailablePools");
}

async function testAppStateSigners(accounts: any) {

    const testAddress = testAccounts[0].address;
    console.assert(accounts.some(a => a.address === testAddress), 'Test account not in extension')
    let selectAddr = accounts[1].address;
    setCurrentAddress(selectAddr);

    const sigJson = await firstValueFrom(signersFromJson$);
    console.assert(sigJson.length === 2, 'Number of signers');
    console.assert(accounts[0].address === sigJson[0].address, 'Accounts not the same');
    console.assert(selectAddr === sigJson[1].address, 'Accounts not the same');

    const selSig = await firstValueFrom(selectedSigner$);
    console.assert(selSig?.address === selectAddr, 'Selected signer not the same as current address.');

    const sigTokenBals = await firstValueFrom(selectedSignerTokenBalances$);
    const sigTokenPrices = await firstValueFrom(selectedSignerTokenPrices$);
    console.assert(sigTokenBals && sigTokenBals?.length > 0, 'Token balances length');
    console.assert(sigTokenBals?.length === sigTokenPrices.length, 'Token prices and balances not same length');

    const selectAddr1 = accounts[0].address;
    console.assert(selectAddr !== selectAddr1, 'Address not different');
    setCurrentAddress(selectAddr1);
    const selSig1 = await firstValueFrom(selectedSigner$);
    console.assert(selSig1?.address === selectAddr1, 'Selected signer 1 not the same as current address.');
    console.log("END testAppStateSigners");

}

async function initTest() {
    const extensions: InjectedExtension[] = await web3Enable('Test lib');
    const reefExt = await web3FromSource(REEF_EXTENSION_IDENT);
    const accounts = await reefExt.accounts.get();
    const accountsWMeta = toInjectedAccountsWithMeta(accounts, REEF_EXTENSION_IDENT);
    await initReefState({
        network: availableNetworks.testnet,
        jsonAccounts: {accounts: accountsWMeta, injectedSigner: reefExt.signer}
    });

    // await testAppStateSigners(accounts);
    await testAppStateTokens(accounts[0].address);
    // await testNfts();
    // await testAppStateTokens(accounts[1].address);
    // await testNfts();

    const signer = await firstValueFrom(selectedSigner$);
    const tokens = await firstValueFrom(selectedSignerTokenBalances$);
    console.log("token balances=",tokens);
    await testAvailablePools(tokens, signer, dexConfig.testnet.factoryAddress);
    selectedSignerTokenPrices$.subscribe(v => {
        console.log("token prices=", v);
    });
}

window.addEventListener('load', initTest);
