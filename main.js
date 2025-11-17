import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// 설정
// ===============================

const OPINION_HOST = "https://proxy.opinion.trade:8443";

let config = {
    BEARER_TOKEN: process.env.BEARER_TOKEN || "",
    DEVICE_FINGERPRINT: process.env.DEVICE_FINGERPRINT || "",
    SIGNER_ADDRESS: process.env.SIGNER_ADDRESS || "",
    MAKER_ADDRESS: process.env.MAKER_ADDRESS || "",
    PRIVATE_KEY: process.env.PRIVATE_KEY || "",
    ORDER_AMOUNT: parseFloat(process.env.ORDER_AMOUNT || "5.0")
};

// 필수 설정 검증
function validateConfig() {
    const required = ['BEARER_TOKEN', 'DEVICE_FINGERPRINT', 'SIGNER_ADDRESS', 'MAKER_ADDRESS', 'PRIVATE_KEY'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
        console.error('❌ 다음 환경 변수가 설정되지 않았습니다:', missing.join(', '));
        console.error('💡 .env 파일을 생성하고 필수 값을 입력하세요.');
        process.exit(1);
    }
}

const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

// ===============================
// EIP-712 설정
// ===============================

const EIP712_DOMAIN = {
    name: "OPINION CTF Exchange",
    version: "1",
    chainId: 56,
    verifyingContract: "0x5f45344126d6488025b0b84a3a8189f2487a7246"
};

const EIP712_TYPES = {
    Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "feeRateBps", type: "uint256" },
        { name: "side", type: "uint8" },
        { name: "signatureType", type: "uint8" }
    ]
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const Side = {
    BUY: 0,
    SELL: 1
};

const SignatureType = {
    POLY_GNOSIS_SAFE: 2
};

// ===============================
// Electron Window
// ===============================

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // 개발시 디버깅용
}

validateConfig();

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ===============================
// 유틸리티 함수
// ===============================

function buildHeaders() {
    return {
        "accept": "application/json, text/plain, */*",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "authorization": `Bearer ${config.BEARER_TOKEN}`,
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-device-fingerprint": config.DEVICE_FINGERPRINT,
        "x-device-kind": "web",
        "Referer": "https://app.opinion.trade/"
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendLog(message, type = 'info') {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log', { message, type });
    }
}

// ===============================
// Order Builder
// ===============================

function calculateOrderAmounts(side, amountUsdt, price) {
    const priceFloat = parseFloat(price);
    if (priceFloat <= 0) {
        throw new Error("Price must be greater than 0");
    }

    const amountWei = ethers.parseUnits(amountUsdt.toString(), 18);
    const shares = amountUsdt / priceFloat;
    const sharesWei = ethers.parseUnits(shares.toFixed(18), 18);

    let makerAmount, takerAmount;

    if (side === Side.BUY) {
        makerAmount = amountWei;
        takerAmount = sharesWei;
    } else {
        makerAmount = sharesWei;
        takerAmount = amountWei;
    }

    return {
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString()
    };
}

function createOrder(params) {
    const {
        maker,
        signer,
        tokenId,
        makerAmount,
        takerAmount,
        side,
        expiration = '0',
        feeRateBps = '0'
    } = params;

    const salt = Date.now().toString();

    const order = {
        salt,
        maker: maker.toLowerCase(),
        signer: signer.toLowerCase(),
        taker: ZERO_ADDRESS,
        tokenId,
        makerAmount,
        takerAmount,
        expiration,
        nonce: '0',
        feeRateBps,
        side,
        signatureType: SignatureType.POLY_GNOSIS_SAFE
    };

    return order;
}

async function signOrder(wallet, order) {
    try {
        const signature = await wallet.signTypedData(
            EIP712_DOMAIN,
            EIP712_TYPES,
            order
        );

        return {
            ...order,
            signature
        };
    } catch (error) {
        throw new Error(`Failed to sign order: ${error.message}`);
    }
}

async function buildSignedOrder(wallet, orderParams) {
    const order = createOrder(orderParams);
    const signedOrder = await signOrder(wallet, order);
    return signedOrder;
}

function buildApiPayload(signedOrder, topicId, price) {
    // ✅ 이미 정규화된 문자열을 받으므로 추가 처리 제거
    const payload = {
        topicId: parseInt(topicId),
        contractAddress: "",
        price: price,  // 이미 정규화된 문자열
        tradingMethod: 2,
        salt: signedOrder.salt,
        maker: signedOrder.maker,
        signer: signedOrder.signer,
        taker: signedOrder.taker,
        tokenId: signedOrder.tokenId,
        makerAmount: signedOrder.makerAmount,
        takerAmount: signedOrder.takerAmount,
        expiration: signedOrder.expiration,
        nonce: signedOrder.nonce,
        feeRateBps: signedOrder.feeRateBps,
        side: signedOrder.side.toString(),
        signatureType: signedOrder.signatureType.toString(),
        signature: signedOrder.signature,
        timestamp: Math.floor(Date.now() / 1000),
        sign: signedOrder.signature,
        safeRate: "0.05",
        orderExpTime: signedOrder.expiration,
        currencyAddress: USDT_ADDRESS,
        chainId: 56
    };

    return payload;
}
// ===============================
// HTTP 함수
// ===============================

async function fetchTopics(page, limit) {
    const url = new URL(`${OPINION_HOST}/api/bsc/api/v2/topic`);
    url.searchParams.append("page", page);
    url.searchParams.append("limit", limit);
    url.searchParams.append("sortBy", "1");
    url.searchParams.append("chainId", "56");
    url.searchParams.append("status", "2");
    url.searchParams.append("isShow", "1");
    url.searchParams.append("topicType", "2");
    url.searchParams.append("indicatorType", "2");

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: buildHeaders()
    });

    return response;
}

