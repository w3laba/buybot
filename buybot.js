const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const app = express();
const config = require("./config.json");

const bot = new TelegramBot(config.botToken, {polling: true});

const subscriptionRequest = {
  id: 1,
  jsonrpc: '2.0',
  method: 'subscribe_account',
  params: [
    config.LISTEN_ADDRESS,
  ],
};

function main() {
  let ws = new WebSocket(config.TONAPI_WS_URL, options);
  ws.on('open', () => {
    console.log('Connected to TonAPI WebSocket server');
    ws.send(JSON.stringify(subscriptionRequest));
  });

  ws.on('message', async (message) => {
    try {
      const response = JSON.parse(message);
      if (response.method === 'account_transaction') {
        console.log('Received transaction:', response.params);
        const transactionHash = response.params.tx_hash;
        const tonApiUrl = `https://tonapi.io/v2/blockchain/transactions/${transactionHash}`;
        const rateApiUrl = `https://tonapi.io/v2/rates?tokens=ton&currencies=usd`;
        const jettonApiUrl = `https://tonapi.io/v2/accounts/${config.LISTEN_ADDRESS}`;
        try {
          const [tonData, rateData, tonJetton] = await Promise.all([
            fetchDataWithRetry(tonApiUrl, options),
            fetchDataWithRetry(rateApiUrl, options),
            fetchDataWithRetry(jettonApiUrl, options)
          ]);
          const tonJettonBalance = tonJetton.balance;
          const tonTransferredNano = tonData.in_msg.value;
          const accountAddress = tonData.in_msg.source.address;
          const tonTransferred = tonTransferredNano / Math.pow(10, 9);
          const tonValue = tonJettonBalance / Math.pow(10, 9);

          const tonToUsdRate = rateData.rates.TON.prices.USD;
          const transferredUsd = tonTransferred * tonToUsdRate;

          bot.sendVideo(config.chatId, config.buyBotVideo, {
            caption: caption,
            parse_mode: "Markdown"
          }).then(() => {
            console.log('Message sent successfully');
          }).catch(error => {
            console.error('Error in sending message:', error);
          });
        } catch (error) {
          console.error('Failed to fetch data or rates after retrying:', error);
        }
      }
    } catch (error) {
      console.error('Error parsing TonAPI message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from TonAPI WebSocket server');
    setTimeout(main, 5000);
    console.log('Reconnect...');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    setTimeout(main, 5000);
    console.log('Reconnect...');
  });
}

main();

const port = 3080;
app.listen(port, () => {
  console.log(`Server start on port ${port}`);
});
