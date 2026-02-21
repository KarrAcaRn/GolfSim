#!/usr/bin/env node
/**
 * Sprite generator for GolfSim - creates pixel-art PNGs using node-canvas.
 * Run: node scripts/generate-sprites.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'assets', 'sprites');

function save(canvas, name) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`  wrote ${name} (${canvas.width}x${canvas.height})`);
}

// ── Ball (12x12) ─────────────────────────────────────────────
function generateBall() {
  const s = 12;
  const c = createCanvas(s, s);
  const ctx = c.getContext('2d');

  // Main white circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(6, 6, 5, 0, Math.PI * 2);
  ctx.fill();

  // Shading: darker bottom-right
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.arc(7, 7, 4, 0, Math.PI * 2);
  ctx.fill();

  // Re-draw lighter top-left highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(5, 5, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Highlight spot
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(4, 3, 2, 2);

  // Dimple hints (subtle dots)
  ctx.fillStyle = 'rgba(200,200,200,0.6)';
  ctx.fillRect(6, 4, 1, 1);
  ctx.fillRect(4, 6, 1, 1);
  ctx.fillRect(7, 7, 1, 1);
  ctx.fillRect(5, 8, 1, 1);

  save(c, 'ball.png');
}

// ── Player (16x24) ──────────────────────────────────────────
function generatePlayer() {
  const w = 16, h = 24;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');

  // Hat (red visor)
  ctx.fillStyle = '#cc3333';
  ctx.fillRect(5, 0, 6, 3);
  ctx.fillRect(4, 2, 8, 1);

  // Head (skin)
  ctx.fillStyle = '#f5c5a3';
  ctx.fillRect(5, 3, 6, 4);

  // Eyes
  ctx.fillStyle = '#333333';
  ctx.fillRect(6, 4, 1, 1);
  ctx.fillRect(9, 4, 1, 1);

  // Polo shirt (blue)
  ctx.fillStyle = '#3366aa';
  ctx.fillRect(4, 7, 8, 6);

  // Collar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 7, 4, 1);

  // Arms
  ctx.fillStyle = '#3366aa';
  ctx.fillRect(2, 8, 2, 4);   // left arm
  ctx.fillRect(12, 8, 2, 4);  // right arm

  // Hands (skin)
  ctx.fillStyle = '#f5c5a3';
  ctx.fillRect(2, 12, 2, 1);
  ctx.fillRect(12, 12, 2, 1);

  // Golf club (right hand, extending down)
  ctx.fillStyle = '#888888';
  ctx.fillRect(13, 13, 1, 8);
  // Club head
  ctx.fillStyle = '#666666';
  ctx.fillRect(12, 20, 3, 2);

  // Pants (khaki)
  ctx.fillStyle = '#c4a96a';
  ctx.fillRect(4, 13, 8, 6);
  // Leg separation
  ctx.fillStyle = '#b09858';
  ctx.fillRect(8, 14, 1, 5);

  // Shoes (brown)
  ctx.fillStyle = '#5c3d2e';
  ctx.fillRect(3, 19, 5, 2);
  ctx.fillRect(8, 19, 5, 2);

  // Belt
  ctx.fillStyle = '#444444';
  ctx.fillRect(4, 13, 8, 1);

  save(c, 'player.png');
}

// ── Tee Marker (16x8) ──────────────────────────────────────
function generateTeeMarker() {
  const w = 16, h = 8;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');

  // Tee peg: thin vertical stick
  ctx.fillStyle = '#e8d8b8';
  ctx.fillRect(7, 0, 2, 6);

  // Tee top (wider cup)
  ctx.fillStyle = '#f0e8d0';
  ctx.fillRect(5, 0, 6, 2);

  // Shadow on ground
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(8, 7, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  save(c, 'tee_marker.png');
}

// ── Cup / Hole (16x10) ─────────────────────────────────────
function generateCup() {
  const w = 16, h = 10;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');

  // Outer ring (dark earth)
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.ellipse(8, 5, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner hole (black)
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(8, 5, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight rim (top edge)
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(8, 4, 5, 2, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  save(c, 'cup.png');
}

// ── Ball Shadow (16x8) ─────────────────────────────────────
function generateBallShadow() {
  const w = 16, h = 8;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');

  // Soft radial gradient ellipse
  const grad = ctx.createRadialGradient(8, 4, 0, 8, 4, 7);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  save(c, 'ball_shadow.png');
}

// ── Run all ─────────────────────────────────────────────────
console.log('Generating sprites...');
generateBall();
generatePlayer();
generateTeeMarker();
generateCup();
generateBallShadow();
console.log('Done!');