async function createOrderData(topicId, side, amountUsdt, privateKey, tokenId, price) {
    const wallet = new ethers.Wallet(privateKey);
    const signerFromPk = wallet.address;

    if (signerFromPk.toLowerCase() !== config.SIGNER_ADDRESS.toLowerCase()) {
        throw new Error(
            `PRIVATE_KEY 주소(${signerFromPk})가 SIGNER_ADDRESS(${config.SIGNER_ADDRESS})와 다릅니다.`
        );
    }

    // ✅ safeRate를 price에 적용 (BUY 시 조금 높게 제시)
    const safeRate = 0.05;
    let priceFloat = parseFloat(price);

    // BUY 주문이면 5% 더 높은 가격 제시
    priceFloat = priceFloat * (1 + safeRate);

    // 가격은 최대 0.999까지만
    if (priceFloat > 0.999) priceFloat = 0.999;

    priceFloat = Math.round(priceFloat * 1000) / 1000;
    const priceStr = priceFloat.toString();

    const { makerAmount, takerAmount } = calculateOrderAmounts(
        side,
        amountUsdt,
        priceFloat
    );

    const orderParams = {
        maker: config.MAKER_ADDRESS,
        signer: config.SIGNER_ADDRESS,
        tokenId: tokenId,
        makerAmount: makerAmount,
        takerAmount: takerAmount,
        side: side,
        expiration: '0',
        feeRateBps: '0'
    };

    const signedOrder = await buildSignedOrder(wallet, orderParams);
    const orderData = buildApiPayload(signedOrder, topicId, priceStr);

    return orderData;
}


async function placeOrder(topicId, side, amount, privateKey, tokenId, price) {
    const url = `${OPINION_HOST}/api/bsc/api/v2/order`;

    const headers = {
        ...buildHeaders(),
        "content-type": "application/json"
    };

    const orderData = await createOrderData(
        topicId,
        side,
        amount,
        privateKey,
        tokenId,
        price
    );

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(orderData)
    });

    return response;
}

// ===============================
// IPC Handlers
// ===============================

