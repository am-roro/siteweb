/**
 * ═══════════════════════════════════════════════════════════
 *  Voice Reader – Les Voix des Femmes de Suresnes
 *  • Clic sur n'importe quel texte → lecture immédiate
 *  • Voix française chaleureuse et vive
 *  • Surbrillance du bloc lu
 * ═══════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    if (!('speechSynthesis' in window)) return;

    /* ───────────────────────────────────────────────
       STATE
    ─────────────────────────────────────────────── */
    let currentEl    = null;   // élément en cours de lecture
    let isSpeaking   = false;
    let isPaused     = false;
    let readAllMode  = false;  // mode "tout lire"
    let readAllQueue = [];
    let readAllIdx   = 0;

    /* ───────────────────────────────────────────────
       SÉLECTEURS DES ÉLÉMENTS CLIQUABLES
    ─────────────────────────────────────────────── */
    const READABLE = [
        'h1', 'h2', 'h3', 'h4',
        'p', 'blockquote', 'li',
        '.hero-badge', '.section-subtitle',
        '.volunteer-item', '.value-card',
        '.activity-card', '.contact-card',
        '.quote-card', '.activities-text',
        '.fiche', '.entry', '.slide-caption', '.statut', '.notice'
    ].join(', ');

    /* ───────────────────────────────────────────────
       MEILLEURE VOIX FRANÇAISE (la plus naturelle)
       On note chaque voix française : les voix "Natural",
       "Neural", "Premium", "Enhanced" ou en ligne sonnent
       presque comme une vraie personne.
    ─────────────────────────────────────────────── */
    let cachedVoice = null;

    function scoreVoice(v) {
        const n = v.name.toLowerCase();
        let score = 0;
        if (v.lang.toLowerCase() === 'fr-fr') score += 10;
        if (/natural|neural/.test(n))        score += 100;  // Edge / Windows 11
        if (/premium/.test(n))               score += 90;   // Apple
        if (/enhanced|améliorée/.test(n))    score += 80;   // Apple
        if (/online/.test(n))                score += 50;
        if (/google/.test(n))                score += 40;
        if (!v.localService)                 score += 20;   // voix cloud = plus naturelle
        // Voix féminines (association de femmes)
        if (/denise|eloise|éloïse|vivienne|brigitte|coralie|audrey|amelie|amélie|marie|julie|hortense|aurelie|aurélie/.test(n)) score += 25;
        // Voix "robot" connues à éviter
        if (/espeak|compact/.test(n))        score -= 100;
        return score;
    }

    function pickVoice() {
        if (cachedVoice) return cachedVoice;
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;

        const french = voices.filter(v => v.lang.toLowerCase().startsWith('fr'));
        if (!french.length) return voices[0];

        french.sort((a, b) => scoreVoice(b) - scoreVoice(a));
        cachedVoice = french[0];
        return cachedVoice;
    }

    /* ───────────────────────────────────────────────
       NETTOYAGE DU TEXTE : on ne lit que les mots,
       pas les cœurs, emojis, puces et autres symboles
    ─────────────────────────────────────────────── */
    function cleanForSpeech(text) {
        return (text || '')
            // e-mails : "arobase" et "point"
            .replace(/([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)/g, (m, user, domain) =>
                user + ' arobase ' + domain.replace(/\./g, ' point '))
            // numéros de téléphone 06.44.89.55.36 → "06 44 89 55 36"
            .replace(/\b(\d{2})[.\s-](\d{2})[.\s-](\d{2})[.\s-](\d{2})[.\s-](\d{2})\b/g, '$1 $2 $3 $4 $5')
            // monnaie et esperluette
            .replace(/(\d)\s*€/g, '$1 euros')
            .replace(/€/g, ' euros ')
            .replace(/&/g, ' et ')
            // plages horaires / dates : "14h30 – 18h" → "14h30 à 18h"
            .replace(/([\dh])\s+[–—]\s+(\d)/g, '$1 à $2')
            // emojis, cœurs, étoiles, flèches, puces, symboles divers
            .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0E\uFE0F\u200D\u20E3]/gu, ' ')
            .replace(/[♥♡❤❥❣★☆✦✧✓✔✗✘•·●○◆◇■□▪▫▶►◄←→↑↓⇒»«“”"*_#~^|\\<>\[\]{}=+]/g, ' ')
            // tirets utilisés comme séparateurs → petite pause
            .replace(/\s[–—-]\s/g, ', ')
            // retours à la ligne → pause naturelle
            .replace(/\s*\n+\s*/g, '. ')
            .replace(/([.!?:;,])\s*\.\s/g, '$1 ')
            // espaces multiples
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    /* ───────────────────────────────────────────────
       LECTURE D'UN TEXTE DONNÉ
    ─────────────────────────────────────────────── */
    function speak(text, onEnd) {
        window.speechSynthesis.cancel();
        text = cleanForSpeech(text);
        if (!text) { if (onEnd) onEnd(); return; }

        const utt = new SpeechSynthesisUtterance(text);
        utt.lang   = 'fr-FR';
        utt.rate   = 1;      // débit normal d'une vraie personne
        utt.pitch  = 1;      // pas de modification : garde la voix naturelle
        utt.volume = 1;

        const voice = pickVoice();
        if (voice) utt.voice = voice;

        utt.onstart = () => { isSpeaking = true; isPaused = false; updateWidget(); };
        utt.onend   = () => { isSpeaking = false; if (onEnd) onEnd(); updateWidget(); };
        utt.onerror = () => { isSpeaking = false; if (onEnd) onEnd(); updateWidget(); };

        // Workaround Chrome : relance auto si synth bloquée
        window.speechSynthesis.speak(utt);

        // Chrome bug : speechSynthesis se coupe parfois sur long texte
        const keepAlive = setInterval(() => {
            if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return; }
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }, 10000);

        utt.onend = () => {
            clearInterval(keepAlive);
            isSpeaking = false;
            isPaused   = false;
            if (onEnd) onEnd();
            updateWidget();
        };
    }

    /* ───────────────────────────────────────────────
       SURBRILLANCE DE L'ÉLÉMENT EN COURS
    ─────────────────────────────────────────────── */
    function highlight(el) {
        clearHighlight();
        if (!el) return;
        currentEl = el;
        el.classList.add('vr-reading');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function clearHighlight() {
        if (currentEl) {
            currentEl.classList.remove('vr-reading');
            currentEl = null;
        }
    }

    /* ───────────────────────────────────────────────
       CLIC SUR UN ÉLÉMENT → lecture de ce passage
    ─────────────────────────────────────────────── */
    function handleElementClick(e) {
        const el = e.currentTarget;

        // Si on clique sur l'élément déjà en lecture → pause/reprise
        if (el === currentEl && isSpeaking) {
            togglePause();
            return;
        }

        readAllMode = false;
        readAllQueue = [];

        highlight(el);

        const text = el.innerText || el.textContent || '';
        speak(text, () => {
            clearHighlight();
            showWidget('idle');
        });

        showWidget('speaking', el);
    }

    /* ───────────────────────────────────────────────
       MODE "TOUT LIRE" (bouton du widget)
    ─────────────────────────────────────────────── */
    function buildReadAllQueue() {
        return Array.from(document.querySelectorAll(READABLE)).filter(el => {
            if (el.closest('nav, footer, .voice-reader-widget')) return false;
            if (!el.textContent.trim()) return false;
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden';
        });
    }

    function startReadAll() {
        readAllMode  = true;
        readAllQueue = buildReadAllQueue();
        readAllIdx   = 0;
        readNext();
    }

    function readNext() {
        if (!readAllMode || readAllIdx >= readAllQueue.length) {
            clearHighlight();
            readAllMode = false;
            showWidget('idle');
            return;
        }
        const el = readAllQueue[readAllIdx++];
        highlight(el);
        showWidget('speaking', el);

        const text = el.innerText || el.textContent || '';
        speak(text, readNext);
    }

    /* ───────────────────────────────────────────────
       PAUSE / REPRISE / STOP
    ─────────────────────────────────────────────── */
    function togglePause() {
        if (isPaused) {
            window.speechSynthesis.resume();
            isPaused = false;
        } else {
            window.speechSynthesis.pause();
            isPaused = true;
        }
        updateWidget();
    }

    function stopAll() {
        readAllMode = false;
        window.speechSynthesis.cancel();
        isSpeaking = false;
        isPaused   = false;
        clearHighlight();
        showWidget('idle');
    }

    /* ───────────────────────────────────────────────
       WIDGET FLOTTANT
    ─────────────────────────────────────────────── */
    let widgetEl = null;

    function createWidget() {
        injectStyles();

        widgetEl = document.createElement('div');
        widgetEl.className = 'vr-widget';
        widgetEl.setAttribute('aria-live', 'polite');
        widgetEl.innerHTML = `
            <div class="vr-wave" id="vr-wave">
                <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="vr-info">
                <span class="vr-status" id="vr-status">Cliquez sur un texte pour l'écouter</span>
                <span class="vr-excerpt" id="vr-excerpt"></span>
            </div>
            <div class="vr-controls">
                <button class="vr-ctrl" id="vr-read-all" title="Tout lire depuis le début" aria-label="Tout lire">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <polygon points="5,3 19,12 5,21"/>
                        <line x1="19" y1="3" x2="19" y2="21"/>
                    </svg>
                </button>
                <button class="vr-ctrl vr-main" id="vr-pause-btn" title="Pause / Reprendre" aria-label="Pause" style="display:none">
                    <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1"/>
                        <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                    <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" style="display:none">
                        <polygon points="5,3 19,12 5,21"/>
                    </svg>
                </button>
                <button class="vr-ctrl" id="vr-stop-btn" title="Arrêter" aria-label="Arrêter" style="display:none">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                    </svg>
                </button>
            </div>
        `;
        document.body.appendChild(widgetEl);

        document.getElementById('vr-read-all').addEventListener('click', startReadAll);
        document.getElementById('vr-pause-btn').addEventListener('click', togglePause);
        document.getElementById('vr-stop-btn').addEventListener('click', stopAll);

        window.addEventListener('beforeunload', stopAll);
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
    }

    function showWidget(state, el) {
        const statusEl  = document.getElementById('vr-status');
        const excerptEl = document.getElementById('vr-excerpt');
        const pauseBtn  = document.getElementById('vr-pause-btn');
        const stopBtn   = document.getElementById('vr-stop-btn');
        const wave      = document.getElementById('vr-wave');

        if (state === 'idle') {
            statusEl.textContent  = 'Cliquez sur un texte pour l\'écouter';
            excerptEl.textContent = '';
            pauseBtn.style.display = 'none';
            stopBtn.style.display  = 'none';
            wave.classList.remove('vr-active');
            widgetEl.classList.remove('vr-is-playing');
        } else {
            const excerpt = el ? (el.innerText || el.textContent || '').slice(0, 48) + '…' : '';
            statusEl.textContent  = isPaused ? 'En pause' : 'En cours de lecture';
            excerptEl.textContent = excerpt;
            pauseBtn.style.display = 'flex';
            stopBtn.style.display  = 'flex';
            wave.classList.toggle('vr-active', !isPaused);
            widgetEl.classList.add('vr-is-playing');
        }
    }

    function updateWidget() {
        const statusEl = document.getElementById('vr-status');
        const pauseBtn = document.getElementById('vr-pause-btn');
        const wave     = document.getElementById('vr-wave');

        if (!isSpeaking) {
            showWidget('idle');
            return;
        }

        if (isPaused) {
            statusEl.textContent = 'En pause';
            pauseBtn.querySelector('.icon-pause').style.display = 'none';
            pauseBtn.querySelector('.icon-play').style.display  = 'block';
            wave.classList.remove('vr-active');
        } else {
            statusEl.textContent = 'En cours de lecture';
            pauseBtn.querySelector('.icon-pause').style.display = 'block';
            pauseBtn.querySelector('.icon-play').style.display  = 'none';
            wave.classList.add('vr-active');
        }
    }

    /* ───────────────────────────────────────────────
       CURSEUR ET INTERACTIVITÉ SUR LES TEXTES
    ─────────────────────────────────────────────── */
    function makeTextsClickable() {
        document.querySelectorAll(READABLE).forEach(el => {
            if (el.closest('nav, footer, .vr-widget')) return;
            el.classList.add('vr-clickable');
            el.setAttribute('tabindex', '0');
            el.setAttribute('title', 'Cliquez pour écouter ce passage ♥');
            el.addEventListener('click', handleElementClick);
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') handleElementClick({ currentTarget: el });
            });
        });
    }

    /* ───────────────────────────────────────────────
       STYLES CSS
    ─────────────────────────────────────────────── */
    function injectStyles() {
        const s = document.createElement('style');
        s.textContent = `

        /* ── Éléments cliquables ── */
        .vr-clickable {
            cursor: pointer;
            border-radius: 8px;
            transition: background 0.18s ease, box-shadow 0.18s ease;
        }
        .vr-clickable:hover {
            background: rgba(192, 71, 107, 0.07) !important;
            box-shadow: 0 0 0 3px rgba(192, 71, 107, 0.12);
        }

        /* ── Surbrillance de l'élément lu ── */
        .vr-reading {
            background: linear-gradient(120deg, rgba(224, 127, 160, 0.22), rgba(192, 71, 107, 0.12)) !important;
            box-shadow: 0 0 0 4px rgba(192, 71, 107, 0.25) !important;
            border-radius: 8px;
            outline: none;
            animation: vr-highlight-pulse 1.8s ease-in-out infinite;
        }
        @keyframes vr-highlight-pulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(192, 71, 107, 0.25); }
            50%       { box-shadow: 0 0 0 8px rgba(192, 71, 107, 0.12); }
        }

        /* ── Petit tooltip au survol ── */
        .vr-clickable::after {
            content: '♥ écouter';
            position: absolute;
            top: -28px; left: 50%; transform: translateX(-50%);
            background: rgba(50,15,25,0.82);
            color: #fff;
            font-size: 11px;
            padding: 3px 9px;
            border-radius: 20px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .vr-clickable { position: relative; }
        .vr-clickable:hover::after { opacity: 1; }

        /* ── Widget flottant ── */
        .vr-widget {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            background: #fff;
            border: 2px solid #f0dce6;
            border-radius: 56px;
            box-shadow: 0 8px 32px rgba(100,20,50,0.13), 0 2px 8px rgba(0,0,0,0.07);
            padding: 10px 16px 10px 16px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            transition: box-shadow 0.25s, border-color 0.25s;
        }
        .vr-widget.vr-is-playing {
            border-color: #c0476b;
            box-shadow: 0 10px 40px rgba(192,71,107,0.22), 0 2px 8px rgba(0,0,0,0.08);
        }

        /* Barres d'onde sonore */
        .vr-wave {
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: 22px;
            flex-shrink: 0;
        }
        .vr-wave span {
            display: block;
            width: 4px;
            border-radius: 3px;
            background: #ddb8ca;
            transition: background 0.3s;
        }
        .vr-wave span:nth-child(1) { height: 7px; }
        .vr-wave span:nth-child(2) { height: 13px; }
        .vr-wave span:nth-child(3) { height: 9px; }
        .vr-wave span:nth-child(4) { height: 17px; }
        .vr-wave span:nth-child(5) { height: 5px; }

        .vr-wave.vr-active span {
            background: linear-gradient(to top, #c0476b, #e896b4);
            animation: vr-wave-anim 0.7s ease-in-out infinite alternate;
        }
        .vr-wave.vr-active span:nth-child(1) { animation-delay: 0s;    }
        .vr-wave.vr-active span:nth-child(2) { animation-delay: 0.12s; }
        .vr-wave.vr-active span:nth-child(3) { animation-delay: 0.24s; }
        .vr-wave.vr-active span:nth-child(4) { animation-delay: 0.09s; }
        .vr-wave.vr-active span:nth-child(5) { animation-delay: 0.18s; }

        @keyframes vr-wave-anim {
            0%   { transform: scaleY(0.35); }
            100% { transform: scaleY(1.15); }
        }

        /* Texte du widget */
        .vr-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .vr-status {
            font-size: 12.5px;
            font-weight: 700;
            color: #b03060;
            white-space: nowrap;
        }
        .vr-excerpt {
            font-size: 11px;
            color: #888;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
        }

        /* Boutons */
        .vr-controls {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }
        .vr-ctrl {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5e6ef;
            color: #c0476b;
            transition: background 0.18s, transform 0.15s;
            flex-shrink: 0;
        }
        .vr-ctrl svg { width: 14px; height: 14px; }
        .vr-ctrl:hover { background: #edd0e0; transform: scale(1.1); }
        .vr-ctrl:active { transform: scale(0.93); }

        .vr-ctrl.vr-main {
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, #c0476b, #e07fa0);
            color: #fff;
        }
        .vr-ctrl.vr-main:hover { background: linear-gradient(135deg, #a83358, #c0476b); }
        .vr-ctrl.vr-main svg { width: 16px; height: 16px; }

        /* Responsive */
        @media (max-width: 520px) {
            .vr-widget { bottom: 14px; right: 14px; padding: 8px 12px; }
            .vr-excerpt { display: none; }
        }
        `;
        document.head.appendChild(s);
    }

    /* ───────────────────────────────────────────────
       INIT
    ─────────────────────────────────────────────── */
    function init() {
        createWidget();

        // Chrome charge les voix en async
        window.speechSynthesis.addEventListener('voiceschanged', () => { cachedVoice = null; });

        // Rendre les textes cliquables (DOM déjà prêt)
        makeTextsClickable();

        // Relancer sur les éléments apparus après un délai (animations)
        setTimeout(makeTextsClickable, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
