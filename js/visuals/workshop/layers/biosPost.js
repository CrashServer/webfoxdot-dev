// ── BIOS / Boot Sequence ──────────────────────────────────────────────────────
// Phosphor-terminal boot text: classic BIOS POST, Linux dmesg, or UEFI splash.
// Lines scroll up at configurable speed; bass causes screen flicker + character
// corruption; treble drives individual character glitching in displayed text.

const _st = new WeakMap();

// ── Line pools ────────────────────────────────────────────────────────────────
const BIOS_LINES = [
    "Phoenix AwardBIOS v6.00PG, An Energy Star Ally",
    "Copyright (C) 1984-2001, Award Software, Inc.",
    "",
    "Board: ASUS P4B533-V  ACPI BIOS Rev 1006",
    "",
    "Main Processor  : Intel Pentium 4  2.40GHz (100x24.0)",
    "Memory Testing  : 1048576K OK",
    "",
    "IDE Channel 0 Master: WDC WD800BB-00DKA0  (76319MB)",
    "IDE Channel 0 Slave : NONE",
    "IDE Channel 1 Master: ASUS CD-S500/A       ATAPI",
    "IDE Channel 1 Slave : NONE",
    "",
    "Auto-Detecting USB Mass Storage Device ...",
    "USB Mass Storage Device : NOT FOUND",
    "",
    "Verifying DMI Pool Data ........... Updated",
    "",
    "PCI device listing ...",
    "Bus No  Device No  Func No  Vendor/Device Class  IRQ",
    " 0       0          0       8086 2532  Host Bridge",
    " 0       1          0       8086 2533  PCI-to-AGP",
    " 0       1          1       8086 2534  PCI bridge",
    " 0      30          0       8086 2448  PCI-to-PCI",
    " 0      31          0       8086 2447  ISA Bridge",
    " 0      31          1       8086 2448  IDE Controller       14",
    " 0      31          2       8086 2449  USB Host Controller   5",
    " 1       0          0       10DE 0253  VGA compatible       11",
    "",
    "ACPI: RSDP located at physical address 000FFEA0",
    "ACPI: RSDT located at physical address 3FFD0000",
    "",
    "Plug and Play OS/1.2 found",
    "PNP Init Completed",
    "",
    "8042 error: timeout on A20 toggle",
    "Starting Operating System ...",
    "",
];

const LINUX_LINES = [
    "[    0.000000] Linux version 5.15.0-91-generic (buildd@lcy02) #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023",
    "[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-5.15.0-91-generic root=/dev/sda1 ro quiet splash",
    "[    0.000000] BIOS-provided physical RAM map:",
    "[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable",
    "[    0.000000] BIOS-e820: [mem 0x0000000000100000-0x000000007ffeffff] usable",
    "[    0.000000] ACPI: RSDP 0x00000000000F05B0 000024 (v02 BOCHS )",
    "[    0.000000] ACPI: RSDT 0x000000007FFE167F 000034 (v01 BOCHS  BXPC     00000001 BXPC 00000001)",
    "[    0.000000] No NUMA configuration found",
    "[    0.000000] Kernel command line: root=/dev/sda1 ro quiet splash",
    "[    0.003786] clocksource: hpet: mask: 0xffffffff max_cycles: 0xffffffff, max_idle_ns: 19112604467 ns",
    "[    0.009123] NET: Registered PF_NETLINK/PF_ROUTE protocol family",
    "[    0.012890] ACPI: bus type PCI registered",
    "[    0.016222] PCI: PCI BIOS revision 2.10 entry at 0xfd5b0, last bus=0",
    "[    0.019451] ACPI: Added _OSI(Module Device)",
    "[    0.023108] ACPI: Added _OSI(Processor Device)",
    "[    0.031567] clocksource: tsc-early: mask: 0xffffffffffffffff max_cycles: 0x323b2bbc6a4",
    "[    0.126934] MDS: Mitigation: Clear CPU buffers",
    "[    0.201455] RAS: Correctable Errors collector initialized.",
    "[    0.334891] audit: type=1400 audit(0.000:2): apparmor=\"STATUS\"",
    "[    0.445123] SCSI subsystem initialized",
    "[    0.567890] usbcore: registered new interface driver usbfs",
    "[    0.678901] PCI: Using ACPI for IRQ routing",
    "[    0.789012] NET: Registered PF_INET protocol family",
    "[    0.890123] input: AT Translated Set 2 keyboard as /devices/platform/i8042/serio0/input/input0",
    "[    1.001234] EXT4-fs (sda1): mounted filesystem with ordered data mode. Opts: (null). Quota mode: none.",
    "[    1.123456] systemd[1]: System time before build time, advancing clock.",
    "[    1.234567] systemd[1]: Detected virtualization kvm.",
    "[    1.345678] systemd[1]: Detected architecture x86-64.",
    "[    1.456789] systemd[1]: Started Journal Service.",
    "[    1.567890] systemd[1]: Started Load Kernel Modules.",
    "[    1.678901] systemd[1]: Starting Remount Root and Kernel File Systems...",
    "[    1.789012] systemd[1]: Starting Network Time Synchronization...",
    "[    2.000000] systemd[1]: Reached target Basic System.",
    "[    2.100000] systemd[1]: Reached target Login Prompts.",
    "[    2.200000] systemd[1]: Started Login Service.",
    "[    2.300000] Started NVIDIA Persistence Daemon.",
    "[    2.400000] nvidia 0000:01:00.0: enabling device (0000 -> 0003)",
    "[    2.500000] NVRM: loading NVIDIA UNIX x86_64 Kernel Module 535.129.03 Thu Nov 02 2023",
    "[    2.600000] ACPI Error: Method parse/execution failed \\_SB.PCI0.GPP8._PRT",
    "[    2.700000] systemd[1]: Reached target Graphical Interface.",
    "[    2.800000] audit[1234]: SERVICE_START pid=1 comm=\"systemd\" exe=\"/lib/systemd/systemd\"",
    "[    3.100000] ♪  workshop[$$$$]: audio subsystem online",
    "[    3.200000] ♪  workshop[$$$$]: GPU canvas ready",
    "[    3.300000] ♪  workshop[$$$$]: LIVE SESSION STARTED",
    "",
];

