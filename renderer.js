// State
let topics = [];
let selectedTopic = null;
let isTrading = false;

// DOM Elements
const loadTopicsBtn = document.getElementById('loadTopicsBtn');
const executeBtn = document.getElementById('executeBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const settingsBtn = document.getElementById('settingsBtn');
const topicsList = document.getElementById('topicsList');
const logsContainer = document.getElementById('logsContainer');
const statusBar = document.getElementById('statusBar');
const signerAddress = document.getElementById('signerAddress');
const orderAmount = document.getElementById('orderAmount');
const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const orderAmountInput = document.getElementById('orderAmountInput');
const bearerTokenInput = document.getElementById('bearerTokenInput');

// Initialize
async function initialize() {
    const config = await window.electronAPI.getConfig();
    updateConfigDisplay(config);
    addLog('✅ Opinion Trade Bot 준비 완료', 'success');
}

function updateConfigDisplay(config) {
    signerAddress.textContent = `Signer: ${config.SIGNER_ADDRESS.substring(0, 10)}...${config.SIGNER_ADDRESS.substring(38)}`;
    orderAmount.textContent = `Order: ${config.ORDER_AMOUNT} USDT`;
    orderAmountInput.value = config.ORDER_AMOUNT;
}

// Logs
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

function clearLogs() {
    logsContainer.innerHTML = '';
    addLog('🗑️ 로그 삭제됨', 'info');
}

// Topics
async function loadTopics() {
    if (isTrading) {
        addLog('⚠️ 거래 진행 중에는 토픽을 로드할 수 없습니다', 'warning');
        return;
    }

    loadTopicsBtn.disabled = true;
    loadTopicsBtn.classList.add('loading');
    loadTopicsBtn.textContent = '로딩 중...';

    try {
        const result = await window.electronAPI.loadTopics(1, 20);

        if (result.success) {
            topics = result.topics;
            renderTopics();
            selectedTopic = null;
            executeBtn.disabled = true;
            statusBar.textContent = '토픽을 선택하세요';
        } else {
            addLog(`❌ 토픽 로드 실패: ${result.error}`, 'error');
            topics = [];
            renderEmptyState();
        }
    } catch (error) {
        addLog(`❌ 오류: ${error.message}`, 'error');
    } finally {
        loadTopicsBtn.disabled = false;
        loadTopicsBtn.classList.remove('loading');
        loadTopicsBtn.textContent = '🔄 토픽 로드';
    }
}

function renderTopics() {
    if (topics.length === 0) {
        renderEmptyState();
        return;
    }

    topicsList.innerHTML = '';

    topics.forEach((topic, index) => {
        const topicItem = document.createElement('div');
        topicItem.className = 'topic-item';
        topicItem.dataset.index = index;

        const childCount = topic.childList ? topic.childList.length : 0;
        const orderCount = childCount > 0 ? childCount * 2 : 2;

        topicItem.innerHTML = `
            <div class="topic-title">${topic.title || 'Untitled'}</div>
            <div class="topic-info">
                <span class="topic-id">ID: ${topic.topicId}</span>
                <span>📦 ${childCount}개 옵션</span>
                <span>📝 ${orderCount}개 주문</span>
                <span>💰 ${topic.volume || '0'}</span>
            </div>
        `;

        topicItem.addEventListener('click', () => selectTopic(index));
        topicsList.appendChild(topicItem);
    });
}

function renderEmptyState() {
    topicsList.innerHTML = `
        <div class="empty-state">
            <p>토픽을 찾을 수 없습니다</p>
        </div>
    `;
}

function selectTopic(index) {
    if (isTrading) {
        addLog('⚠️ 거래 진행 중에는 토픽을 변경할 수 없습니다', 'warning');
        return;
    }

    selectedTopic = topics[index];

    // Update UI
    document.querySelectorAll('.topic-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    executeBtn.disabled = false;

    const childCount = selectedTopic.childList ? selectedTopic.childList.length : 0;
    const orderCount = childCount > 0 ? childCount * 2 : 2;
    statusBar.textContent = `선택됨: ${selectedTopic.title} (${orderCount}개 주문 예정)`;

    addLog(`✅ 토픽 선택: ${selectedTopic.title} (topicId=${selectedTopic.topicId})`, 'success');
}

// Trading
async function executeTrading() {
    if (!selectedTopic) {
        addLog('⚠️ 토픽을 먼저 선택하세요', 'warning');
        return;
    }

    if (isTrading) {
        addLog('⚠️ 이미 거래가 진행 중입니다', 'warning');
        return;
    }

    isTrading = true;
    executeBtn.disabled = true;
    loadTopicsBtn.disabled = true;
    executeBtn.classList.add('loading');
    executeBtn.textContent = '거래 진행 중...';
    statusBar.textContent = '거래 진행 중...';

    try {
        const result = await window.electronAPI.executeTrading(selectedTopic);

        if (result.success) {
            statusBar.textContent = `완료: 성공 ${result.successCount}/${result.totalOrders}, 실패 ${result.failCount}/${result.totalOrders}`;
        } else {
            statusBar.textContent = '거래 실패';
        }
    } catch (error) {
        addLog(`❌ 거래 실행 오류: ${error.message}`, 'error');
        statusBar.textContent = '오류 발생';
    } finally {
        isTrading = false;
        executeBtn.disabled = false;
        loadTopicsBtn.disabled = false;
        executeBtn.classList.remove('loading');
        executeBtn.textContent = '🚀 거래 시작';
    }
}

// Settings Modal
function openSettings() {
    settingsModal.classList.add('show');
}

function closeSettings() {
    settingsModal.classList.remove('show');
}

async function saveSettings() {
    const newOrderAmount = parseFloat(orderAmountInput.value);
    const newBearerToken = bearerTokenInput.value.trim();

    if (isNaN(newOrderAmount) || newOrderAmount <= 0) {
        addLog('❌ 주문 금액은 0보다 커야 합니다', 'error');
        return;
    }

    const config = {
        ORDER_AMOUNT: newOrderAmount
    };

    if (newBearerToken) {
        config.BEARER_TOKEN = newBearerToken;
    }

    try {
        await window.electronAPI.updateConfig(config);

        const updatedConfig = await window.electronAPI.getConfig();
        updateConfigDisplay(updatedConfig);

        closeSettings();
        addLog('✅ 설정 저장 완료', 'success');
    } catch (error) {
        addLog(`❌ 설정 저장 실패: ${error.message}`, 'error');
    }
}

// Event Listeners
loadTopicsBtn.addEventListener('click', loadTopics);
executeBtn.addEventListener('click', executeTrading);
clearLogsBtn.addEventListener('click', clearLogs);
settingsBtn.addEventListener('click', openSettings);
saveSettingsBtn.addEventListener('click', saveSettings);

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', closeSettings);
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettings();
    }
});

// Listen for logs from main process
window.electronAPI.onLog((data) => {
    addLog(data.message, data.type);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+R or F5: Reload topics
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        if (!isTrading) {
            loadTopics();
        }
    }

    // Enter: Execute trading
    if (e.key === 'Enter' && selectedTopic && !isTrading) {
        executeTrading();
    }

    // Escape: Close modal
    if (e.key === 'Escape') {
        closeSettings();
    }

    // Ctrl+L: Clear logs
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        clearLogs();
    }
});

// Initialize on load
initialize();
