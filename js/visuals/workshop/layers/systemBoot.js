// System Boot — CRASH-OS Linux boot terminal: ASCII logo, kernel dmesg,
// service startup, intrusion banner, progress bar, glitch. Loops.

const _state = new WeakMap();

const LOGO = [
    "  ██████╗ ██████╗  █████╗ ███████╗██╗  ██╗    ██████╗ ███████╗",
    " ██╔════╝ ██╔══██╗██╔══██╗██╔════╝██║  ██║   ██╔═══██╗██╔════╝",
    " ██║      ██████╔╝███████║███████╗███████║   ██║   ██║███████╗ ",
    " ██║      ██╔══██╗██╔══██║╚════██║██╔══██║   ██║   ██║╚════██║",
    " ╚██████╗ ██║  ██║██║  ██║███████║██║  ██║   ╚██████╔╝███████║",
    "  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝"];

const _VER  = ["3.14.159","2.71.828","1.41.421","6.28.318"];
const _KERN = ["5.15.0-cyberpunk","5.19.2-neural","6.1.0-quantum","5.18.7-ghost"];
const _HUMOR = ["Mounting /dev/coffee... [CRITICAL: EMPTY]","Reticulating splines...","Bypassing corporate firewall... [OK]","Injecting neural payload...","Compiling reality.h...","Feeding the machine spirit... [OK]"];
const _SVCS  = ["neural interfaces","quantum encryption protocols","virtual reality filesystem","AI personality cores","biometric scanners","neural link protocols","wetware drivers"];
const _pick  = (a) => a[(Math.random()*a.length)|0];
const _hex   = (n) => Array.from({length:n},()=>"0123456789abcdef"[(Math.random()*16)|0]).join("");
const _T     = (n) => n.toFixed(6).padStart(11);

function _buildBoot() {
    const L = [];
    LOGO.forEach(l => L.push({t:l,c:"logo"}));
    L.push({t:"        [ CYBERPUNK NEURAL EDITION ]",c:"neon"});
    L.push({t:"═".repeat(58),c:"div"});
    L.push({t:`CRASH/OS v${_pick(_VER)} INITIALIZING...`,c:"flash"});
    L.push({t:"═".repeat(58),c:"div"});
    let clk = 0; const k = s => { clk += Math.random()*0.05; return {t:`[${_T(clk)}] ${s}`,c:""}; };
    L.push(k(`Linux version ${_pick(_KERN)} (root@hacker-box)`));
    L.push(k("x86/fpu: Supporting XSAVE feature 0x001: x87 fp registers"));
    L.push(k("NX (Execute Disable) protection: active"));
    L.push({t:_pick(_HUMOR),c:"warn"});
    L.push(k("Secure boot disabled"));
    L.push(k(`Memory: ${16000000+(Math.random()*800000|0)}K/17301504K available`));
    L.push(k("SLUB: HWalign=64, Order=0-3, MinObjects=0, CPUs=8, Nodes=1"));
    L.push(k("Kernel/User page tables isolation: enabled"));
    L.push(k("smpboot: Total of 8 processors activated"));
    L.push(k("pci 0000:00:02.0: [8086:0166] type 00 class 0x030000"));
    L.push(k("NET: Registered PF_INET protocol family"));
    L.push(k("TCP: Hash tables configured (established 524288 bind 65536)"));
    L.push(k("Trying to unpack rootfs image as initramfs..."));
    L.push(k(`Freeing initrd memory: ${7000+(Math.random()*999|0)}K`));
    L.push({t:_pick(_HUMOR),c:"warn"});
    L.push(k(`Loaded X.509 cert Debian Secure Boot CA: ${_hex(32)}`));
    L.push(k("io scheduler kyber registered"));
    L.push(k("Run /init as init process"));
    L.push({t:"",c:""});
    L.push({t:"═".repeat(58),c:"div"});
    L.push({t:"SYSTEM INITIALIZATION COMPLETE",c:"flash"});
    L.push({t:"═".repeat(58),c:"div"});
    _SVCS.forEach(s => { L.push({t:`Starting ${s}...`,c:"neon"}); L.push({t:`  [  OK  ] ${s} online`,c:"ok"}); });
    L.push({t:"",c:""});
    L.push({t:"█▓▒░ WELCOME TO THE GRID, CONSOLE COWBOY ░▒▓█",c:"div"});
    L.push({t:"Ready to jack in...",c:"flash"});
    L.push({t:"> _",c:"flash"});
    return L;
}