const UEFI_LINES = [
    "TianoCore EFI v2.80 (EDK II, 0xA0000C)  Build: Nov  8 2023 15:04:22",
    "",
    "Copyright (c) 2021 TianoCore.  All rights reserved.",
    "",
    "BIOS Date: 11/08/2023 15:04:22 Ver: 05.06.05",
    "Access Level: Administrator",
    "",
    "[Boot]: Memory Initialization ...",
    "[Boot]: Detected 4 DIMMs (DDR5-6000)",
    "[Boot]: Total System Memory: 32768MB",
    "[Boot]: XMP Profile 1 Enabled (6000MHz)",
    "",
    "[Post]: CPU Identification",
    "[Post]: Processor: AMD Ryzen 9 7950X",
    "[Post]: Family: 19h  Model: 61h  Stepping: 2h",
    "[Post]: Max Speed: 5700 MHz",
    "[Post]: Physical Cores: 16  Logical: 32",
    "[Post]: L3 Cache: 64MB",
    "",
    "[Secure]: Platform Key enrolled",
    "[Secure]: Secure Boot Active",
    "",
    "[PCIe]: Enumerating devices ...",
    "[PCIe]: 0000:01:00.0 NVIDIA RTX 4090  (PCIe 4.0 x16)",
    "[PCIe]: 0000:02:00.0 Samsung 990 Pro   (PCIe 5.0 x4 NVMe)",
    "[PCIe]: 0000:03:00.0 Intel AX211       (PCIe 3.0 x1 WiFi6E)",
    "[PCIe]: 0000:04:00.0 Realtek ALC4080   (USB Audio)",
    "",
    "[UEFI]: Looking for boot devices ...",
    "[UEFI]: Found: SAMSUNG MZQL21T9HCJR-00A07  1.92TB",
    "[UEFI]: Boot Manager: Loading  ubuntu\\shimx64.efi",
    "",
    "                             LOADING",
    "",
];

const GLITCH_CHARS = "!@#$%^&*<>[]{};:,.?/|\\~`+=_-0123456789ABCDEF";

export const biosPostParams = () => ({
    style:    { base: 0,    min: 0,   max: 2,   step: 1,  mod: { source: "" } }, // 0=BIOS,1=Linux,2=UEFI
    speed:    { base: 1.0,  min: 0.1, max: 6,             mod: { source: "" } }, // lines/sec
    fontSize: { base: 14,   min: 8,   max: 22,  step: 1,  mod: { source: "" } },
    hue:      { base: 120,  min: 0,   max: 360,           mod: { source: "" } }, // 120=green,40=amber
    glitch:   { base: 0.15, min: 0,   max: 1,             mod: { source: "" } },
    scanlines:{ base: 0.25, min: 0,   max: 1,             mod: { source: "" } },
    flicker:  { base: 0.2,  min: 0,   max: 1,             mod: { source: "" } },
    bgLight:  { base: 4,    min: 0,   max: 20,  step: 1,  mod: { source: "" } }, // background phosphor glow
});