ipcMain.handle('load-topics', async (event, page, limit) => {
    sendLog(`🔎 토픽 로딩 중... (page=${page}, limit=${limit})`, 'info');

    try {
        const resp = await fetchTopics(page, limit);

        if (resp.status === 401) {
            sendLog("❌ 401 Unauthorized - BEARER_TOKEN 만료", 'error');
            return { success: false, error: "BEARER_TOKEN 만료" };
        }

        const data = await resp.json();

        if (data.errno !== 0) {
            sendLog(`❌ API 오류: ${data.errmsg}`, 'error');
            return { success: false, error: data.errmsg };
        }

        const result = data.result || {};
        const topics = result.list || [];

        sendLog(`✅ ${topics.length}개 토픽 로드 완료`, 'success');
        return { success: true, topics };
    } catch (error) {
        sendLog(`❌ HTTP 요청 실패: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
});

ipcMain.handle('execute-trading', async (event, selectedTopic) => {
    const topicId = selectedTopic.topicId;
    const title = selectedTopic.title || "";
    let childList = selectedTopic.childList || [];

    if (childList.length === 0) {
        childList = [selectedTopic];
    }

    sendLog(`\n${"=".repeat(60)}`, 'info');
    sendLog(`💰 거래 시작: ${title} (topicId=${topicId})`, 'info');
    sendLog(`   ${childList.length}개 옵션 × 2 (YES/NO) = ${childList.length * 2}개 주문`, 'info');
    sendLog(`   주문 금액: ${config.ORDER_AMOUNT} USDT`, 'info');
    sendLog(`${"=".repeat(60)}\n`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (let idx = 0; idx < childList.length; idx++) {
        const child = childList[idx];
        const childTopicId = child.topicId;
        const childTitle = child.title || "";
        const yesPos = child.yesPos || "";
        const noPos = child.noPos || "";
        const yesBuyPrice = child.yesBuyPrice || "0.001";
        const noBuyPrice = child.noBuyPrice || "0.001";

        sendLog(`\n[${idx + 1}/${childList.length}] ${childTitle} (topicId=${childTopicId})`, 'info');

        // YES 주문
        if (yesPos) {
            sendLog(`  → YES 주문 (${config.ORDER_AMOUNT} USDT, price=${yesBuyPrice})...`, 'info');
            try {
                const respYes = await placeOrder(
                    childTopicId,
                    Side.BUY,
                    config.ORDER_AMOUNT,
                    config.PRIVATE_KEY,
                    yesPos,
                    yesBuyPrice
                );

                if (respYes.status === 200) {
                    const dataYes = await respYes.json();
                    if (dataYes.errno === 0) {
                        const orderId = dataYes.result?.orderData?.orderId;
                        sendLog(`     ✅ YES 성공 (orderId=${orderId})`, 'success');
                        successCount++;
                    } else {
                        sendLog(`     ❌ YES 실패: ${dataYes.errmsg}`, 'error');
                        failCount++;
                    }
                } else {
                    const text = await respYes.text();
                    sendLog(`     ❌ YES HTTP ${respYes.status}: ${text.substring(0, 100)}`, 'error');
                    failCount++;
                }
            } catch (error) {
                sendLog(`     ❌ YES 예외: ${error.message}`, 'error');
                failCount++;
            }

            await sleep(500);
        } else {
            sendLog("  ⚠️ YES: yesPos 없음, 스킵", 'warning');
            failCount++;
        }

        // NO 주문
        if (noPos) {
            sendLog(`  → NO 주문 (${config.ORDER_AMOUNT} USDT, price=${noBuyPrice})...`, 'info');
            try {
                const respNo = await placeOrder(
                    childTopicId,
                    Side.BUY,
                    config.ORDER_AMOUNT,
                    config.PRIVATE_KEY,
                    noPos,
                    noBuyPrice
                );

                if (respNo.status === 200) {
                    const dataNo = await respNo.json();
                    if (dataNo.errno === 0) {
                        const orderId = dataNo.result?.orderData?.orderId;
                        sendLog(`     ✅ NO 성공 (orderId=${orderId})`, 'success');
                        successCount++;
                    } else {
                        sendLog(`     ❌ NO 실패: ${dataNo.errmsg}`, 'error');
                        failCount++;
                    }
                } else {
                    const text = await respNo.text();
                    sendLog(`     ❌ NO HTTP ${respNo.status}: ${text.substring(0, 100)}`, 'error');
                    failCount++;
                }
            } catch (error) {
                sendLog(`     ❌ NO 예외: ${error.message}`, 'error');
                failCount++;
            }

            await sleep(500);
        } else {
            sendLog("  ⚠️ NO: noPos 없음, 스킵", 'warning');
            failCount++;
        }
    }

    const totalOrders = childList.length * 2;
    sendLog(`\n${"=".repeat(60)}`, 'info');
    sendLog(`🏁 거래 완료: 성공 ${successCount}/${totalOrders}, 실패 ${failCount}/${totalOrders}`, 'info');
    sendLog(`${"=".repeat(60)}\n`, 'info');

    return {
        success: true,
        successCount,
        failCount,
        totalOrders
    };
});

ipcMain.handle('get-config', async () => {
    return {
        SIGNER_ADDRESS: config.SIGNER_ADDRESS,
        MAKER_ADDRESS: config.MAKER_ADDRESS,
        ORDER_AMOUNT: config.ORDER_AMOUNT
    };
});

ipcMain.handle('update-config', async (event, newConfig) => {
    if (newConfig.ORDER_AMOUNT !== undefined) {
        config.ORDER_AMOUNT = parseFloat(newConfig.ORDER_AMOUNT);
    }
    if (newConfig.BEARER_TOKEN !== undefined) {
        config.BEARER_TOKEN = newConfig.BEARER_TOKEN;
    }
    sendLog('✅ 설정 업데이트 완료', 'success');
    return { success: true };
});
