# WebFlash ⚡

**Live App:** [https://webflash1.pages.dev/](https://webflash1.pages.dev/)

A browser-based firmware flasher and serial monitor for ESP8266 and ESP32 boards. Built entirely on standard web technologies (Web Serial API). **No IDE, no Python, no drivers required.**

## Features
- 🌐 **Zero-Install:** Runs entirely in Google Chrome or Microsoft Edge desktop browsers.
- ⚡ **Direct Flashing:** Drag and drop `.bin` files directly to your board.
- 🔍 **Serial Monitor:** Integrated monitor with auto-scroll and `.txt` export.
- 🎯 **Custom Offsets:** Supports custom hex offsets (e.g., `0x1000` for MicroPython, `0x10000` for standard apps).
- 🧹 **Erase Flash:** 1-click full chip erasure before writing.

## Usage
1. Connect your ESP32 to your computer via USB.
2. Open [WebFlash](https://webflash1.pages.dev/) in Chrome/Edge.
3. Click **Connect** and select your serial port.
4. Drag a `.bin` file into the flash zone.
5. Set your offset (default `0x10000`) and click **Flash to ESP32**.

*(Note: Depending on your specific dev board's auto-reset circuitry, you may need to hold the BOOT button and tap EN to enter flash mode).*

## Local Development
This is a pure static site. No node modules or build steps required.

git clone https://github.com/void-architect-lab/webflash.git
cd webflash
python3 -m http.server 8000

## License
MIT License - Free for use, modification, and distribution.
