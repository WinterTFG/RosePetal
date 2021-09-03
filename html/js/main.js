$(function(){

    var hotSwap = function(page, pushSate){
        if (pushSate) history.pushState(null, null, '/' + page);
        $('.pure-menu-selected').removeClass('pure-menu-selected');
        $('a[href="/' + page + '"]').parent().addClass('pure-menu-selected');
        $.get("/get_page", {id: page}, function(data){
            $('main').html(data);
        }, 'html')
    };

    $('.hot-swapper').click(function(event){
        if (event.which !== 1) return;
        var pageId = $(this).attr('href').slice(1);
        hotSwap(pageId, true);
        event.preventDefault();
        return false;
    });

    window.addEventListener('load', function() {
        setTimeout(function() {
            window.addEventListener("popstate", function(e) {
                hotSwap(location.pathname.slice(1));
            });
        }, 0);
    });

    window.statsSource = new EventSource("http://tulipfarm.one/api/live_stats");

    const queryString = new URLSearchParams(window.location.search);

        if (queryString.has("search")) {
            var newSearch = "workers/" + queryString.get("search");
            history.pushState(null, null, '/' + newSearch);
        }

});

$(function() {
    statsSource.addEventListener('message', function (e) {
        var stats = JSON.parse(e.data);
        for (algo in stats.algos) {
            $('#statsMiners' + algo).text(stats.algos[algo].workers);
            $('#statsHashrate' + algo).text(stats.algos[algo].hashrateString);
        }
        for (var pool in stats.pools) {
            $('#statsMiners' + pool).text(stats.pools[pool].workerCount);
            $('#statsHashrate' + pool).text(stats.pools[pool].hashrateString);
        }
    });
});
// document.querySelector('main').appendChild(document.createElement('script')).src = '/js/stats.js';

function getRoundedHashrateDec(hashrate){
    var i = -1;
    var byteUnits = [ ' KH', ' MH', ' GH', ' TH', ' PH' ];
    do {
        hashrate = hashrate / 1000;
        i++;
    } while (hashrate > 1000);
    return Math.round((hashrate + Number.EPSILON) * 100) / 100 + byteUnits[i];
}

function getRoundedNetworkDiff(diff){
    var i = -1;
    var byteUnits = [ ' K', ' M', ' G', ' T', ' P'];
    do {
        diff = diff / 1000;
        i++;
    } while (diff > 1000);
    return Math.round((diff + Number.EPSILON) * 1000) / 1000 + byteUnits[i];
}

var readableNetworkData;

async function getErgNetworkData() {
    let response = await fetch('https://api.ergoplatform.com/stats');
    let ergNetworkData = await response.json();

    let hashrate = getRoundedHashrateDec(ergNetworkData.miningCost.hashRate);
    let diff = getRoundedNetworkDiff(ergNetworkData.miningCost.difficulty);

    var readableNetworkData = {
        roundedHashrateDec: hashrate,
        roundedNetworkDiff: diff
    }

    return readableNetworkData;
}

getErgNetworkData()
    .then((readableNetworkData) => {
        
        document.getElementById('networkHashrate').innerHTML = readableNetworkData.roundedHashrateDec;
        document.getElementById('networkDiff').innerHTML = readableNetworkData.roundedNetworkDiff;

    });

async function getErgOracleData() {
    // coingecko free API allows 50 calls per minute
    // if that becomes too limited, use erg-oracle and uncomment the json.parse line

    // let response = await fetch('https://erg-oracle-ergusd.spirepools.com/frontendData');
    let response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ergo');
    let ergOracleData = await response.json();
    // let jsonOracleData = JSON.parse(ergOracleData);
    let price = ergOracleData[0].current_price;
    return price;
}

getErgOracleData()
    .then((price) => {
        document.getElementById('ergoPrice').innerHTML = '$' + price;
    });

var blockRows = new Array();
blockRows[0] = new Array(); // getBlockInfo makes this a list of all blocks mined, newest first, with date and other data
blockRows[1] = new Array(); // blockRows[1] will contain integers for number of blocks mined in the past x hrs
blockRows[1][0] = 0;
blockRows[1][1] = 0;
blockRows[1][2] = 0;

async function getPoolStats() {
    let response = await fetch("http://tulipfarm.one/api/stats");
    let ergoPoolStats = await response.json();

    let workers = ergoPoolStats.pools.ergo.workers;
    var miners = [];
    for (var w in Object.keys(workers)) { 
        var miner = Object.keys(workers)[w]; 
        var hashrate = workers[miner].hashrateString;
        var shares = workers[miner].shares;
        var invalidShares = workers[miner].invalidshares;
        var efficiency = (shares > 0.0) ? shares/(shares+invalidShares) : 0.0;
        miners.push({Miner: miner, Hashrate: hashrate, Efficiency: efficiency});
    }

    var minersHTML = `
        <table class="table">
            <thead>
                <tr><th>Address</th><th>Efficiency</th><th>Hashrate</th></tr>
            </thead>
            <tbody>`;
    for (var m=0; m<miners.length; m++) {
        var rig = miners[m].Miner.includes('.') 
            ? miners[m].Miner.substr(0, 20)+'...'+miners[m].Miner.substr(miners[m].Miner.indexOf('.'), miners[m].Miner.length) 
            : miners[m].Miner.substr(0, 20)+'...'
        var wrk = miners[m].Miner.includes('.') 
            ? miners[m].Miner.substr(0, miners[m].Miner.indexOf('.'))
            : miners[m].Miner
        miners[m].Miner
        var eff = miners[m].Efficiency * 100.0 +'%'
        minersHTML += '<tr><td><a target="_blank" href="https://explorer.ergoplatform.com/en/addresses/'+wrk+'">'+rig+'</a>'
            +'</td><td>'+miners[m].Hashrate
            +'</td><td>'+eff
            +'</td></tr>'
    }
    minersHTML += '</tbody></table>'

    var readablePoolStats = {
        Hashrate: ergoPoolStats.algos.blake.hashrate,
        Workers: ergoPoolStats.algos.blake.workers,
        Miners: minersHTML
    }

    return readablePoolStats;
}

