import {toInjectedAccountsWithMeta} from '../src/appState/util/util'
import {availableNetworks, selectedSigner$, selectedSignerTokenBalances$} from "../src";
import {web3Enable, web3FromSource} from "@reef-defi/extension-dapp";
import {InjectedExtension} from "@reef-defi/extension-inject/types";
import {setCurrentAddress} from "../src/appState/account/setAccounts";
import {REEF_EXTENSION_IDENT} from "@reef-defi/extension-inject";
import {signersFromJson$} from "../src/appState/account/signersFromJson";
import {initReefState} from "../src/appState/initReefState";
import {selectedSignerTokenPrices$} from "../src/appState/token/tokenState";
import {firstValueFrom, skipWhile} from "rxjs";
import {availableReefPools$} from "../src/appState/token/pools";
import {selectedSignerNFTs$} from "../src/appState/token/nftTokenState";

const testAccounts = [{"address": "5GKKbUJx6DQ4rbTWavaNttanWAw86KrQeojgMNovy8m2QoXn", "meta": {"source": "reef"}},
    {"address": "5G9f52Dx7bPPYqekh1beQsuvJkhePctWcZvPDDuhWSpDrojN", "meta": {"source": "reef"}}
];

async function testAppStateTokens(testAccount: string){
    setCurrentAddress(testAccount);
    const selSig = await firstValueFrom(selectedSigner$);
    console.assert(selSig?.address === testAccount, 'Selected signer not the same as current address.');
    console.log(`signer ${selSig?.address}`);

    let tkns = await firstValueFrom(selectedSignerTokenBalances$);
    console.assert(tkns===null, 'Tokens not cleared when changing signer')
    tkns = await firstValueFrom(selectedSignerTokenBalances$.pipe(skipWhile(v=>!v)));
    console.log(` tokens=`,tkns);
    console.assert(tkns!==null, 'Tokens should load')

    tkns?.forEach((tkn) => {
        let sameAddressesLen = tkns?.filter(t => t.address === tkn.address).length;
        console.assert( sameAddressesLen === 1, `${sameAddressesLen} duplicates = ${tkn.address}`);
    });

    const nfts = await firstValueFrom(selectedSignerNFTs$);
    console.log(`nfts=`,nfts);

    console.log("END testAppStateTokens");

}

async function testAvailablePools() {
    const availablePools = await firstValueFrom(availableReefPools$);
    console.log("available pools=",availablePools);
    console.log("END testAvailablePools");
}

async function testAppStateSigners(accounts: any){

    const testAddress = testAccounts[0].address;
    console.assert(accounts.some(a=>a.address===testAddress), 'Test account not in extension')
    let selectAddr = accounts[1].address;
    setCurrentAddress(selectAddr);

    const sigJson = await firstValueFrom(signersFromJson$);
    console.assert(sigJson.length === 2, 'Number of signers');
    console.assert(accounts[0].address===sigJson[0].address, 'Accounts not the same');
    console.assert(selectAddr===sigJson[1].address, 'Accounts not the same');

    const selSig = await firstValueFrom(selectedSigner$);
    console.assert(selSig?.address === selectAddr, 'Selected signer not the same as current address.');

    const sigTokenBals = await firstValueFrom(selectedSignerTokenBalances$);
    const sigTokenPrices = await firstValueFrom(selectedSignerTokenPrices$);
    console.assert(sigTokenBals&&sigTokenBals?.length > 0, 'Token balances length');
    console.assert(sigTokenBals?.length === sigTokenPrices.length, 'Token prices and balances not same length');

    const selectAddr1 = accounts[0].address;
    console.assert(selectAddr !== selectAddr1, 'Address not different');
    setCurrentAddress(selectAddr1);
    const selSig1 = await firstValueFrom(selectedSigner$);
    console.assert(selSig1?.address === selectAddr1, 'Selected signer 1 not the same as current address.');
    console.log("END testAppStateSigners");

}

async function initTest () {
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
    await testAppStateTokens(accounts[1].address);
    await testAvailablePools();
}

window.addEventListener('load',initTest);
