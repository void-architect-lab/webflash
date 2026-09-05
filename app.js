import { Transport, ESPLoader } from 'https://unpkg.com/esptool-js@0.6.1/bundle.js';

if (!("serial" in navigator)) {
    document.getElementById("browserWarning").style.display = "block";
} else {
    document.getElementById("browserWarning").style.display = "none";
}

let port;
let reader;
let keepReading = true;
let selectedFile = null;
let readLoopPromise;

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const baudRateSelect = document.getElementById('baudRate');
const terminal = document.getElementById('terminal');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const serialInput = document.getElementById('serialInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileInfo = document.getElementById('fileInfo');
const flashBtn = document.getElementById('flashBtn');
const progressBar = document.getElementById('progressBar');
const flashStatus = document.getElementById('flashStatus');
const globalStatus = document.getElementById('globalStatus');
const eraseAllCheckbox = document.getElementById('eraseAllCheckbox'); // <-- NEW

// --- UI STATUS UTILS ---
function showStatus(msg, type = 'error') {
    globalStatus.innerHTML = msg;
    globalStatus.className = `status-banner ${type}`;
    setTimeout(() => {
        globalStatus.className = 'status-banner hidden';
    }, 6000);
}

navigator.serial.addEventListener("disconnect", (event) => {
    if (port && event.target === port) {
        handleAbruptDisconnect();
    }
});

async function handleAbruptDisconnect() {
    showStatus("🔌 Device disconnected abruptly.", "error");
    keepReading = false;
    
    if (reader) await reader.cancel().catch(() => {});
    if (readLoopPromise) await readLoopPromise.catch(() => {});
    port = null;
    
    toggleUIState(false);
}

// --- SERIAL MONITOR LOGIC ---
async function connect() {
    try {
        port = await navigator.serial.requestPort();
        const baudRate = parseInt(baudRateSelect.value);
        await port.open({ baudRate: baudRate });

        toggleUIState(true);
        keepReading = true;
        readLoopPromise = readLoop();
        showStatus("✅ Connected to device.", "success");
    } catch (e) {
        console.error(e);
        if (e.name === 'SecurityError' || e.message.includes('Permission denied')) {
            showStatus("❌ Permission Denied: Another program is using the port.", "error");
        } else if (e.name === 'NotFoundError') {
            // User cancelled the prompt, do nothing.
        } else {
            showStatus(`❌ Connection failed: ${e.message}`, "error");
        }
    }
}

async function disconnect() {
    keepReading = false;
    
    if (reader) await reader.cancel().catch(() => {});
    if (readLoopPromise) await readLoopPromise.catch(() => {});
    if (port) await port.close().catch(() => {});
    
    port = null;
    toggleUIState(false);
}

async function readLoop() {
    while (port && port.readable && keepReading) {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    terminal.value += value;
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }
        } catch (error) {
            if (error.name !== 'NetworkError' && error.name !== 'BreakError') {
                console.error("Read loop error:", error);
            }
        } finally {
            reader.releaseLock();
        }
        await readableStreamClosed.catch(() => {});
    }
}

async function sendData() {
    if (!port || !port.writable) return;
    try {
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        const writer = textEncoder.writable.getWriter();
        
        await writer.write(serialInput.value + "\r\n");
        await writer.close();
        serialInput.value = '';
    } catch (e) {
        showStatus("❌ Failed to send command to device.", "error");
    }
}

// --- FILE HANDLING ---
function handleFileSelect(file) {
    if (!file || !file.name.endsWith('.bin')) {
        showStatus("❌ Please select a valid .bin firmware file.", "error");
        return;
    }
    selectedFile = file;
    fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    if (port) flashBtn.disabled = false;
}

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

// --- FLASH LOGIC (ESPTOOL) ---
async function flashFirmware() {
    if (!selectedFile || !port) return;

    keepReading = false;
    if (reader) await reader.cancel().catch(() => {});
    if (readLoopPromise) await readLoopPromise.catch(() => {});
    if (port) await port.close().catch(() => {});

    flashBtn.disabled = true;
    flashStatus.textContent = "Initializing esptool...";
    progressBar.style.backgroundColor = 'var(--accent-blue)';
    progressBar.style.width = "0%";

    let transport;
    try {
        const fileBuffer = await selectedFile.arrayBuffer();
        transport = new Transport(port, true);

        const loaderOptions = {
            transport: transport,
            baudrate: 230400, 
            terminal: {
                clean: () => { terminal.value = ''; },
                writeLine: (data) => {
                    terminal.value += data + '\n';
                    terminal.scrollTop = terminal.scrollHeight;
                },
                write: (data) => {
                    terminal.value += data;
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }
        };

        const esploader = new ESPLoader(loaderOptions);

        const chipName = await esploader.main();
        flashStatus.textContent = `Connected to ${chipName}. Erasing & Flashing...`;

        await esploader.writeFlash({
            fileArray: [{ data: new Uint8Array(fileBuffer), address: 0x10000 }],
            flashSize: 'keep',
            eraseAll: eraseAllCheckbox.checked, // <-- Maps UI state to esptool
            compress: true,
            reportProgress: (fileIndex, written, total) => {
                const progress = (written / total) * 100;
                progressBar.style.width = `${progress}%`;
                flashStatus.textContent = `Writing: ${progress.toFixed(1)}%`;
            }
        });

        progressBar.style.backgroundColor = 'var(--success-green)';
        progressBar.style.width = "100%";
        flashStatus.innerHTML = "✅ <strong>Flash complete!</strong> Reconnecting monitor...";

    } catch (error) {
        console.error(error);
        progressBar.style.backgroundColor = 'var(--danger-red)';
        flashStatus.innerHTML = `❌ <strong>Flash failed:</strong> ${error.message}`;
        showStatus("❌ Flash process failed.", "error");
    } finally {
        flashBtn.disabled = false;
        if (transport) await transport.disconnect().catch(() => {});
        if (port) {
            try {
                await port.open({ baudRate: parseInt(baudRateSelect.value) });
                keepReading = true;
                readLoopPromise = readLoop();
            } catch (e) {
                console.log("Could not auto-reconnect monitor:", e);
            }
        }
    }
}

// --- UTILS & LISTENERS ---
function toggleUIState(connected) {
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    serialInput.disabled = !connected;
    sendBtn.disabled = !connected;
    if (selectedFile) flashBtn.disabled = !connected;
    if (!connected) {
        progressBar.style.width = "0%";
        flashStatus.textContent = "";
    }
}

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
sendBtn.addEventListener('click', sendData);
serialInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendData(); });
clearBtn.addEventListener('click', () => terminal.value = '');
flashBtn.addEventListener('click', flashFirmware);

downloadBtn.addEventListener('click', () => {
    const blob = new Blob([terminal.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webflash_log_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});
