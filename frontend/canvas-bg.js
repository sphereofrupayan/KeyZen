/* ============================================================
   KEYZEN — Footer-only cursor dot cluster
   A small, round, glowing cluster of dots trails the cursor,
   but ONLY while hovering inside the <footer class="footer">
   section. The canvas is sized and positioned to that section
   alone — nothing is drawn anywhere else on the page.
   Respects prefers-reduced-motion (does nothing if set).
   ============================================================ */

(function () {
  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCE_MOTION) return;

  const CLUSTER_RADIUS = 42;
  const DOT_SPACING = 11;
  const BASE_DOT_RADIUS = 1.1;
  const PULSE_AMPLITUDE = 0.6;
  const FOLLOW_EASE = 0.18;
  const FADE_EASE = 0.15;
  const DOT_COLOR = '70, 227, 183'; // matches --accent

  function initFooterCluster(footerEl) {
    let canvas, ctx, dpr;
    let clusterPos = { x: -9999, y: -9999 };
    let targetPos = { x: -9999, y: -9999 };
    let opacity = 0;
    let targetOpacity = 0;
    let visible = false;
    let dots = [];
    let startTime = performance.now();
    let footerW = 0, footerH = 0;

    function buildCanvas() {
      canvas = document.createElement('canvas');
      canvas.className = 'footer-bg-canvas';
      footerEl.style.position = footerEl.style.position || 'relative';
      footerEl.prepend(canvas);
      ctx = canvas.getContext('2d');
      resize();
    }

    function resize() {
      const rect = footerEl.getBoundingClientRect();
      footerW = rect.width;
      footerH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = footerW * dpr;
      canvas.height = footerH * dpr;
      canvas.style.width = footerW + 'px';
      canvas.style.height = footerH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function buildDots() {
      dots = [];
      const steps = Math.floor(CLUSTER_RADIUS / DOT_SPACING);
      for (let ix = -steps; ix <= steps; ix++) {
        for (let iy = -steps; iy <= steps; iy++) {
          const x = ix * DOT_SPACING;
          const y = iy * DOT_SPACING;
          const distFromCenter = Math.sqrt(x * x + y * y);
          if (distFromCenter <= CLUSTER_RADIUS) {
            dots.push({
              ox: x,
              oy: y,
              distFromCenter,
              phase: Math.random() * Math.PI * 2,
              speed: 1.4 + Math.random() * 1.2,
            });
          }
        }
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, footerW, footerH);

      clusterPos.x += (targetPos.x - clusterPos.x) * FOLLOW_EASE;
      clusterPos.y += (targetPos.y - clusterPos.y) * FOLLOW_EASE;
      opacity += (targetOpacity - opacity) * FADE_EASE;

      if (opacity > 0.01) {
        const t = (now - startTime) / 1000;

        const glow = ctx.createRadialGradient(
          clusterPos.x, clusterPos.y, 0,
          clusterPos.x, clusterPos.y, CLUSTER_RADIUS * 1.4
        );
        glow.addColorStop(0, `rgba(${DOT_COLOR}, ${0.12 * opacity})`);
        glow.addColorStop(1, `rgba(${DOT_COLOR}, 0)`);
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(clusterPos.x, clusterPos.y, CLUSTER_RADIUS * 1.4, 0, Math.PI * 2);
        ctx.fill();

        for (const dot of dots) {
          const pulse = Math.sin(t * dot.speed + dot.phase) * 0.5 + 0.5;
          const edgeFalloff = 1 - dot.distFromCenter / CLUSTER_RADIUS;
          const radius = BASE_DOT_RADIUS + pulse * PULSE_AMPLITUDE * edgeFalloff;
          const dotOpacity = (0.25 + edgeFalloff * 0.55) * opacity;

          ctx.beginPath();
          ctx.arc(clusterPos.x + dot.ox, clusterPos.y + dot.oy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${DOT_COLOR}, ${dotOpacity})`;
          ctx.fill();
        }
      }

      requestAnimationFrame(draw);
    }

    function onMouseMove(e) {
      const rect = footerEl.getBoundingClientRect();
      targetPos.x = e.clientX - rect.left;
      targetPos.y = e.clientY - rect.top;
      if (!visible) {
        clusterPos.x = targetPos.x;
        clusterPos.y = targetPos.y;
        visible = true;
      }
      targetOpacity = 1;
    }

    function onMouseLeave() {
      targetOpacity = 0;
    }

    buildCanvas();
    buildDots();
    requestAnimationFrame(draw);

    footerEl.addEventListener('mousemove', onMouseMove, { passive: true });
    footerEl.addEventListener('mouseleave', onMouseLeave);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
  }

  function init() {
    const footerEl = document.querySelector('footer.footer');
    if (!footerEl) return; // page has no footer — nothing to attach to
    initFooterCluster(footerEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();