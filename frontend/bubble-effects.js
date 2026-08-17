/* ============================================================
   CIPHERVAULT — Bubble field effects
   Footer: colorful, loose grid, reacts only to mouse
   Header: dense, accent-only, idles with a gentle drift
   ============================================================ */

/* ---------- FOOTER ---------- */
(function () {
    const canvas = document.getElementById('footer-bubble-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const wrapper = canvas.parentElement;

    let W, H, dpr;
    let particles = [];
    const mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999 };
    const REPEL_RADIUS = 160;
    const COLORS = ['rgba(70,227,183,', 'rgba(127,92,255,', 'rgba(255,255,255,'];

    function resize() {
    const rect = wrapper.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
}

function initParticles() {
    particles = [];
    const spacing = 34;
    const pad = 20;
    const cols = Math.ceil((W - pad * 2) / spacing) + 1;
    const rows = Math.ceil((H - pad * 2) / spacing) + 1;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = pad + col * spacing + (row % 2 === 0 ? 0 : spacing / 2);
            const y = pad + row * spacing;

            particles.push({
                homeX: x, homeY: y,
                dispX: 0, dispY: 0,
                r: 2.5,   // fixed size — every dot identical
                alpha: 0.75
            });
        }
    }
}

let lastTime = performance.now();

function frame(now) {
    const dt = Math.min((now - lastTime) / 16.67, 3); // normalize to ~60fps, clamp spikes
    lastTime = now;

    ctx.clearRect(0, 0, W, H);

    mouse.x += (mouse.targetX - mouse.x) * 0.15 * dt;
    mouse.y += (mouse.targetY - mouse.y) * 0.15 * dt;

    particles.forEach(p => {
        const dx = p.homeX - mouse.x;
        const dy = p.homeY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetDispX = 0;
        let targetDispY = 0;

        if (dist < REPEL_RADIUS) {
            const force = Math.pow(1 - dist / REPEL_RADIUS, 2);
            const angle = Math.atan2(dy, dx);
            const push = force * (REPEL_RADIUS * 0.55 + p.r * 1.5);
            targetDispX = Math.cos(angle) * push;
            targetDispY = Math.sin(angle) * push;
        }

        p.dispX += (targetDispX - p.dispX) * 0.08 * dt;
        p.dispY += (targetDispY - p.dispY) * 0.08 * dt;

        const drawX = p.homeX + p.dispX;
        const drawY = p.homeY + p.dispY;

        ctx.beginPath();
        ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
    });

    requestAnimationFrame(frame);
}

    wrapper.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.targetX = e.clientX - rect.left;
        mouse.targetY = e.clientY - rect.top;
    });

    wrapper.addEventListener('mouseleave', () => {
        mouse.targetX = -9999;
        mouse.targetY = -9999;
    });

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
})();


/* ---------- INTRO SPLASH: "KeyZen" formed from converging white dots ---------- */
(function () {
    const canvas = document.getElementById('intro-bubble-canvas');
    const splash = document.getElementById('intro-splash');
    if (!canvas || !splash) return;

    document.body.classList.add('intro-active');

    const ctx = canvas.getContext('2d');
    let W, H, dpr;
    let particles = [];

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildTextParticles();
    }

    function buildTextParticles() {
        // 1. Draw "KeyZen" onto an offscreen canvas to sample pixel positions
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const octx = off.getContext('2d');

        const fontSize = Math.min(W * 0.14, 140);
        octx.fillStyle = '#fff';
        octx.font = `700 ${fontSize}px "Space Grotesk", sans-serif`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText('KeyZen', W / 2, H / 2);

        const imgData = octx.getImageData(0, 0, W, H).data;

        // 2. Sample every Nth pixel that has alpha (i.e. is part of a letter)
        const gap = Math.max(2, Math.round(fontSize / 45)); // density of dots
        const targets = [];
        for (let y = 0; y < H; y += gap) {
            for (let x = 0; x < W; x += gap) {
                const alpha = imgData[(y * W + x) * 4 + 3];
                if (alpha > 128) targets.push({ x, y });
            }
        }

        // 3. Create particles that start at random positions and animate to targets
        particles = targets.map(t => ({
    x: Math.random() * W,
    y: Math.random() * H,
    targetX: t.x,
    targetY: t.y,
    r: Math.random() * 1.3 + 1,
    alpha: Math.random() * 0.4 + 0.5,
    speed: 0.09 + Math.random() * 0.06,
    // explosion velocity, assigned later
    vx: 0,
    vy: 0
}));
    }

    function frame() {
        ctx.clearRect(0, 0, W, H);

        particles.forEach(p => {
            p.x += (p.targetX - p.x) * p.speed;
            p.y += (p.targetY - p.y) * p.speed;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
            ctx.fill();
        });

        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
requestAnimationFrame(frame);

    // Timing breakdown:
    // - particles need time to travel from random start positions to their
    //   letter-shaped targets (depends on `speed`, ~0.06-0.11 per particle)
    // - then we hold the fully-formed word on screen for a beat
    // - then fade out
    const CONVERGE_TIME = 2200;  // time for dots to settle into "KeyZen"
    const HOLD_TIME = 2200;      // pause once the word is fully formed
    const TOTAL_DELAY = CONVERGE_TIME + HOLD_TIME;

    setTimeout(() => {
        splash.classList.add('hide');
        document.body.classList.remove('intro-active');
        document.body.classList.add('page-revealed');
    }, TOTAL_DELAY);
})();