export function drawBiosPost(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const style    = Math.round(Math.max(0, Math.min(2, p.style ?? 0)));
    const speed    = (p.speed ?? 1.0) * (1 + bass * 0.4);
    const fs       = Math.max(8, Math.round(p.fontSize ?? 14));
    const hue      = p.hue ?? 120;
    const glitch   = p.glitch ?? 0.15;
    const scanAmt  = p.scanlines ?? 0.25;
    const flicker  = p.flicker ?? 0.2;
    const bgLight  = p.bgLight ?? 4;

    const pool = style === 1 ? LINUX_LINES : style === 2 ? UEFI_LINES : BIOS_LINES;
    const lineH = Math.round(fs * 1.45);
    const visLines = Math.ceil(h / lineH) + 1;

    let st = _st.get(ctx);
    if (!st || st.style !== style) {
        st = { style, scroll: 0, lastT: t, seed: 42 };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT);
    st.lastT = t;
    st.scroll += speed * dt;

    // Phosphor background
    const flickerAlpha = flicker > 0 ? 1 - flicker * bass * 0.7 : 1;
    ctx.fillStyle = `hsl(${hue},60%,${bgLight}%)`;
    ctx.fillRect(0, 0, w, h);

    const font = `${fs}px "Courier New", Courier, monospace`;
    ctx.font = font;
    ctx.textBaseline = "top";

    // Seed-based character substitution for consistent-per-frame glitch
    let lcg = (st.seed ^ Math.floor(t * 30)) >>> 0;
    const rng = () => { lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; return lcg / 0x100000000; };

    const topLine = Math.floor(st.scroll);
    const subPx   = (st.scroll % 1) * lineH;

    ctx.save();
    ctx.globalAlpha = flickerAlpha;

    for (let row = 0; row < visLines; row++) {
        const poolIdx = (topLine + row) % pool.length;
        let line = pool[poolIdx];

        const y = row * lineH - subPx;
        if (y > h) break;

        // Per-row glitch: occasionally scramble some characters
        const rowGlitch = glitch * (0.3 + treble * 0.7);
        if (rowGlitch > 0.01 && rng() < rowGlitch * 0.15 && line.length > 0) {
            const ca = [...line];
            const nCorrupt = Math.floor(rng() * 4) + 1;
            for (let c = 0; c < nCorrupt; c++) {
                const ci = Math.floor(rng() * ca.length);
                ca[ci] = GLITCH_CHARS[Math.floor(rng() * GLITCH_CHARS.length)];
            }
            line = ca.join("");
        }

        // Brightness varies by depth to fake CRT phosphor persistence
        const brightness = 55 + (row / visLines) * 30;
        const saturation = 70 + (1 - row / visLines) * 20;
        ctx.fillStyle = `hsl(${hue},${saturation}%,${brightness}%)`;

        if (line.length > 0) {
            ctx.fillText(line, 8, y);
        }

        // Cursor blink on the last fully visible line
        if (row === visLines - 2 && (Math.floor(t * 2) % 2 === 0)) {
            const cursor = "_";
            ctx.fillStyle = `hsl(${hue},90%,85%)`;
            ctx.fillText(cursor, 8 + ctx.measureText(line).width, y);
        }
    }
    ctx.restore();

    // Scanlines overlay
    if (scanAmt > 0.02) {
        ctx.save();
        ctx.globalAlpha = scanAmt * 0.4;
        ctx.fillStyle = "#000";
        for (let y = 0; y < h; y += 3) {
            ctx.fillRect(0, y, w, 1);
        }
        ctx.restore();
    }

    // Bass flicker: white flash overlay
    if (bass > 0.7 && flicker > 0.1) {
        ctx.save();
        ctx.globalAlpha = (bass - 0.7) * flicker * 0.5;
        ctx.fillStyle = `hsl(${hue},40%,90%)`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // Horizontal screen tear on bass hit
    if (bass > 0.8 && glitch > 0.1) {
        ctx.save();
        const tearY = Math.floor(rng() * h);
        const tearH = Math.floor(rng() * 6) + 1;
        const tearX = Math.floor((rng() - 0.5) * 20);
        ctx.globalAlpha = 0.6;
        try {
            const id = ctx.getImageData(0, tearY, w, tearH);
            ctx.putImageData(id, tearX, tearY);
        } catch (_) {}
        ctx.restore();
    }
}
