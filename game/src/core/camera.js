// 진짜 3D 카메라 — 월드(x=동, y=위, z=북)를 화면에 원근 투영한다.
// 스프라이트는 전부 2D 손그림이지만, 위치/크기/정렬이 3D로 계산되기 때문에
// 걸어 다니면 시차(parallax)가 생기고 입체로 읽힌다.
import { clamp, lerp } from './rng.js';

export class Camera {
  constructor() {
    this.tx = 0;
    this.ty = 1.1; // 바라보는 높이 (캐릭터 가슴께)
    this.tz = 0;
    this.yaw = 0; // 좌우 회전(라디안)
    this.pitch = 0.36; // 내려다보는 각도
    this.dist = 13.5;
    this.fov = 0.86; // 세로 화각(라디안)
    this.shake = 0;

    this.w = 1280;
    this.h = 720;
    this._recompute();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this._recompute();
  }

  // 부드럽게 타깃 추적
  follow(x, y, z, dt) {
    const k = 1 - Math.exp(-7 * dt);
    this.tx = lerp(this.tx, x, k);
    this.ty = lerp(this.ty, y + 1.1, k);
    this.tz = lerp(this.tz, z, k);
  }

  orbit(delta) {
    this.yaw = clamp(this.yaw + delta, -0.85, 0.85); // 종이 느낌이 깨지지 않게 제한
  }

  zoom(delta) {
    this.dist = clamp(this.dist + delta, 8, 22);
  }

  _recompute() {
    this.focal = this.h / 2 / Math.tan(this.fov / 2);

    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);

    // 카메라는 타깃 기준 뒤(-z 반대편) 위쪽에 위치
    const dx = sy * cp;
    const dy = sp;
    const dz = cy * cp;
    this.px = this.tx + dx * this.dist;
    this.py = this.ty + dy * this.dist;
    this.pz = this.tz + dz * this.dist;

    // 시선 기저 벡터
    this.fx = -dx;
    this.fy = -dy;
    this.fz = -dz;

    // right = normalize(forward × worldUp) = normalize(-fz, 0, fx)
    const rl = Math.hypot(this.fz, this.fx) || 1;
    this.rx = -this.fz / rl;
    this.ry = 0;
    this.rz = this.fx / rl;

    // up = right × forward  (ry = 0 이므로 정리한 형태)
    this.ux = -this.rz * this.fy;
    this.uy = this.rz * this.fx - this.rx * this.fz;
    this.uz = this.rx * this.fy;
    const ul = Math.hypot(this.ux, this.uy, this.uz) || 1;
    this.ux /= ul;
    this.uy /= ul;
    this.uz /= ul;

    this.cx = this.w / 2;
    this.cyPix = this.h * 0.58; // 화면 중심을 살짝 아래로 → 하늘이 넓게 보임
    this.groundSquash = Math.sin(this.pitch);
  }

  update(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    this._recompute();
  }

  // 월드 좌표 → 화면 좌표. 카메라 뒤면 vz <= 0
  project(x, y, z, out = {}) {
    const dx = x - this.px;
    const dy = y - this.py;
    const dz = z - this.pz;
    const vz = dx * this.fx + dy * this.fy + dz * this.fz;
    out.depth = vz;
    if (vz <= 0.05) {
      out.visible = false;
      out.scale = 0;
      out.x = 0;
      out.y = 0;
      return out;
    }
    const vx = dx * this.rx + dy * this.ry + dz * this.rz;
    const vy = dx * this.ux + dy * this.uy + dz * this.uz;
    const s = this.focal / vz;
    const sh = this.shake > 0 ? this.shake : 0;
    out.scale = s;
    out.x = this.cx + vx * s + (sh ? (Math.random() - 0.5) * sh * 14 : 0);
    out.y = this.cyPix - vy * s + (sh ? (Math.random() - 0.5) * sh * 14 : 0);
    out.visible = true;
    return out;
  }

  // 지평선 화면 Y (수평 방향 소실점)
  horizonY() {
    const hl = Math.hypot(this.fx, this.fz) || 1;
    const hx = this.fx / hl;
    const hz = this.fz / hl;
    const dotF = hx * this.fx + hz * this.fz;
    const dotU = hx * this.ux + hz * this.uz;
    if (dotF <= 0.001) return -1e5;
    return this.cyPix - (this.focal * dotU) / dotF;
  }

  // 카메라 기준 전방/우측 (지면 평면 위) — 이동 입력 변환용
  groundBasis() {
    const hl = Math.hypot(this.fx, this.fz) || 1;
    return {
      fx: this.fx / hl,
      fz: this.fz / hl,
      rx: this.rx,
      rz: this.rz,
    };
  }
}
