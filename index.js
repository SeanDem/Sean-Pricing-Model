const request = require('request');
const cheerio = require('cheerio');
var fs = require('fs');

//opeensea 
const opensea = require("opensea-js");
const OpenSeaPort = opensea.OpenSeaPort;
const Network = opensea.Network;

//Event Listing Opensea
const { OrderSide } = 'opensea-js/lib/types'
const { EventType } = 'opensea-js'
const ActionTypes = './index'

//Wallet provider
const HDWalletProvider = require("@truffle/hdwallet-provider");

//ether tools
const { ethers, BigNumber } = require("ethers");
const { default: axios } = require("axios");

//fetch
const fetch = require('make-fetch-happen');
const { clearScreenDown } = require('readline');
const { next } = require('cheerio/lib/api/traversing');
const { PassThrough } = require('stream');

//DUBUG 
const debug = true

//confing setup 
const config = {
    net : Network.Main,
    pause: 5000,
    apiKey : "73390599da6243559194a3da413a31ce",
    httpsRpc : "https://mainnet.infura.io/v3/4cdbf9ce83b54525b32285f327836b53",
    privateKey : "5e388dce9a9531076405874cb677fba464c63567d9e7ba663dec64a77df511b6",
    WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    ETH : "0x0000000000000000000000000000000000000000",
    slug : "boredapeyachtclub", 
    duration : 2000,
    start : 1
}

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf())
    date.setDate(date.getDate() + days)
    return date;
}

function subtractDays(numOfDays, date = new Date()) {
    date.setDate(date.getDate() - numOfDays);
    return date;
    }

const provider = new HDWalletProvider([config.privateKey], config.httpsRpc);

const seaport = new OpenSeaPort(provider, {
    networkName: config.net,
    apiKey: config.apiKey
  })


async function getMetaData(Id = 69 ,slug = config.slug){
    asset = seaport.api.getAssets({ 
        token_ids: Id,
        collection_slug: config.slug,
        include_orders: 'false',
        })
    return asset
}

class collectionOrders {
    constructor(slug){
        this.slug = slug
        this.ordersDict = undefined
    }

    async order(cursor = ''){
        order = seaport.api.getAssets({ 
        collection_slug: this.slug,
        order_direction: 'desc',
        limit: '50',
        include_orders: 'true',
        cursor : cursor }
    )
    return order
        }

    // n = number of pages to go through 50 orders per page
    async getOrders(n=200){
        if (debug == true) {n=10}
        
        console.log(" ~~~~~ Gathering Collecton Sales & Listings Data ~~~~~");
        this.ordersDict = await this.order();
        let cursor = this.ordersDict.next
        
        // for loop/ while loop for size of collection divided by 50
        for (let i = 1; i < n-1; i++) {
            let order = await this.order(cursor = cursor)
            cursor = order.next

            for (let j = 0; j < Object.keys(order.assets).length; j++) {
                this.ordersDict.assets.push(order.assets[j])
            } 
        }
        console.log(" ~~~~~ Finished gathering data ~~~~~ ")
        //return this.ordersDict
    }
}
async function getCollectionTraits(slug){
    try{
        let url = `https://api.opensea.io/api/v1/collection/${slug}`
        let response = await axios.get(url);
        let data = JSON.parse(JSON.stringify(response.data));

        return data.collection.traits
    }catch (err) {
        console.log(err);
        if (err.message.includes("429")){await new Promise(r => setTimeout(r, this.pause));}
        return null
}   }


async function createTriatPriceDict(orders) {
    var dateCutoff = subtractDays(30)
    /*
    Copy trait dict from collection API endpont. 
    traits 
        trait_type
            trait_value
                quantity 
                    num
                add below to new dict 
                lowest_last_sale 
                    num
                lowest_listing 
                    num 
    */

    // Loop through all orders
    for (let n = 0; n < Object.keys(orders.assets).length; n++){
        var assetTraits = orders.assets[n].traits
        var tokenid  = orders.assets[n].tokenID
            
        //For LastSale
        //Get price of last sale if: it exists, is within last n days, is in WETH or ETH
        if (orders.assets[n].lastSale != undefined){
            lastSale = orders.assets[n].lastSale
            let istrue = lastSale.eventType 
            let date = lastSale.eventTimestamp
            let saleToken = lastSale.paymentToken.address
            
            //Check if sale is within last n days and is sale was completed
            if (istrue == 'successful' && date > dateCutoff){

                //Check if sale in WETH or ETH
                if (saleToken == config.WETH || saleToken == config.ETH){
                    salePriceEth = lastSale.totalPrice/10**18
                    
                    updateTraitLastSaleFloor(salePriceEth,assetTraits)
                }
            }
        }

        //For Listing
            //Get listing data if: it exists, is correcting listing type, listing is ETH or WETH 
            //Check if lisitng exists 
            if (orders.assets[n].sellOrders != undefined){
                listing  = orders.assets[n].sellOrders[0] 
                let listingtype = listing.saleKind // 0 for listing 
                let side = listing.side
                let listingToken = listing.paymentTokenContract.address

                //Check if correct listing type 
                if (listingtype == 0 && side == 1){

                    //check if listing is in WETH or ETH 
                    if (listingToken == config.ETH || listingToken == config.WETH){
                        listingPriceEth = listing.currentPrice/10**18
                        
                        updateTraitListingFloor(listingPriceEth, assetTraits)
                    }   
                }
            }  
    }
}

async function updateTraitListingFloor(listingPriceEth, assetTraits){
    //[n].trait_type
    //[n].value
    //listingPriceEth
    
    //TODO fix this! 
    for (let n = 0; n < Object.keys(assetTraits).length; n++){
        let type = assetTraits[n].trait_type
        let value = assetTraits[n].value 
        if (traitPriceDict[type][value][0] == undefined){undefined }  
        }
}

async function updateTraitLastSaleFloor(salePriceEth, assetTraits){
    for (const [key, value] of Object.entries(assetTraits)) {
        console.log(key, value)
        //if (traitPriceDict[key]){}
            
    }
}

(async () => {
   let orders = new collectionOrders(config.slug)
   orders.getOrders()
   let priceDict = createTriatPriceDict(orders.ordersDict)

})();