const _COL = {"":"#00ff41",logo:"#00ffff",neon:"#aaffcc",div:"#ffffff",flash:"#66ff99",ok:"#66ff66",warn:"#ffcc66",err:"#ff6666"};

export const systemBootParams = () => ({
    speed:     { base: 1,    min: 0.1, max: 5,   mod: { source: "" } },
    fontScale: { base: 1,    min: 0.5, max: 2,   mod: { source: "" } },
    glitch:    { base: 1,    min: 0,   max: 3,   mod: { source: "" } },
});

export function drawSystemBoot(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const U = Math.min(w, h);
    const fsz = U*0.016*(p.fontScale??1), lh = fsz*1.25;

    let st = _state.get(ctx);
    if (!st) { st = {lines:_buildBoot(), pos:0, glitch:0, lastEval:-1, lastT:-1}; _state.set(ctx, st); }

    const lv = extra?.live;
    const ec = lv?.evalCount ?? 0;
    if (ec !== st.lastEval) { st.lastEval = ec; st.lines = _buildBoot(); st.pos = 0; st.glitch = 1; }

    const dt = 1/60;
    st.pos += dt * p.speed * (8 + bass*10);
    if (st.pos > st.lines.length + 6) st.pos = 0;
    if (Math.random() < 0.02 * (p.glitch??1)) st.glitch = Math.min(1, st.glitch + 0.3);
    st.glitch = Math.max(0, st.glitch*0.95 - 0.003);

    ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h);
    const gOff = Math.sin(t*30)*st.glitch*10;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    const top = fsz*2, rows = Math.floor((h-top)/lh), head = st.pos|0;
    ctx.textAlign = "left"; ctx.font = `${fsz|0}px 'Courier New',monospace`; ctx.textBaseline = "alphabetic";
    for (let r = 0; r < rows; r++) {
        const li = head - rows + r + 1; if (li < 0 || li >= st.lines.length) continue;
        const ln = st.lines[li], isNew = li === head, y = top + r*lh;
        let col = _COL[ln.c] || _COL[""];
        if (/ERROR|FAIL|PANIC/.test(ln.t)) col = _COL.err;
        else if (/WARN|CRITICAL/.test(ln.t)) col = _COL.warn;
        else if (/\[  OK  \]|COMPLETE|online/.test(ln.t)) col = _COL.ok;
        if (isNew) col = _COL.flash;
        if (ln.c === "logo") { ctx.shadowColor = "#00ffff"; ctx.shadowBlur = fsz*0.6; } else ctx.shadowBlur = 0;
        ctx.fillStyle = col; ctx.fillText(ln.t, U*0.03 + gOff*(r%2?1:-1), y);
    }
    ctx.shadowBlur = 0;
    if (st.glitch > 0.1) {
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(255,0,0,${st.glitch*0.15})`; ctx.fillRect(-2,0,w,h);
        ctx.fillStyle = `rgba(0,255,255,${st.glitch*0.12})`; ctx.fillRect(2,0,w,h);
        ctx.globalCompositeOperation = "source-over";
    }
    const prog = Math.min(1, st.pos/st.lines.length), bw = w*0.9, bx = w*0.05, by = h - U*0.04;
    ctx.fillStyle = "rgba(0,255,65,0.15)"; ctx.fillRect(bx,by,bw,U*0.012);
    ctx.fillStyle = "#fff"; ctx.fillRect(bx,by,bw*prog,U*0.012);
    ctx.fillStyle = "#00ff41"; ctx.font = `${fsz*0.8|0}px 'Courier New',monospace`;
    ctx.fillText(`BOOT PROGRESS: ${(prog*100)|0}% [${head}/${st.lines.length}]`, bx, by-fsz*0.4);
    if (prog > 0.5 && prog < 0.7) {
        ctx.textAlign = "center"; ctx.fillStyle = `rgba(255,0,102,${0.5+0.5*Math.sin(t*8)})`;
        ctx.font = `bold ${U*0.03|0}px 'Courier New',monospace`;
        ctx.fillText("⚠ INTRUSION ATTEMPT DETECTED ⚠", w/2, h*0.5);
    }
}
