// FoxDot syntax overlay for CodeMirror 5 — loaded as a plain script (no ES module).
// Registers a "foxdot" mode that layers FoxDot-specific token colors over Python.
(function () {
    'use strict';

    const SYNTHS = [
        'a_gesa','a_daft','a_daftlead','a_hhat','a_stab','a_vlead','a_vpad','dafbass','pumpbass','abass','acidbass','alva','ambi','angst','arpy','arpymod','audioin',
        'bass','bbass','bell','bellmod','blip','bnoise','bounce','braids',
        'breakcore','brown','bug','cbass','charm','click','cluster','combs',
        'compkick','compperc','crackle','creep','cringe','crunch','cs80','dab','dafbass','darkpad',
        'dbass','dblbass','dirt','donk','donorgan','dopple','dub',
        'dubulse','ebass','elpfsaw','fail','faim','feel','fmpiano','fm2','fmvibe',
        'guit','gtr','gun','harp','hoover','jbass','jbass2','keys','kick','kik',
        'lapin','lazer','lead','looper','marimba','metronome','mirage','moog',
        'moogpluck','nylon','organ','piano','basic','pads','plaits','plaitsX','pluck',
        'prophet','reese','resonant','rhodes','risset','rsin','rustlead',
        'saw','sawbass','sax','sine','sinepad','sinebass','singer',
        'space','speaky','squarebass','stab','steel','stellar','stepper',
        'sub','subbass','supersaw','svdk','synthbass','theremin','thunder','tribar','tuba',
        'twang','varsaw','vox','wob','wobble','wobblebass',
    ];

    const PATTERNS = [
        'PRand','PWhite','PxRand','PwRand','PChain','PZ12','PTree',
        'PWalk','PDelta','PSquare','PIndex','PFibMod','PShuf','PAlt','PStretch',
        'PPairs','PZip','PZip2','PStutter','PSq','P10','PStep','PSum','PRange',
        'PTri','PSine','PEuclid','PEuclid2','PEuclidR','PBern','PBeat','PDur','PDelay',
        'PStrum','PQuicken','PRhythm','PJoin','PBin','PSaw','PTime',
        'PFr','PDrum','PGauss','PLog','PCoin','PChar',
        'PMarkov','PZero','PBool','PPing','PLife','PFDur','Pacc','PSwing',
        'PwRand','PCoin','PArp','PReverse','PMorse','PFib','PZ12','P10','PGauss','PFr','PStretch','PZip','PMarkov',
        'PChord','PRoman','PProg','PClave','PRhythm','PPoly','PLogistic','PBrown','PHenon','PLorenz','PPrime','PThue','PGrowArp','PTree','PFibMod','PPairs','PChar','PQuicken','PStrum','PZip2','PSaw','PSq',
        'PExp','PPulse','PSlide','PContour','PGroove','PCircle',
    ];

    const TIMEVARS = ['linvar','sinvar','expvar','Pvar','lininf','expinf','linbpm','linmod'];

    const KEYWORDS = [
        'Clock','Scale','Root','drop','rest','print','play','loop','loadloop','melody','motif','arp','chaos','son','soff','linbpm','dropbpm',
        'say','darker','lighter','shutup','swap',
        'unsolo','solo','once','norm','clamp','lmap','drummer','fill','brk',
        'renv','clone','switch','start','midi','midiin','mlearn','midiout','link','follow','accompany',
    ];

    // Build a fast lookup: word → cm class name. The hardcoded lists above are a
    // FALLBACK; the app overrides them from the live registries via setFoxdotTokens
    // (below) so highlighting can't drift out of sync with the real synths/patterns.
    let tokenMap;
    function buildTokenMap(synths, patterns, timevars, keywords) {
        const m = new Map();
        synths.forEach(s   => m.set(s, 'fd-synth'));
        patterns.forEach(p => m.set(p, 'fd-pattern'));
        timevars.forEach(t => m.set(t, 'fd-timevar'));
        keywords.forEach(k => m.set(k, 'fd-keyword'));
        m.set('var', 'fd-timevar');   // transpiler rewrites it, but highlight is useful
        return m;
    }
    tokenMap = buildTokenMap(SYNTHS, PATTERNS, TIMEVARS, KEYWORDS);
    // Called from index.html with Object.keys(SYNTH_DEFS) etc. so the lists stay live.
    CodeMirror.setFoxdotTokens = (synths, patterns, timevars) =>
        { tokenMap = buildTokenMap(synths || SYNTHS, patterns || PATTERNS, timevars || TIMEVARS, KEYWORDS); };

    const WORD_RE = /^[a-zA-Z_]\w*/;
    const PLAYER_RE = /^[a-zA-Z_]\w*(?=\s*>>)/;

    const overlay = {
        token: function (stream) {
            // #@#@ track-group header — consume the whole line
            if (stream.sol() && stream.match(/^#@#@.*/)) {
                return 'foxdot-track';
            }
            // #@ section header — consume the whole line
            if (stream.sol() && stream.match(/^#@.*/)) {
                return 'foxdot-section';
            }
            // Player name before >> gets its own color
            if (stream.match(PLAYER_RE, false)) {
                stream.match(WORD_RE);
                return 'fd-player';
            }
            if (stream.match(WORD_RE)) {
                return tokenMap.get(stream.current()) ?? null;
            }
            stream.next();
            return null;
        },
    };

    CodeMirror.defineMode('foxdot', function (config) {
        const py = CodeMirror.getMode(config, 'python');
        return CodeMirror.overlayMode(py, overlay, /* opaque= */ false);
    });

    CodeMirror.defineMIME('text/x-foxdot', 'foxdot');
}());