getPoolStats()
    .then((readablePoolStats) => {
        document.getElementById('statsMiners').innerHTML = readablePoolStats.Workers;
        document.getElementById('statsHashrate').innerHTML = getRoundedHashrateDec(readablePoolStats.Hashrate);
        document.getElementById('miners').innerHTML = readablePoolStats.Miners;
    });

async function getBlockInfo() {

    let response = await fetch('http://tulipfarm.one:2127/payout/block/info');
    
    let blockInfo = await response.json();
    let jsonBlockInfo = JSON.parse(blockInfo);

    let blockInfoLength = Object.keys(jsonBlockInfo).length - 1;
    
    // var blockDate; 
    // var blockReward;
    // var blockStatus;

    const oneday = 60 * 60 * 24 * 1000;
    let now = new Date();

    if (Object.keys(jsonBlockInfo).length === 0) {
        blockRows[0][0] = '<tr>\
            <td>None yet</td>\
            <td></td>\
            <td></td>\
            <td></td>\
            </tr>';
    }
    else {
        Object.keys(jsonBlockInfo).forEach(blockNum => {
            let blockDate = new Date(jsonBlockInfo[blockNum].timestamp);
            let blockReward = jsonBlockInfo[blockNum].rewardAmount_sat / 1000000000;
            let blockStatus = jsonBlockInfo[blockNum].shareType;

            if ((now - blockDate) <= oneday) {
                blockRows[1][0] += 1; // blocks mined in 24 hours
            }
            else if ((now - blockDate) <= (oneday * 7)) {
                blockRows[1][1] += 1; // blocks mined last 7 days, less last 24 hours 
            }
            else if ((now - blockDate) <= (oneday * 30)) {
                blockRows[1][2] += 1; // blocks mined last 30 days, less last 7 days
                // be sure to add blockRows[1][1] and [1][0] to get last 30 days
            }

            if (blockStatus == 'round') {
                blockStatus = 'Pending';
            }
            else {
                blockStatus = 'Confirmed';
            }
            blockRows[0][blockInfoLength] = '<tr>\
                <td>' + blockNum + '</td>\
                <td>' + blockDate.toLocaleString('en-us')  + '</td>\
                <td>' + blockStatus + '</td>\
                <td>' + blockReward + '</td>\
                </tr>';
            blockInfoLength--;
        });
    }
    
    return blockRows;
}


var current_page = 1;
var records_per_page = 10;

getBlockInfo()
    .then((blockRows) => {
        // Last block mined
        var lastBlock = blockRows[0][0].split('<td>');
        document.getElementById('last-block').innerHTML = lastBlock[1];

        // Number of blocks in last 24 hours
        let lastDay = blockRows[1][0];
        document.getElementById('last-24').innerHTML = lastDay;

        // Number of blocks in last 7 days
        let sevenDays = blockRows[1][1] + lastDay;
        document.getElementById('last-7').innerHTML = sevenDays;

        // Number of blocks in last 30 days
        let thirtyDays = blockRows[1][2] + sevenDays;
        document.getElementById('last-30').innerHTML = thirtyDays;      
                    
        var htmlString = '<a href="javascript:prevPage()" id="btn_prev">Prev</a>\
        <a href="javascript:nextPage()" id="btn_next">Next</a>\
        page: <span id="page"></span>';

        document.getElementById('pageination').innerHTML = htmlString;
        changePage(1);
        return blockRows;
    });

function changePage(page){
        var btn_next = document.getElementById("btn_next");
        var btn_prev = document.getElementById("btn_prev");
        var listing_table = document.getElementById("block-table");
        var page_span = document.getElementById("page");
    
        // Validate page
        if (page < 1) page = 1;
        if (page > numPages()) page = numPages();

        listing_table.innerHTML = "";

        for (var i = (page-1) * records_per_page; i < (page * records_per_page) && i < blockRows[0].length; i++) {
            listing_table.innerHTML += blockRows[0][i];
        }
        page_span.innerHTML = page + "/" + numPages();

        if (page == 1) {
            btn_prev.style.visibility = "hidden";
        } else {
            btn_prev.style.visibility = "visible";
        }

        if (page == numPages()) {
            btn_next.style.visibility = "hidden";
        } else {
            btn_next.style.visibility = "visible";
        }
    }

function numPages(){
    return Math.ceil(blockRows[0].length / records_per_page);
}

function prevPage(){
    if (current_page > 1) {
        current_page--;
        changePage(current_page);
    }
}

function nextPage(){
    if (current_page < numPages()) {
        current_page++;
        changePage(current_page);
    }
}

